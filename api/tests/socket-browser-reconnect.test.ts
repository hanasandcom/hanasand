import { expect, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { BrowserReconnect } from '../src/utils/ws/browserReconnect.ts'

const token = '12345678-1234-1234-1234-123456789abc'

class Socket extends EventEmitter {
    readyState = WebSocket.OPEN
    sent: Array<{ type: string; bytes: number }> = []
    send(data: string | Buffer) {
        const text = data.toString()
        this.sent.push({ type: JSON.parse(text).type, bytes: Buffer.byteLength(text) })
    }
    close() {
        if (this.readyState === WebSocket.CLOSED) return
        this.readyState = WebSocket.CLOSED
        this.emit('close', 1000, Buffer.alloc(0))
    }
    terminate() { this.close() }
    message(value: unknown) { this.emit('message', Buffer.from(JSON.stringify(value))) }
}

test('replay cache stays within per-message and total UTF-8 byte bounds', () => {
    const original = new Socket()
    let disposed = 0
    const session = new BrowserReconnect(original as unknown as WebSocket, () => disposed++)
    original.message({ type: 'start', resumeToken: token })
    original.close()

    const multibyteEvidence = '€'.repeat(2_500_000)
    const oversizedEvidence = '€'.repeat(2_900_000)
    session.send(JSON.stringify({ type: 'ready', evidence: oversizedEvidence }))
    session.send(JSON.stringify({ type: 'stream_ready', evidence: multibyteEvidence }))
    session.send(JSON.stringify({ type: 'frame', evidence: multibyteEvidence }))
    session.send(JSON.stringify({ type: 'run_time', evidence: multibyteEvidence }))

    const resumed = new Socket()
    session.attach(resumed as unknown as WebSocket)
    resumed.message({ type: 'resume', resumeToken: token })

    expect(resumed.sent.map(message => message.type)).toEqual(['reconnected', 'frame', 'run_time'])
    expect(resumed.sent.slice(1).reduce((total, message) => total + message.bytes, 0)).toBeLessThanOrEqual(16 * 1024 * 1024)
    session.close()
    expect(disposed).toBe(1)
})

test('replacing a socket does not let the old socket close the worker session', () => {
    const original = new Socket()
    let disposed = 0
    let sessionClosed = 0
    const session = new BrowserReconnect(original as unknown as WebSocket, () => disposed++)
    session.on('close', () => sessionClosed++)
    original.message({ type: 'start', resumeToken: token })

    const resumed = new Socket()
    session.attach(resumed as unknown as WebSocket)
    resumed.message({ type: 'resume', resumeToken: token })

    expect(original.readyState).toBe(WebSocket.CLOSED)
    expect(session.readyState).toBe(WebSocket.OPEN)
    expect(disposed).toBe(0)
    expect(sessionClosed).toBe(0)

    original.emit('close', 1000, Buffer.alloc(0))
    expect(session.readyState).toBe(WebSocket.OPEN)
    expect(disposed).toBe(0)

    session.close()
    session.close()
    expect(resumed.readyState).toBe(WebSocket.CLOSED)
    expect(disposed).toBe(1)
    expect(sessionClosed).toBe(1)
})
