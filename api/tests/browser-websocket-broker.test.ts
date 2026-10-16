import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import http from 'node:http'
import WebSocket, { WebSocketServer } from 'ws'
import { afterEach, expect, mock, test } from 'bun:test'
import { currentBrowserAdmissionStatus } from '../src/utils/ws/browserAdmission.ts'

let releaseDelayedAuthorization: ((result: { allowed: false; quota: null; reason: string }) => void) | null = null
let delayedAuthorizationStarted = false
mock.module('../src/handlers/browserSandboxRuns.ts', () => ({
    browserPaidExtensionAllowed: async () => false,
    finishBrowserRun: async () => undefined,
    persistBrowserRunEvidence: async () => undefined,
    prepareBrowserRun: async (input: { clientId?: string }) => {
        if (input.clientId === 'delayed-auth-client') {
            delayedAuthorizationStarted = true
            return await new Promise<{ allowed: false; quota: null; reason: string }>(resolve => {
                releaseDelayedAuthorization = resolve
            })
        }
        return { allowed: false as const, quota: null, reason: 'identity_required' }
    },
    refreshBrowserRunLease: async () => undefined,
    updateBrowserRunProviderResult: async () => undefined,
}))

const originalWorkerOnly = process.env.BROWSER_SANDBOX_WORKER_ONLY
const originalSharedWorker = process.env.BROWSER_SANDBOX_ALLOW_SHARED_WORKER
const originalWorkerWs = process.env.BROWSER_SANDBOX_WORKER_WS
const originalMaxSessions = process.env.BROWSER_SANDBOX_MAX_SESSIONS
const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
    if (originalWorkerOnly === undefined) delete process.env.BROWSER_SANDBOX_WORKER_ONLY
    else process.env.BROWSER_SANDBOX_WORKER_ONLY = originalWorkerOnly
    if (originalSharedWorker === undefined) delete process.env.BROWSER_SANDBOX_ALLOW_SHARED_WORKER
    else process.env.BROWSER_SANDBOX_ALLOW_SHARED_WORKER = originalSharedWorker
    if (originalWorkerWs === undefined) delete process.env.BROWSER_SANDBOX_WORKER_WS
    else process.env.BROWSER_SANDBOX_WORKER_WS = originalWorkerWs
    if (originalMaxSessions === undefined) delete process.env.BROWSER_SANDBOX_MAX_SESSIONS
    else process.env.BROWSER_SANDBOX_MAX_SESSIONS = originalMaxSessions
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
})

test('browser broker closes a flooded client while the shared worker is still connecting', async () => {
    process.env.BROWSER_SANDBOX_WORKER_ONLY = '0'
    process.env.BROWSER_SANDBOX_ALLOW_SHARED_WORKER = 'development'
    process.env.NODE_ENV = 'test'

    const workerHttp = http.createServer()
    const workerServer = new WebSocketServer({ noServer: true })
    const workerSockets = new Set<import('node:net').Socket>()
    let workerOpened = false
    let workerSocketClosed = false
    workerHttp.on('connection', socket => {
        workerSockets.add(socket)
        socket.on('close', () => {
            workerSocketClosed = true
            workerSockets.delete(socket)
        })
    })
    workerHttp.on('upgrade', (request, socket, head) => {
        const timer = setTimeout(() => {
            if (socket.destroyed) return
            workerServer.handleUpgrade(request, socket, head, worker => {
                workerOpened = true
                workerServer.emit('connection', worker, request)
            })
        }, 1000)
        socket.once('close', () => clearTimeout(timer))
    })
    await new Promise<void>(resolve => workerHttp.listen(0, '127.0.0.1', resolve))
    const workerAddress = workerHttp.address() as import('node:net').AddressInfo
    process.env.BROWSER_SANDBOX_WORKER_WS = `ws://127.0.0.1:${workerAddress.port}`

    const app = Fastify()
    await app.register(websocket)
    const { default: wsPlugin } = await import('../src/plugins/ws.ts')
    await app.register(wsPlugin)
    await app.ready()
    const address = await app.listen({ host: '127.0.0.1', port: 0 })
    const client = new WebSocket(address.replace('http', 'ws') + '/api/ws/browser/flooded-startup')
    await new Promise<void>((resolve, reject) => {
        client.once('open', resolve)
        client.once('error', reject)
    })

    try {
        const errorMessage = new Promise<Record<string, unknown>>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Broker did not report pending queue overflow')), 2000)
            client.on('message', message => {
                const payload = JSON.parse(String(message)) as Record<string, unknown>
                if (payload.type !== 'error') return
                clearTimeout(timeout)
                resolve(payload)
            })
        })
        const closed = new Promise<{ code: number; reason: string }>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Broker did not close the overloaded client')), 2000)
            client.once('close', (code, reason) => {
                clearTimeout(timeout)
                resolve({ code, reason: reason.toString() })
            })
        })
        for (let index = 0; index < 101; index++) client.send(JSON.stringify({ type: 'key', key: 'a', index }))

        expect(await errorMessage).toMatchObject({ type: 'error', message: 'Too many browser commands are waiting. The session is closing.' })
        expect(await closed).toEqual({ code: 1013, reason: 'Too many queued browser commands.' })
        expect(workerOpened).toBe(false)
        const releaseDeadline = Date.now() + 1000
        while (!workerSocketClosed && Date.now() < releaseDeadline) await new Promise(resolve => setTimeout(resolve, 5))
        expect(workerSocketClosed).toBe(true)
    } finally {
        client.terminate()
        for (const connection of [...app.websocketServer.clients]) connection.terminate()
        app.server.closeAllConnections()
        await app.close()
        for (const socket of workerSockets) socket.destroy()
        for (const worker of workerServer.clients) worker.terminate()
        workerServer.close()
        await new Promise<void>(resolve => workerHttp.close(() => resolve()))
    }
})

