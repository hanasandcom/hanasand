import { afterEach, expect, test } from 'bun:test'
import { ControlledSocket, resetLifecycleTestState } from './fixtures/onion-session-websocket-lifecycle-harness.ts'

afterEach(resetLifecycleTestState)

test('malformed and typeless onion messages are ignored while later lifecycle messages still run', async () => {
    process.env.BROWSER_SANDBOX_WORKER_ONLY = '0'
    delete process.env.BROWSER_SANDBOX_POOL_TOKEN
    process.env.BROWSER_SANDBOX_PREWARM = '0'
    process.env.BROWSER_SANDBOX_SKIP_RUN_DB = '1'
    process.env.NODE_ENV = 'test'

    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const socket = new ControlledSocket()
    handleOnionSessionSocket(socket as never, 'invalid-message-onion-run', 'regular')

    socket.emit('message', Buffer.from('{'))
    socket.receive({})
    await new Promise<void>(resolve => setImmediate(resolve))

    expect(socket.readyState).toBe(socket.OPEN)
    expect(socket.messages).toEqual([])

    const ended = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Onion handler did not process end after ignored messages')), 2_000)
        socket.on('payload', payload => {
            if (payload.type !== 'ended') return
            clearTimeout(timeout)
            resolve()
        })
    })
    const closed = new Promise<void>(resolve => socket.once('close', () => resolve()))
    socket.receive({ type: 'end' })
    await Promise.all([ended, closed])

    expect(socket.messages.map(message => message.type)).toEqual(['ended'])
    expect(socket.readyState).toBe(3)
})
