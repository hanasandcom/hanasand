import { afterEach, expect, test } from 'bun:test'
import { currentBrowserAdmissionStatus, requestBrowserAdmission } from '../src/utils/ws/browserAdmission.ts'
import { ControlledSocket, finishedRuns, mockBrowserRunPreparation, resetLifecycleTestState } from './fixtures/onion-session-websocket-lifecycle-harness.ts'

afterEach(resetLifecycleTestState)

test('ending a queued onion run cancels its admission and preserves the running slot', async () => {
    process.env.BROWSER_SANDBOX_WORKER_ONLY = '0'
    delete process.env.BROWSER_SANDBOX_POOL_TOKEN
    process.env.BROWSER_SANDBOX_PREWARM = '0'
    process.env.BROWSER_SANDBOX_SKIP_RUN_DB = '1'
    process.env.BROWSER_SANDBOX_MAX_SESSIONS = '1'
    process.env.NODE_ENV = 'test'

    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const active = requestBrowserAdmission('already-running', () => undefined)
    const activeSlot = await active.promise
    const socket = new ControlledSocket()

    try {
        handleOnionSessionSocket(socket as never, 'queued-onion-run', 'regular')
        const queued = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Onion handler did not request admission')), 2_000)
            socket.on('payload', payload => {
                if (payload.state !== 'capacity_busy') return
                clearTimeout(timeout)
                resolve()
            })
        })
        socket.receive({ type: 'start', target: 'https://example.com', clientId: 'client-1' })
        await queued
        expect(currentBrowserAdmissionStatus()).toMatchObject({ activeSessions: 1, queuedSessions: 1, maxSessions: 1 })

        const ended = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Onion handler did not finish the queued run')), 2_000)
            socket.on('payload', payload => {
                if (payload.type !== 'ended') return
                clearTimeout(timeout)
                resolve()
            })
        })
        socket.receive({ type: 'start', target: 'https://second.example.com', clientId: 'client-1' })
        socket.receive({ type: 'end' })
        await ended
        await new Promise<void>(resolve => setImmediate(resolve))

        expect(currentBrowserAdmissionStatus()).toMatchObject({ activeSessions: 1, queuedSessions: 0, maxSessions: 1 })
        expect(socket.readyState).toBe(3)
        expect(socket.messages.some(message => message.state === 'launching')).toBe(false)
        activeSlot.release()
        expect(currentBrowserAdmissionStatus()).toMatchObject({ activeSessions: 0, queuedSessions: 0, maxSessions: 1 })
    } finally {
        socket.close()
        active.cancel()
        activeSlot.release()
    }
})

test('an overloaded onion command queue closes the session and cancels its admission', async () => {
    process.env.BROWSER_SANDBOX_WORKER_ONLY = '0'
    delete process.env.BROWSER_SANDBOX_POOL_TOKEN
    process.env.BROWSER_SANDBOX_PREWARM = '0'
    process.env.BROWSER_SANDBOX_SKIP_RUN_DB = '1'
    process.env.BROWSER_SANDBOX_MAX_SESSIONS = '1'
    process.env.NODE_ENV = 'test'

    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const active = requestBrowserAdmission('already-running-during-overload', () => undefined)
    const activeSlot = await active.promise
    const socket = new ControlledSocket()

    try {
        handleOnionSessionSocket(socket as never, 'overloaded-onion-run', 'regular')
        const queued = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Onion handler did not request admission')), 2_000)
            socket.on('payload', payload => {
                if (payload.state !== 'capacity_busy') return
                clearTimeout(timeout)
                resolve()
            })
        })
        socket.receive({ type: 'start', target: 'https://example.com', clientId: 'client-1' })
        await queued

        for (let index = 0; index < 101; index++) socket.receive({ type: 'key', key: 'a' })
        await new Promise<void>((resolve, reject) => {
            if (socket.readyState === 3) return resolve()
            const timeout = setTimeout(() => reject(new Error('Overloaded onion session did not close')), 2_000)
            socket.once('close', () => {
                clearTimeout(timeout)
                resolve()
            })
        })
        await new Promise<void>(resolve => setImmediate(resolve))

        expect(socket.closeCode).toBe(1013)
        expect(socket.closeReason).toBe('Too many queued browser commands.')
        expect(currentBrowserAdmissionStatus()).toMatchObject({ activeSessions: 1, queuedSessions: 0, maxSessions: 1 })
    } finally {
        socket.close()
        active.cancel()
        activeSlot.release()
    }
})

test('an end during run authorization does not enqueue or leave an authorized run active', async () => {
    process.env.BROWSER_SANDBOX_WORKER_ONLY = '0'
    delete process.env.BROWSER_SANDBOX_POOL_TOKEN
    process.env.BROWSER_SANDBOX_PREWARM = '0'
    delete process.env.BROWSER_SANDBOX_SKIP_RUN_DB
    process.env.BROWSER_SANDBOX_MAX_SESSIONS = '1'
    process.env.NODE_ENV = 'test'

    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const active = requestBrowserAdmission('already-running-during-auth', () => undefined)
    const activeSlot = await active.promise
    const socket = new ControlledSocket()
    let markPreparationStarted!: () => void
    let resolvePreparation!: (result: any) => void
    const preparationStarted = new Promise<void>(resolve => { markPreparationStarted = resolve })
    mockBrowserRunPreparation(() => new Promise(resolve => {
        resolvePreparation = resolve
        markPreparationStarted()
    }))

    try {
        handleOnionSessionSocket(socket as never, 'authorized-onion-run', 'regular')
        socket.receive({ type: 'start', target: 'https://example.com', clientId: 'client-1' })
        await preparationStarted

        const ended = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Onion handler did not finish the authorized run')), 2_000)
            socket.on('payload', payload => {
                if (payload.type !== 'ended') return
                clearTimeout(timeout)
                resolve()
            })
        })
        socket.receive({ type: 'end' })
        resolvePreparation({
            allowed: true,
            run: { id: 'authorized-onion-run', target: 'https://example.com', network: 'regular', status: 'running', startedAt: new Date().toISOString() },
            quota: { paid: false, concurrentLimit: 1, sessionSeconds: 90, advancedAnalysis: false, plan: 'anonymous', limit: null, used: 1, active: 1, remaining: null, resetsAt: null, identityKind: 'anonymous' },
        })
        await ended

        expect(currentBrowserAdmissionStatus()).toMatchObject({ activeSessions: 1, queuedSessions: 0, maxSessions: 1 })
        expect(finishedRuns).toContain('authorized-onion-run')
        expect(socket.messages.some(message => message.state === 'launching')).toBe(false)
    } finally {
        socket.close()
        active.cancel()
        activeSlot.release()
    }
})
