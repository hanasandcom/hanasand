import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'

export const hostConsoleNames = ['inspur', 'ovh'] as const
export type HostConsoleName = typeof hostConsoleNames[number]

export type HostTarget = { name: HostConsoleName, host: string, port: number, username: string }

const hostLabels: Record<HostConsoleName, string> = { inspur: 'Inspur', ovh: 'OVH' }

export function targetFor(name: HostConsoleName): HostTarget {
    const prefix = name.toUpperCase()
    const host = process.env['HOST_CONSOLE_' + prefix + '_HOST'] || (name === 'inspur' ? '128.39.142.218' : '192.99.32.185')
    const port = Number(process.env['HOST_CONSOLE_' + prefix + '_PORT'] || (name === 'inspur' ? 222 : 22))
    const username = process.env['HOST_CONSOLE_' + prefix + '_USER'] || (name === 'inspur' ? 'hanasand' : 'ubuntu')
    if (!/^[A-Za-z0-9.-]{1,253}$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535 || !/^[a-z_][a-z0-9_-]{0,31}$/i.test(username)) {
        throw new Error('Host SSH settings are invalid.')
    }
    return { name, host, port, username }
}

function keyPath() {
    return process.env.HOST_CONSOLE_SSH_KEY_PATH || '/run/secrets/host-console'
}

function knownHostsPath() {
    return process.env.HOST_CONSOLE_KNOWN_HOSTS_PATH || '/run/secrets/host-console-known-hosts'
}

async function verifySshFiles() {
    const [privateKey, knownHosts] = await Promise.all([
        stat(keyPath()).catch(() => null),
        stat(knownHostsPath()).catch(() => null),
    ])
    if (!privateKey?.isFile() || (privateKey.mode & 0o077) !== 0 || !knownHosts?.isFile()) {
        throw new Error('Host console SSH credentials are not configured.')
    }
}

function sshArguments(target: HostTarget, allocateTerminal: boolean) {
    return [
        '-i', keyPath(),
        '-o', 'IdentitiesOnly=yes',
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=yes',
        '-o', 'UserKnownHostsFile=' + knownHostsPath(),
        '-o', 'ConnectTimeout=8',
        '-o', 'ServerAliveInterval=15',
        '-o', 'ServerAliveCountMax=2',
        '-o', 'LogLevel=ERROR',
        allocateTerminal ? '-tt' : '-T',
        '-p', String(target.port),
        target.username + '@' + target.host,
    ]
}

export async function runSshCommand(target: HostTarget, command: string, input: string) {
    await verifySshFiles()
    return new Promise<string>((resolve, reject) => {
        const child = spawn(process.env.HOST_CONSOLE_SSH_BINARY || 'ssh', [...sshArguments(target, false), command], {
            stdio: ['pipe', 'pipe', 'pipe'],
        })
        let stderr = ''
        let stdout = ''
        let settled = false
        const finish = (error?: Error) => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            if (error) reject(error)
            else resolve(stdout.trim())
        }
        const timeout = setTimeout(() => {
            child.kill('SIGTERM')
            finish(new Error('Host SSH update timed out for ' + target.name + '.'))
        }, 15000)
        child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-2000) })
        child.stdout.on('data', chunk => { stdout = (stdout + chunk.toString()).slice(-2048) })
        child.on('error', error => finish(error))
        child.on('close', code => finish(code === 0 ? undefined : new Error('Host SSH update failed for ' + target.name + ': ' + stderr.trim())))
        child.stdin.on('error', () => {})
        child.stdin.end(input)
    })
}

export async function inspectHost(name: HostConsoleName) {
    const target = targetFor(name)
    const base = {
        id: name,
        name: hostLabels[name],
        address: `${target.host}:${target.port}`,
        username: target.username,
    }
    try {
        const output = await runSshCommand(target, 'hostname && uname -sr', '')
        const [hostname, operatingSystem] = output.split('\n')
        return { ...base, status: 'online' as const, hostname: hostname || null, operatingSystem: operatingSystem || null }
    } catch {
        return { ...base, status: 'offline' as const, hostname: null, operatingSystem: null }
    }
}

export async function startHostConsole(name: HostConsoleName, send: (message: object) => void, onEnd: () => void) {
    await verifySshFiles()
    const target = targetFor(name)
    const child = spawn(process.env.HOST_CONSOLE_SSH_BINARY || 'ssh', sshArguments(target, true), {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, TERM: 'xterm-256color' },
    })
    let ready = false
    let stopped = false
    let errorSent = false
    child.once('spawn', () => send({ type: 'status', message: 'Connecting to ' + name + '…' }))
    child.stdout.on('data', chunk => {
        if (!ready) {
            ready = true
            send({ type: 'ready', username: target.username })
        }
        send({ type: 'output', data: chunk.toString() })
    })
    const fail = (message: string) => {
        if (stopped || errorSent) return
        errorSent = true
        send({ type: 'error', message })
        onEnd()
    }
    child.on('error', () => fail('Unable to start the host console.'))
    child.on('close', code => {
        if (stopped) return
        if (!ready && code !== 0) fail('Unable to connect to ' + name + ' over SSH.')
        else {
            send({ type: 'closed' })
            onEnd()
        }
    })
    child.stderr.on('data', () => {})
    return {
        write(data: string) { if (!stopped && child.stdin.writable) child.stdin.write(data) },
        close() {
            stopped = true
            child.kill('SIGTERM')
        },
    }
}
