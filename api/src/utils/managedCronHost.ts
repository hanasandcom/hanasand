import { existsSync } from 'node:fs'
import { readFile, stat, writeFile, chmod, chown } from 'node:fs/promises'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const CRON_USER = process.env.MANAGED_CRON_USER || process.env.HOST_USER || 'hanasand'
const CRON_SPOOL_DIR = process.env.MANAGED_CRON_SPOOL_DIR || '/host/cron/crontabs'
const MANAGED_LOG_ROOT = process.env.MANAGED_CRON_LOG_ROOT || ''
const CRON_WRITE_USER = process.env.MANAGED_CRON_WRITE_USER || 'bun'

export async function readManagedCrontab() {
    const spoolPath = hostCrontabPath()
    if (spoolPath && existsSync(spoolPath)) {
        return readFile(spoolPath, 'utf8')
    }

    try {
        const { stdout } = await execFileAsync('crontab', ['-l'])
        return stdout
    } catch {
        return ''
    }
}

export async function writeManagedCrontab(content: string) {
    const normalized = content.trimEnd() + '\n'
    const spoolPath = hostCrontabPath()

    if (spoolPath && existsSync(CRON_SPOOL_DIR)) {
        let uid = Number(process.env.MANAGED_CRON_UID || 1000)
        let gid = Number(process.env.MANAGED_CRON_GID || 1000)
        if (existsSync(spoolPath)) {
            const current = await stat(spoolPath)
            uid = current.uid
            gid = current.gid
        }
        try {
            await writeFile(spoolPath, normalized, 'utf8')
        } catch (error) {
            if (!isAccessError(error)) throw error
            await writeFileAsOwner(spoolPath, normalized)
        }
        await chmod(spoolPath, 0o600).catch(() => undefined)
        await chown(spoolPath, uid, gid).catch(() => undefined)
        return
    }

    await writeCrontabCommand(normalized)
}

function hostCrontabPath() {
    return CRON_SPOOL_DIR ? `${CRON_SPOOL_DIR}/${CRON_USER}` : ''
}

export async function readManagedCronLog(logPath?: string) {
    if (!logPath) return { line: null, createdAt: null }
    const hostPath = toHostPath(logPath)
    if (!hostPath) return { line: null, createdAt: null }
    if (!existsSync(hostPath)) return { line: null, createdAt: null }
    try {
        const [contents, details] = await Promise.all([
            readFile(hostPath, 'utf8'),
            stat(hostPath),
        ])
        const lines = contents.trim().split('\n').filter(Boolean)
        return {
            line: lines.at(-1) || null,
            createdAt: details.mtime.toISOString(),
        }
    } catch {
        return { line: null, createdAt: null }
    }
}

function toHostPath(path: string) {
    if (path.startsWith('/home/')) {
        return MANAGED_LOG_ROOT ? `${MANAGED_LOG_ROOT}${path.slice('/home'.length)}` : ''
    }
    return path
}

function writeCrontabCommand(content: string) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn('crontab', ['-'], {
            stdio: ['pipe', 'ignore', 'pipe'],
        })
        const stderr: Buffer[] = []

        child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)))
        child.on('error', reject)
        child.on('close', code => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(Buffer.concat(stderr).toString('utf8').trim() || `crontab exited with status ${code}`))
        })
        child.stdin.end(content)
    })
}

function writeFileAsOwner(path: string, content: string) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn('su', [CRON_WRITE_USER, '-s', '/bin/sh', '-c', `umask 077; cat > ${shellQuote(path)}`], {
            stdio: ['pipe', 'ignore', 'pipe'],
        })
        const stderr: Buffer[] = []

        child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)))
        child.on('error', reject)
        child.on('close', code => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(Buffer.concat(stderr).toString('utf8').trim() || `owner write exited with status ${code}`))
        })
        child.stdin.end(content)
    })
}

function shellQuote(value: string) {
    return `'${value.replaceAll('\'', '\'\\\'\'')}'`
}

function isAccessError(error: unknown) {
    return error && typeof error === 'object' && 'code' in error && error.code === 'EACCES'
}
