import { test, expect, mock } from 'bun:test'
import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withLiveVmStatus } from '../src/utils/vms/status.ts'

test('VM status comes from a live check, never the saved running state', async () => {
    const vm = { name: 'cashflow', status: 'RUNNING', last_checked: '2026-06-20' }
    expect((await withLiveVmStatus(vm, async () => ({ status: 'Stopped' }))).status).toBe('STOPPED')
    expect((await withLiveVmStatus(vm, async () => { throw new Error('Connection refused') })).status).toBe('OFFLINE')
    expect((await withLiveVmStatus(vm, async () => ({ status: 'Running' }))).status).toBe('RUNNING')
})

let valid = true
let internalMember = false
let deleted = false
let revoked = false
let remoteSocket: FakeSocket | undefined
let remotePath = ''

class FakeSocket extends EventEmitter {
    readyState: number
    bufferedAmount = 0
    sent: string[] = []
    constructor(open = false) { super(); this.readyState = open ? WebSocket.OPEN : WebSocket.CONNECTING }
    send(value: string) { this.sent.push(value) }
    open() { this.readyState = WebSocket.OPEN; this.emit('open') }
    close() { this.readyState = WebSocket.CLOSED; this.emit('close') }
    ping() {}
}

mock.module('../src/constants.ts', () => ({ default: { vm_host_id: 'inspur' } }))
mock.module('../src/utils/auth/session.ts', () => ({ validateSession: async ({ id }: { id: string }) => valid ? { user: { id } } : null }))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({
    default: async () => ({ valid: false }),
    hasHanasandInternalPageAccess: async (id: string) => internalMember && id === 'org-editor',
}))
const query = async (sql: string, params: string[] = []) => ({ rows: /SELECT vm_user_(has_access|can_manage)/.test(sql) ? [{ allowed: !revoked && ['owner', 'creator', 'member'].includes(params[1]) }] : [{ primary_host: 'ovhcloud', deleted_at: deleted ? new Date() : null }] })
mock.module('../src/utils/db.ts', () => ({ default: query, identityQueryOnce: query, isTransientDatabaseError: () => false, withReadDatabase: async (work: () => Promise<unknown>) => work() }))
mock.module('../src/utils/recovery.ts', () => ({ recoveryReadOnly: () => false }))
mock.module('../src/utils/vms/lxd.ts', () => ({ lxdRequest: async () => { throw new Error('Unexpected host access') } }))
mock.module('../src/utils/vms/hostTransport.ts', () => ({
    supportedHost: (host: string) => ['inspur', 'ovhcloud'].includes(host),
    internalHostWebSocket: (host: string, path: string) => { remotePath = `${host}${path}`; return remoteSocket },
}))
const { consoleAccess, consoleHost, default: registerVmConsole } = await import('../src/handlers/vms/console.ts')
const { consoleUsername, consoleLoginScript } = await import('../src/utils/vms/lxdConsole.ts')

test('console requires an active session and VM ownership, sharing or Hanasand organization access', async () => {
    for (const id of ['owner', 'creator', 'member']) expect(await consoleAccess('cashflow', id, 'test')).toBe(true)
    expect(await consoleAccess('cashflow', 'stranger', 'test')).toBe(false)
    valid = false
    expect(await consoleAccess('cashflow', 'member', 'test')).toBe(false)
    valid = true
    internalMember = true
    expect(await consoleAccess('cashflow', 'org-editor', 'test')).toBe(true)
    expect(await consoleHost('cashflow', 'org-editor', 'test')).toBe('ovhcloud')
})

test('routes remote browser input, resize, and output through the VM primary host', async () => {
    remoteSocket = new FakeSocket()
    let route: ((socket: FakeSocket, request: unknown) => void) | undefined
    registerVmConsole({ get: (_path: string, _options: unknown, handler: typeof route) => { route = handler } } as never)
    const browser = new FakeSocket(true)
    route?.(browser, { params: { name: 'cashflow' }, headers: { origin: 'https://hanasand.com' }, log: { info: () => {}, warn: () => {}, error: () => {} } })
    browser.emit('message', Buffer.from(JSON.stringify({ type: 'auth', id: 'owner', token: 'session' })))
    await Bun.sleep(5)
    expect(remotePath).toBe('ovhcloud/vms/internal/cashflow/console')
    remoteSocket?.open()
    await Bun.sleep(5)
    remoteSocket?.emit('message', Buffer.from(JSON.stringify({ type: 'ready', username: 'cashflow' })))
    browser.emit('message', Buffer.from(JSON.stringify({ type: 'input', data: 'whoami\r' })))
    browser.emit('message', Buffer.from(JSON.stringify({ type: 'resize', cols: 120, rows: 40 })))
    expect(remoteSocket?.sent.map(value => JSON.parse(value))).toEqual([
        { type: 'input', data: 'whoami\r' },
        { type: 'resize', cols: 120, rows: 40 },
    ])
    expect(browser.sent.map(value => JSON.parse(value))).toContainEqual({ type: 'ready', username: 'cashflow' })
    browser.close()
    expect(remoteSocket?.readyState).toBe(WebSocket.CLOSED)
    remoteSocket = undefined
})

