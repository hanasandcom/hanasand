import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

export type ManagementApp = {
    appBase: string
    close: () => Promise<void>
}

export async function startManagementApp(root: string, apiBase: string): Promise<ManagementApp> {
    const appPort = await openPort()
    const appBase = `http://127.0.0.1:${appPort}`
    const appRoot = prepareIsolatedNextRoot(root)
    const nextProcess = spawn(process.execPath, [
        path.join(appRoot, 'node_modules/next/dist/bin/next'),
        'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(appPort),
    ], {
        cwd: appRoot,
        env: { ...process.env, FRONTEND_INTERNAL_API: apiBase, NEXT_PUBLIC_API: apiBase, PORT: String(appPort) },
    })
    let nextOutput = ''
    nextProcess.stdout.on('data', chunk => { nextOutput += String(chunk) })
    nextProcess.stderr.on('data', chunk => { nextOutput += String(chunk) })

    try {
        await waitForHttp(`${appBase}/login`, nextProcess, () => nextOutput, 90_000)
    } catch (error) {
        await stopNext(nextProcess)
        removeIsolatedRoot(appRoot)
        throw error
    }

    return {
        appBase,
        close: async () => {
            await stopNext(nextProcess)
            removeIsolatedRoot(appRoot)
        },
    }
}

function prepareIsolatedNextRoot(root: string) {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'hanasand-management-impersonation-flow-'))
    const isolatedRoot = path.join(parent, 'frontend')
    symlinkSync(path.resolve(root, '../api'), path.join(parent, 'api'), 'dir')
    mkdirSync(isolatedRoot, { recursive: true })
    for (const name of ['package.json', 'tsconfig.json', 'next-env.d.ts', 'postcss.config.mjs', 'next.config.js']) {
        const source = path.join(root, name)
        if (existsSync(source)) copyFileSync(source, path.join(isolatedRoot, name))
    }
    for (const name of ['src', 'public']) {
        const source = path.join(root, name)
        if (existsSync(source)) cpSync(source, path.join(isolatedRoot, name), { recursive: true })
    }
    symlinkSync(path.join(root, 'node_modules'), path.join(isolatedRoot, 'node_modules'), 'dir')
    return isolatedRoot
}

async function stopNext(nextProcess: ChildProcessWithoutNullStreams) {
    if (nextProcess.exitCode !== null) return
    nextProcess.kill()
    await Promise.race([
        new Promise<void>(resolve => nextProcess.once('exit', () => resolve())),
        new Promise<void>(resolve => setTimeout(resolve, 2_000)),
    ])
}

function removeIsolatedRoot(appRoot: string) {
    try {
        rmSync(path.dirname(appRoot), { force: true, recursive: true })
    } catch {
        // Next can briefly hold compiled files; stale temporary roots are removed before the next run.
    }
}

function openPort() {
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer()
        server.on('error', reject)
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            if (!address || typeof address === 'string') return reject(new Error('Unable to allocate TCP port.'))
            server.close(() => resolve(address.port))
        })
    })
}

async function waitForHttp(url: string, process: ChildProcessWithoutNullStreams, output: () => string, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs
    let lastError = ''
    while (Date.now() < deadline) {
        if (process.exitCode !== null) throw new Error(`Next dev server exited early.\n${output()}`)
        try {
            const response = await fetch(url)
            if (response.status < 500) return
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error)
        }
        await new Promise(resolve => setTimeout(resolve, 500))
    }
    throw new Error(`Timed out waiting for ${url}: ${lastError}\n${output()}`)
}
