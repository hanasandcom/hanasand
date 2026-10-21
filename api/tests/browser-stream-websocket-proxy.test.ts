import { EventEmitter } from 'node:events'
import { expect, test } from 'bun:test'
import WebSocket from 'ws'
import { proxyBrowserStreamSocket } from '../src/plugins/ws.ts'

class FakeSocket extends EventEmitter {
    readonly OPEN = WebSocket.OPEN
    readonly CONNECTING = WebSocket.CONNECTING
    readonly CLOSED = WebSocket.CLOSED
    readyState: number
    readonly sent: string[] = []
    pingCount = 0
    closeCode: number | undefined
    closeReason = ''

    constructor(readyState: number) {
        super()
        this.readyState = readyState
    }

    send(message: string | Buffer, callback?: (error?: Error) => void) {
        this.sent.push(message.toString())
        callback?.()
    }

    close(code = 1000, reason = '') {
        if (this.readyState === this.CLOSED) return
        this.readyState = this.CLOSED
        this.closeCode = code
        this.closeReason = reason
        this.emit('close', code, Buffer.from(reason))
    }

    ping() { this.pingCount++ }

    receive(message: string) {
        this.emit('message', Buffer.from(message))
    }
}

function connectProxy(client = new FakeSocket(WebSocket.OPEN), upstream = new FakeSocket(WebSocket.CONNECTING)) {
    proxyBrowserStreamSocket(client as unknown as WebSocket, upstream as unknown as WebSocket, 'stream-test')
    return { client, upstream }
}

test('browser stream proxy forwards queued messages in order when its upstream opens', () => {
    const { client, upstream } = connectProxy()

    try {
        client.receive('offer')
        client.receive('ice-candidate')
        expect(upstream.sent).toEqual([])

        upstream.readyState = WebSocket.OPEN
        upstream.emit('open')
        expect(upstream.sent).toEqual(['offer', 'ice-candidate'])

        upstream.receive('answer')
        expect(client.sent).toEqual(['answer'])
    } finally {
        client.close()
    }
})

test('browser stream proxy keeps both signaling sockets alive before idle timeouts', async () => {
    const { client, upstream } = connectProxy(new FakeSocket(WebSocket.OPEN), new FakeSocket(WebSocket.OPEN))

    try {
        await new Promise(resolve => setTimeout(resolve, 5_100))
        expect(client.pingCount).toBeGreaterThanOrEqual(1)
        expect(upstream.pingCount).toBeGreaterThanOrEqual(1)
    } finally { client.close() }
})

test('browser stream proxy closes an overloaded client when the upstream is stalled', () => {
    const { client, upstream } = connectProxy()

    for (let index = 0; index < 101; index++) client.receive(`command-${index}`)

    expect(client.sent).toEqual([JSON.stringify({
        type: 'error',
        message: 'Too many browser commands are waiting. The session is closing.',
    })])
    expect(client.closeCode).toBe(1013)
    expect(client.closeReason).toBe('Too many queued browser commands.')
    expect(upstream.readyState).toBe(WebSocket.CLOSED)
})

test('browser stream proxy bounds aggregate queued UTF-8 bytes', () => {
    const { client, upstream } = connectProxy()

    client.receive('é'.repeat(300 * 1024))
    client.receive('é'.repeat(300 * 1024))

    expect(client.closeCode).toBe(1013)
    expect(client.closeReason).toBe('Too many queued browser commands.')
    expect(client.sent).toHaveLength(1)
    expect(upstream.readyState).toBe(WebSocket.CLOSED)
})

test('browser stream proxy closes the client when its upstream closes', () => {
    const { client, upstream } = connectProxy(new FakeSocket(WebSocket.OPEN), new FakeSocket(WebSocket.OPEN))

    upstream.close(1001, 'upstream restarting')

    expect(client.closeCode).toBe(1000)
    expect(client.closeReason).toBe('')
    expect(client.sent).toEqual([])
})