test('rejects remote resize input when the VM host websocket is backpressured', async () => {
    remoteSocket = new FakeSocket()
    let route: ((socket: FakeSocket, request: unknown) => void) | undefined
    registerVmConsole({ get: (_path: string, _options: unknown, handler: typeof route) => { route = handler } } as never)
    const browser = new FakeSocket(true)
    route?.(browser, { params: { name: 'cashflow' }, headers: { origin: 'https://hanasand.com' }, log: { info: () => {}, warn: () => {}, error: () => {} } })
    browser.emit('message', Buffer.from(JSON.stringify({ type: 'auth', id: 'owner', token: 'session' })))
    await Bun.sleep(5)
    remoteSocket?.open()
    await Bun.sleep(5)
    remoteSocket!.bufferedAmount = 1024 * 1024 + 1

    browser.emit('message', Buffer.from(JSON.stringify({ type: 'resize', cols: 120, rows: 40 })))

    expect(browser.readyState).toBe(WebSocket.CLOSED)
    expect(remoteSocket?.readyState).toBe(WebSocket.CLOSED)
    expect(browser.sent.map(value => JSON.parse(value))).toContainEqual({ type: 'error', message: 'The VM host is not accepting console input.' })
    remoteSocket = undefined
})

test('closes a remote console after periodic access revalidation detects revocation', async () => {
    revoked = false
    remoteSocket = new FakeSocket()
    const originalSetInterval = globalThis.setInterval
    let recheck: (() => Promise<void>) | undefined
    globalThis.setInterval = ((handler: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
        if (delay === 30000) {
            recheck = handler as () => Promise<void>
            return originalSetInterval(() => {}, 60000)
        }
        return originalSetInterval(handler, delay, ...args)
    }) as typeof setInterval
    let browser: FakeSocket | undefined
    try {
        let route: ((socket: FakeSocket, request: unknown) => void) | undefined
        registerVmConsole({ get: (_path: string, _options: unknown, handler: typeof route) => { route = handler } } as never)
        browser = new FakeSocket(true)
        route?.(browser, { params: { name: 'cashflow' }, headers: { origin: 'https://hanasand.com' }, log: { info: () => {}, warn: () => {}, error: () => {} } })
        browser.emit('message', Buffer.from(JSON.stringify({ type: 'auth', id: 'owner', token: 'session' })))
        await Bun.sleep(5)
        remoteSocket?.open()
        await Bun.sleep(5)
        revoked = true
        await recheck?.()
        expect(browser.readyState).toBe(WebSocket.CLOSED)
        expect(remoteSocket?.readyState).toBe(WebSocket.CLOSED)
        expect(browser.sent.map(value => JSON.parse(value))).toContainEqual({ type: 'error', message: 'Your console access has ended. Sign in again or check your VM access.' })
    } finally {
        if (browser?.readyState === WebSocket.OPEN) browser.close()
        globalThis.setInterval = originalSetInterval
        remoteSocket = undefined
        revoked = false
    }
})

test('console uses the existing VM account and rejects unsafe account names', () => {
    expect(consoleUsername('cashflow')).toBe('cashflow')
    expect(consoleUsername('my-vm')).toBe('my-vm')
    for (const name of ['root', 'nobody', '', '-admin', 'a; rm -rf /', 'alice@example.com', 'a'.repeat(65)]) {
        expect(() => consoleUsername(name)).toThrow('Invalid VM login account.')
    }
})

test('login requires an existing non-system account and never creates a user', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'console-login-'))
    try {
        await writeFile(join(directory, 'getent'), '#!/bin/sh\nexit "$ACCOUNT_MISSING"\n', { mode: 0o700 })
        await writeFile(join(directory, 'id'), '#!/bin/sh\nprintf "%s" "$ACCOUNT_UID"\n', { mode: 0o700 })
        await writeFile(join(directory, 'runuser'), '#!/bin/sh\nprintf "%s %s" "$1" "$2"\n', { mode: 0o700 })
        await writeFile(join(directory, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o700 })
        for (const [missing, uid, allowed] of [['0', '1001', true], ['1', '1001', false], ['0', '0', false], ['0', '999', false], ['0', '65534', false]] as const) {
            const process = Bun.spawn(['/bin/sh', '-c', consoleLoginScript, 'hanasand-console', 'cashflow'], {
                env: { PATH: directory, ACCOUNT_MISSING: missing, ACCOUNT_UID: uid }, stdout: 'pipe', stderr: 'pipe',
            })
            expect(await process.exited === 0).toBe(allowed)
            const output = await new Response(process.stdout).text()
            expect(output).toBe(allowed ? '--login cashflow' : '')
            const error = await new Response(process.stderr).text()
            expect(error.includes('VM login account is missing.')).toBe(missing === '1')
        }
    } finally { await rm(directory, { recursive: true, force: true }) }
})

test('pending deletion denies console access even to Hanasand organization editors', async () => {
    deleted = true
    internalMember = true
    expect(await consoleAccess('cashflow', 'org-editor', 'test')).toBe(false)
    expect(await consoleAccess('cashflow', 'owner', 'test')).toBe(false)
    deleted = false
})