test('browser broker bounds ingress while start authorization is delayed', async () => {
    process.env.BROWSER_SANDBOX_WORKER_ONLY = '0'
    delete process.env.BROWSER_SANDBOX_ALLOW_SHARED_WORKER
    process.env.NODE_ENV = 'test'
    delayedAuthorizationStarted = false
    releaseDelayedAuthorization = null

    const app = Fastify()
    await app.register(websocket)
    const { default: wsPlugin } = await import('../src/plugins/ws.ts')
    await app.register(wsPlugin)
    await app.ready()
    const address = await app.listen({ host: '127.0.0.1', port: 0 })
    const client = new WebSocket(address.replace('http', 'ws') + '/api/ws/browser/delayed-auth-flood')
    await new Promise<void>((resolve, reject) => {
        client.once('open', resolve)
        client.once('error', reject)
    })

    try {
        const errorMessage = new Promise<Record<string, unknown>>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Broker did not report ingress queue overflow')), 2000)
            client.on('message', message => {
                const payload = JSON.parse(String(message)) as Record<string, unknown>
                if (payload.type !== 'error') return
                clearTimeout(timeout)
                resolve(payload)
            })
        })
        const closed = new Promise<{ code: number; reason: string }>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Broker did not close the overloaded client')), 2000)
            client.once('close', (code, reason) => {
                clearTimeout(timeout)
                resolve({ code, reason: reason.toString() })
            })
        })
        client.send(JSON.stringify({ type: 'start', target: 'https://example.com', clientId: 'delayed-auth-client' }))
        const authDeadline = Date.now() + 1000
        while (!delayedAuthorizationStarted && Date.now() < authDeadline) await new Promise(resolve => setTimeout(resolve, 5))
        expect(delayedAuthorizationStarted).toBe(true)
        for (let index = 0; index < 101; index++) client.send(JSON.stringify({ type: 'key', key: 'a', index }))

        expect(await errorMessage).toMatchObject({ type: 'error', message: 'Too many browser commands are waiting. The session is closing.' })
        expect(await closed).toEqual({ code: 1013, reason: 'Too many queued browser commands.' })
        expect(currentBrowserAdmissionStatus().activeSessions).toBe(0)
    } finally {
        releaseDelayedAuthorization?.({ allowed: false, quota: null, reason: 'identity_required' })
        client.terminate()
        for (const connection of [...app.websocketServer.clients]) connection.terminate()
        app.server.closeAllConnections()
        await app.close()
    }
})

test('browser broker does not reserve capacity before start authorization succeeds', async () => {
    process.env.BROWSER_SANDBOX_WORKER_ONLY = '0'
    delete process.env.BROWSER_SANDBOX_ALLOW_SHARED_WORKER
    process.env.BROWSER_SANDBOX_MAX_SESSIONS = '1'
    process.env.NODE_ENV = 'test'

    const app = Fastify()
    await app.register(websocket)
    const { default: wsPlugin } = await import('../src/plugins/ws.ts')
    await app.register(wsPlugin)
    await app.ready()
    const address = await app.listen({ host: '127.0.0.1', port: 0 })
    const socket = new WebSocket(address.replace('http', 'ws') + '/api/ws/browser/idle-before-start')
    await new Promise<void>((resolve, reject) => {
        socket.once('open', resolve)
        socket.once('error', reject)
    })

    try {
        expect(currentBrowserAdmissionStatus()).toMatchObject({
            activeSessions: 0,
            queuedSessions: 0,
            maxSessions: 1,
        })
        socket.send(JSON.stringify({ type: 'start', target: 'https://example.com' }))
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Broker did not reject a start without an identity')), 2_000)
            let identityRejected = false
            socket.on('message', message => {
                const payload = JSON.parse(String(message))
                if (payload.state === 'identity_required') identityRejected = true
                if (payload.type !== 'ended') return
                clearTimeout(timeout)
                expect(identityRejected).toBe(true)
                resolve()
            })
        })
        expect(currentBrowserAdmissionStatus()).toMatchObject({
            activeSessions: 0,
            queuedSessions: 0,
            maxSessions: 1,
        })
    } finally {
        socket.terminate()
        const connections = [...app.websocketServer.clients]
        for (const connection of connections) connection.terminate()
        app.server.closeAllConnections()
        await app.close()
    }
})
