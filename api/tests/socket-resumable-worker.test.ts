import { EventEmitter } from 'node:events'
import { expect, mock, test } from 'bun:test'
import WebSocket, { type RawData } from 'ws'

class ControlledSocket extends EventEmitter {
    readyState = WebSocket.OPEN
    readonly sent: string[] = []

    constructor(private readonly rejectResume = false) { super() }

    send(data: string | Buffer) {
        const text = data.toString()
        this.sent.push(text)
        if (this.rejectResume && JSON.parse(text).type === 'resume') {
            this.emit('message', Buffer.from(JSON.stringify({ type: 'resume_unavailable' })) as RawData)
        }
    }

    close() { this.finish() }
    terminate() { this.finish() }

    private finish() {
        if (this.readyState === WebSocket.CLOSED) return
        this.readyState = WebSocket.CLOSED
        this.emit('close', 1006, Buffer.alloc(0))
    }
}

let pendingSockets: ControlledSocket[] = []
let connectionCount = 0

mock.module('../src/utils/ws/connectBrowserWorker.ts', () => ({
    connectBrowserWorkerSocket: async () => {
        connectionCount++
        const socket = pendingSockets.shift()
        if (!socket) throw new Error('Unexpected worker socket connection.')
        return socket
    },
}))

const { connectResumableWorker } = await import('../src/utils/ws/resumableWorker.ts')

test('resumable worker closes after its reconnect command queue reaches the bound', async () => {
    const firstSocket = new ControlledSocket()
    const resumedSocket = new ControlledSocket()
    pendingSockets = [firstSocket, resumedSocket]
    connectionCount = 0

    const client = await connectResumableWorker('ws://worker.invalid/session', new AbortController().signal, 'resume-token')
    const errors: Error[] = []
    let closes = 0
    client.on('error', error => errors.push(error))
    client.on('close', () => { closes++ })

    firstSocket.terminate()
    await until(() => connectionCount === 2)

    for (let index = 0; index < 100; index++) client.send(JSON.stringify({ type: 'command', index }))
    expect(errors).toEqual([])
    expect(client.readyState).toBe(WebSocket.OPEN)

    client.send(JSON.stringify({ type: 'command', index: 100 }))

    expect(errors.map(error => error.message)).toEqual([
        'Too many queued browser commands while reconnecting.',
    ])
    expect(client.readyState).toBe(WebSocket.CLOSED)
    expect(closes).toBe(1)
    expect(resumedSocket.sent).toEqual([JSON.stringify({ type: 'resume', resumeToken: 'resume-token' })])
}, 5000)

test('resumable worker reports when the original worker session is unavailable', async () => {
    const firstSocket = new ControlledSocket()
    const resumedSocket = new ControlledSocket(true)
    pendingSockets = [firstSocket, resumedSocket]
    connectionCount = 0

    const client = await connectResumableWorker('ws://worker.invalid/session', new AbortController().signal, 'resume-token')
    const errors: Error[] = []
    let closes = 0
    client.on('error', error => errors.push(error))
    client.on('close', () => { closes++ })

    firstSocket.terminate()
    await until(() => client.readyState === WebSocket.CLOSED)

    expect(errors.map(error => error.message)).toEqual([
        'The isolated browser worker is no longer available.',
    ])
    expect(closes).toBe(1)
}, 5000)

test('resumable worker bounds queued command bytes during reconnect', async () => {
    const firstSocket = new ControlledSocket()
    const resumedSocket = new ControlledSocket()
    pendingSockets = [firstSocket, resumedSocket]
    connectionCount = 0

    const client = await connectResumableWorker('ws://worker.invalid/session', new AbortController().signal, 'resume-token')
    const errors: Error[] = []
    client.on('error', error => errors.push(error))
    firstSocket.terminate()
    await until(() => connectionCount === 2)

    const command = JSON.stringify({ type: 'command', value: 'é'.repeat(300_000) })
    client.send(command)
    expect(client.readyState).toBe(WebSocket.OPEN)
    client.send(command)

    expect(errors.map(error => error.message)).toEqual([
        'Too many queued browser commands while reconnecting.',
    ])
    expect(client.readyState).toBe(WebSocket.CLOSED)
    expect(resumedSocket.sent).toEqual([JSON.stringify({ type: 'resume', resumeToken: 'resume-token' })])
}, 5000)

test('resumable worker rejects one command larger than its byte budget', async () => {
    const firstSocket = new ControlledSocket()
    const resumedSocket = new ControlledSocket()
    pendingSockets = [firstSocket, resumedSocket]
    connectionCount = 0

    const client = await connectResumableWorker('ws://worker.invalid/session', new AbortController().signal, 'resume-token')
    const errors: Error[] = []
    client.on('error', error => errors.push(error))
    firstSocket.terminate()
    await until(() => connectionCount === 2)

    client.send(JSON.stringify({ type: 'command', value: 'x'.repeat(1024 * 1024) }))

    expect(errors.map(error => error.message)).toEqual([
        'Too many queued browser commands while reconnecting.',
    ])
    expect(client.readyState).toBe(WebSocket.CLOSED)
}, 5000)

async function until(check: () => boolean) {
    const deadline = Date.now() + 3000
    while (!check()) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for websocket lifecycle event.')
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}
