import { EventEmitter } from 'node:events'
import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import WebSocket from 'ws'

let authorized = false
let host = 'ovhcloud'
let lxdAvailable = true
let rows: Array<{ primary_host: string | null }> = []
let starts = 0
let writes: string[] = []
let queries: string[] = []

mock.module('../src/constants.ts', () => ({ default: { get vm_host_id() { return host } } }))
mock.module('../src/utils/auth/internalToken.ts', () => ({ default: () => authorized }))
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string) => { queries.push(sql); return { rows } } }))
mock.module('../src/utils/recovery.ts', () => ({ recoveryReadOnly: () => false }))
mock.module('../src/utils/vms/lxd.ts', () => ({ canUseLocalLxd: async () => lxdAvailable }))
mock.module('../src/utils/vms/hostTransport.ts', () => ({ supportedHost: (value: string) => ['inspur', 'ovhcloud'].includes(value) }))
mock.module('../src/utils/vms/consoleSession.ts', () => ({
    startConsoleSession: (name: string, send: (value: object) => void) => {
        starts++
        send({ type: 'ready', username: name })
        return { write: (value: string) => writes.push(value), resize: () => {}, close: () => {} }
    },
}))

const { default: registerInternalVmConsole } = await import('../src/handlers/vms/consoleInternal.ts')
const routes = new Map<string, (socket: Socket, request: unknown) => void>()
registerInternalVmConsole({ get: (path: string, _options: unknown, handler: (socket: Socket, request: unknown) => void) => routes.set(path, handler) } as never)
const route = routes.get('/api/vms/internal/:name/console')!

class Socket extends EventEmitter {
    readyState = WebSocket.OPEN
    closeCode?: number
    sent: string[] = []
    close(code = 1000) { this.closeCode = code; this.readyState = WebSocket.CLOSED; this.emit('close') }
    send(value: string) { this.sent.push(value) }
}

function open(name = 'cashflow') {
    const socket = new Socket()
    route(socket, { params: { name }, headers: {}, log: { warn: () => {} } })
    return socket
}

beforeEach(() => {
    authorized = false; host = 'ovhcloud'; lxdAvailable = true; rows = [{ primary_host: 'ovhcloud' }]
    starts = 0; writes = []; queries = []
})

afterAll(async () => { await Bun.sleep(0) })

test('rejects the internal console before DB access when the service token is missing', async () => {
    const socket = open()
    await Bun.sleep(5)
    expect(socket.closeCode).toBe(1008)
    expect(queries).toHaveLength(0)
    expect(starts).toBe(0)
})

test('only opens the VM on its assigned local host and when local LXD is available', async () => {
    authorized = true; rows = [{ primary_host: 'inspur' }]
    const wrongHost = open(); await Bun.sleep(5)
    expect(wrongHost.closeCode).toBe(1008)
    expect(starts).toBe(0)

    rows = [{ primary_host: 'ovhcloud' }]; lxdAvailable = false
    const unavailable = open(); await Bun.sleep(5)
    expect(unavailable.closeCode).toBe(1008)
    expect(starts).toBe(0)
})

test('clears the handshake deadline when authorization rejects the VM', async () => {
    authorized = true; rows = [{ primary_host: 'inspur' }]
    const originalSetTimeout = globalThis.setTimeout
    const originalClearTimeout = globalThis.clearTimeout
    let deadline: ReturnType<typeof setTimeout> | undefined
    let cleared = false
    globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
        const timer = originalSetTimeout(...args)
        if (args[1] === 10000) deadline = timer
        return timer
    }) as typeof setTimeout
    globalThis.clearTimeout = ((...args: Parameters<typeof clearTimeout>) => {
        if (args[0] === deadline) cleared = true
        return originalClearTimeout(...args)
    }) as typeof clearTimeout
    try {
        const socket = open()
        await Bun.sleep(5)
        expect(socket.closeCode).toBe(1008)
        expect(deadline).toBeDefined()
        expect(cleared).toBe(true)
    } finally {
        globalThis.setTimeout = originalSetTimeout
        globalThis.clearTimeout = originalClearTimeout
    }
})

test('starts and relays a local console only for a live VM assigned to this host', async () => {
    authorized = true
    const socket = open()
    await Bun.sleep(5)
    expect(queries[0]).toContain('deleted_at IS NULL')
    expect(starts).toBe(1)
    expect(socket.sent.map(value => JSON.parse(value))).toEqual([{ type: 'ready', username: 'cashflow' }])
    socket.emit('message', Buffer.from(JSON.stringify({ type: 'input', data: 'whoami\r' })))
    expect(writes).toEqual(['whoami\r'])
})
