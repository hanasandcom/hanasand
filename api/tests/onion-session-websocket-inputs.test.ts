import { expect, test } from 'bun:test'
import { configureTestEnvironment, ControlledSocket, endSession, startRun, waitFor } from './onion-session-websocket-harness.ts'

test('onion pointer and wheel inputs clamp coordinates and deltas to browser bounds', async () => {
    const browser = configureTestEnvironment()
    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const socket = new ControlledSocket()
    handleOnionSessionSocket(socket as never, 'bounded-pointer-input', 'regular')

    try {
        await startRun(socket, 'https://8.8.8.8/input')
        const page = browser.contexts[0].pages[0]
        socket.receive({ type: 'click', x: 3000, y: -100 })
        socket.receive({ type: 'wheel', x: -100, y: 2000, deltaX: -2000, deltaY: 2000 })
        await waitFor(() => page.mouse.wheels.length === 1 ? true : undefined, 'bounded wheel input')

        expect(page.mouse.clicks).toEqual([{ x: 2400, y: 0 }])
        expect(page.mouse.moves).toEqual([{ x: 0, y: 1600 }])
        expect(page.mouse.wheels).toEqual([{ deltaX: -1600, deltaY: 1600 }])
    } finally {
        await endSession(socket)
    }
})
