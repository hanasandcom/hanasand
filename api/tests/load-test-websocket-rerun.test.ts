import { afterAll, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import WebSocket from 'ws'
import { once } from 'node:events'
import { supportsLoopbackListeners } from './fixtures/loopbackSupport.ts'

let rerunRequests = 0
let queueStarts = 0

mock.module('../src/handlers/test/follow.ts', () => ({
    enqueueLoadTestRun: async () => { rerunRequests++ },
    startLoadTestQueue: () => { queueStarts++ },
}))

const { default: wsPlugin } = await import('../src/plugins/ws.ts')

const loopbackAvailable = await supportsLoopbackListeners()
const app = Fastify({ forceCloseConnections: true })
let address: string | undefined
if (loopbackAvailable) {
    await app.register(websocket)
    await app.register(wsPlugin)
    address = await app.listen({ port: 0, host: '127.0.0.1' })
}

afterAll(async () => {
    if (address) {
        for (const socket of app.websocketServer?.clients || []) socket.terminate()
        await app.close()
    }
})

test.skipIf(!loopbackAvailable)('load-test websocket streams remain read-only and cannot enqueue a rerun', async () => {
    const socket = new WebSocket(address!.replace('http:', 'ws:') + '/api/ws/test/test-id')
    try {
        await once(socket, 'open')
        socket.send(JSON.stringify({ type: 'rerun' }))
        await new Promise(resolve => setTimeout(resolve, 25))

        expect(queueStarts).toBe(1)
        expect(rerunRequests).toBe(0)
        expect(socket.readyState).toBe(WebSocket.OPEN)
    } finally {
        socket.terminate()
    }
})
