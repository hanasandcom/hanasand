import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, chmod, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import git, { LOCAL_REPO_PATH } from './git.ts'

const execFileAsync = promisify(execFile)
const askpassScript = `#!/bin/sh
case "$1" in
    *Username*|*username*) printf '%s\\n' "$ARTICLES_GIT_USERNAME" ;;
    *Password*|*password*) printf '%s\\n' "$ARTICLES_GIT_TOKEN" ;;
    *) exit 1 ;;
esac
`

export default async function commitAndPush(message: string) {
    await git('add -- articles')
    if (await git('diff --cached --name-only')) {
        await git(`commit -m '${message}'`)
    }

    // Always retry both mirrors, including after a partial publish failure.
    const targets = [
        {
            name: 'GitHub',
            host: 'github.com',
            path: '/hanasandcom/articles.git',
            url: process.env.ARTICLES_GITHUB_PUSH_URL || 'https://github.com/hanasandcom/articles.git',
            username: process.env.ARTICLES_GITHUB_USERNAME,
            token: process.env.ARTICLES_GITHUB_TOKEN,
        },
        {
            name: 'Forgejo',
            host: 'git.hanasand.com',
            path: '/hanasandcom/articles.git',
            url: process.env.ARTICLES_FORGEJO_PUSH_URL || 'https://git.hanasand.com/hanasandcom/articles.git',
            username: process.env.ARTICLES_FORGEJO_USERNAME,
            token: process.env.ARTICLES_FORGEJO_TOKEN,
        },
    ]
    const missingCredentials = targets.filter(target => {
        let parsed: URL
        try {
            parsed = new URL(target.url)
        } catch {
            throw new Error(`Article ${target.name} push URL is invalid.`)
        }
        if (
            parsed.username
            || parsed.password
            || !['https:', 'file:'].includes(parsed.protocol)
            || (parsed.protocol === 'file:' && process.env.NODE_ENV === 'production')
        ) {
            throw new Error('Article repository push URL is not a supported credential-free URL.')
        }
        if (parsed.protocol === 'https:' && (parsed.hostname !== target.host || parsed.pathname !== target.path)) {
            throw new Error(`Article ${target.name} push URL must target its configured articles repository.`)
        }
        return parsed.protocol === 'https:' && (!target.username || !target.token)
    })
    if (missingCredentials.length) {
        throw new Error(`Article was saved locally, but publishing credentials are missing for ${missingCredentials.map(target => target.name).join(' and ')}.`)
    }

    const askpassDirectory = await mkdtemp(join(tmpdir(), 'hanasand-articles-askpass-'))
    const askpassPath = join(askpassDirectory, 'askpass')
    const gitEnvironment = { ...process.env }
    for (const key of [
        'ARTICLES_GITHUB_USERNAME',
        'ARTICLES_GITHUB_TOKEN',
        'ARTICLES_FORGEJO_USERNAME',
        'ARTICLES_FORGEJO_TOKEN',
    ]) {
        delete gitEnvironment[key]
    }
    try {
        await writeFile(askpassPath, askpassScript, { mode: 0o700 })
        await chmod(askpassPath, 0o700)
        for (const target of targets) {
            await execFileAsync('git', [
                '-C', LOCAL_REPO_PATH,
                '-c', 'credential.helper=',
                '-c', `core.askPass=${askpassPath}`,
                'push', '--', target.url, 'HEAD:refs/heads/main',
            ], {
                timeout: 60000,
                env: {
                    ...gitEnvironment,
                    GIT_ASKPASS: askpassPath,
                    GIT_TERMINAL_PROMPT: '0',
                    ARTICLES_GIT_USERNAME: target.username || '',
                    ARTICLES_GIT_TOKEN: target.token || '',
                },
            })
        }
    } catch {
        throw new Error('Article was saved locally, but publishing to GitHub and Forgejo failed.')
    } finally {
        await rm(askpassDirectory, { recursive: true, force: true })
    }
}
