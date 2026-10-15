import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import WebSocket from 'ws'
import { afterEach, expect, test } from 'bun:test'
import { currentBrowserAdmissionStatus } from '../src/utils/ws/browserAdmission.ts'

const originalWorkerOnly = process.env.BROWSER_SANDBOX_WORKER_ONLY
const originalSharedWorker = process.env.BROWSER_SANDBOX_ALLOW_SHARED_WORKER
const originalMaxSessions = process.env.BROWSER_SANDBOX_MAX_SESSIONS
const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
    if (originalWorkerOnly === undefined) delete process.env.BROWSER_SANDBOX_WORKER_ONLY
    else process.env.BROWSER_SANDBOX_WORKER_ONLY = originalWorkerOnly
    if (originalSharedWorker === undefined) delete process.env.BROWSER_SANDBOX_ALLOW_SHARED_WORKER
    else process.env.BROWSER_SANDBOX_ALLOW_SHARED_WORKER = originalSharedWorker
    if (originalMaxSessions === undefined) delete process.env.BROWSER_SANDBOX_MAX_SESSIONS
    else process.env.BROWSER_SANDBOX_MAX_SESSIONS = originalMaxSessions
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
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
