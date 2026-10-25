import { exec } from 'child_process'
import util from 'util'
import fs from 'fs/promises'
import config from '#constants'
import { join, resolve } from 'path'

const execAsync = util.promisify(exec)

const LOCAL_REPO_PATH = resolve(process.env.ARTICLES_REPO_PATH || (process.env.NODE_ENV === 'production' ? '/var/lib/hanasand/articles' : './articles'))
const ARTICLES_DIR = join(LOCAL_REPO_PATH, 'articles')
let ensureRepoPromise: Promise<void> | null = null
let articleTimestampsCache: { key: string, value: Promise<Map<string, { created?: string, updated?: string }>> } | null = null

export { ARTICLES_DIR, LOCAL_REPO_PATH, ensureRepo }

export async function articleTimestamps(files: string[]) {
    await ensureRepo()
    const key = [...files].sort().join('\0')
    if (articleTimestampsCache?.key === key) return articleTimestampsCache.value
    const value = loadArticleTimestamps(files).catch(error => {
        if (articleTimestampsCache?.key === key) articleTimestampsCache = null
        throw error
    })
    articleTimestampsCache = { key, value }
    return value
}

async function loadArticleTimestamps(files: string[]) {
    const requested = new Set(files.map(file => `articles/${file}`))
    const created = new Map<string, string>()
    const updated = new Map<string, string>()

    const [createdLog, updatedLog] = await Promise.all([
        execAsync(`git -C '${LOCAL_REPO_PATH}' log --reverse --format='%aI' --name-only --diff-filter=A -- articles`, { timeout: 30000 }),
        execAsync(`git -C '${LOCAL_REPO_PATH}' log --format='%aI' --name-only -- articles`, { timeout: 30000 }),
    ])

    const readLog = (output: string, target: Map<string, string>) => {
        let timestamp = ''
        for (const line of output.split('\n')) {
            if (line.startsWith('articles/')) {
                if (requested.has(line) && !target.has(line)) target.set(line, timestamp)
            } else if (line) {
                timestamp = line
            }
        }
    }

    readLog(createdLog.stdout, created)
    readLog(updatedLog.stdout, updated)
    return new Map(files.map(file => [file, {
        created: created.get(`articles/${file}`),
        updated: updated.get(`articles/${file}`),
    }]))
}

export default async function git(cmd: string, timeout = 15000) {
    await ensureRepo()

    try {
        const { stdout, stderr } = await execAsync(`git -C '${LOCAL_REPO_PATH}' ${cmd}`, { timeout })
        if (stderr) {
            console.error(stderr)
        }

        return stdout.trim()
    } catch (error) {
        console.error(`Git command failed: git ${cmd}: ${error}`)
        throw error
    }
}

async function ensureRepo() {
    if (ensureRepoPromise) {
        return ensureRepoPromise
    }

    ensureRepoPromise = ensureRepoInternal().catch((error) => {
        ensureRepoPromise = null
        throw error
    })

    return ensureRepoPromise
}

async function ensureRepoInternal() {
    // Serving existing content must not wait for Git hosting or require its credentials.
    // Production stores this repository in the API's existing persistent state volume.
    if (await directoryExists(ARTICLES_DIR)) return
    let localRepoExists = true
    try {
        await fs.access(LOCAL_REPO_PATH)
    } catch {
        localRepoExists = false
    }

    if (!localRepoExists) {
        console.log('Cloning repository...')
        await execAsync(`git clone ${config.articles_repo_url} '${LOCAL_REPO_PATH}'`, { timeout: 120000 })
    }

    try {
        await fs.access(join(LOCAL_REPO_PATH, '.git'))
    } catch (error) {
        if (await directoryExists(ARTICLES_DIR)) {
            return
        }
        throw error
    }

    await execAsync(`git -C '${LOCAL_REPO_PATH}' remote get-url origin`, { timeout: 15000 })

    try {
        await execAsync(`git -C '${LOCAL_REPO_PATH}' fetch origin --prune`, { timeout: 120000 })
    } catch (error) {
        if (await directoryExists(ARTICLES_DIR)) {
            console.warn('Could not refresh articles origin; using existing article checkout:', error)
            return
        }
        throw error
    }

    const defaultBranch = await resolveDefaultBranch()
    const originBranch = `origin/${defaultBranch}`

    try {
        await execAsync(`git -C '${LOCAL_REPO_PATH}' checkout ${defaultBranch}`, { timeout: 15000 })
    } catch {
        await execAsync(`git -C '${LOCAL_REPO_PATH}' checkout -B ${defaultBranch} ${originBranch}`, { timeout: 15000 })
    }

    try {
        await execAsync(`git -C '${LOCAL_REPO_PATH}' branch --set-upstream-to=${originBranch} ${defaultBranch}`, { timeout: 15000 })
    } catch (e) {
        console.warn(`Could not set upstream for ${defaultBranch}:`, e)
    }
}

async function resolveDefaultBranch() {
    try {
        const { stdout: head } = await execAsync(`git -C '${LOCAL_REPO_PATH}' remote show origin`, { timeout: 15000 })
        const match = head.match(/HEAD branch: (.+)/)
        if (match?.[1]?.trim()) {
            return match[1].trim()
        }
    } catch (error) {
        console.warn('Could not read article origin HEAD branch; falling back to main:', error)
    }

    return 'main'
}

async function directoryExists(path: string) {
    try {
        const details = await fs.stat(path)
        return details.isDirectory()
    } catch {
        return false
    }
}
