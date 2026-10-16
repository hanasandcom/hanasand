import { EventEmitter } from 'node:events'
import { afterEach, expect, mock, test } from 'bun:test'
import { currentBrowserAdmissionStatus, requestBrowserAdmission } from '../src/utils/ws/browserAdmission.ts'

const originalWorkerOnly = process.env.BROWSER_SANDBOX_WORKER_ONLY
const originalPoolToken = process.env.BROWSER_SANDBOX_POOL_TOKEN
const originalPrewarm = process.env.BROWSER_SANDBOX_PREWARM
const originalSkipRunDb = process.env.BROWSER_SANDBOX_SKIP_RUN_DB
const originalMaxSessions = process.env.BROWSER_SANDBOX_MAX_SESSIONS
const originalNodeEnv = process.env.NODE_ENV
const finishedRuns: string[] = []
let prepareBrowserRunMock: () => Promise<any> = async () => ({ allowed: true, run: null, quota: null })

mock.module('../src/handlers/browserSandboxRuns.ts', () => ({
    browserPaidExtensionAllowed: async () => false,
    refreshBrowserRunLease: async () => undefined,
    finishBrowserRun: async (id: string) => { finishedRuns.push(id) },
    prepareBrowserRun: () => prepareBrowserRunMock(),
    updateBrowserRunProviderResult: async () => undefined,
}))

afterEach(() => {
    if (originalWorkerOnly === undefined) delete process.env.BROWSER_SANDBOX_WORKER_ONLY
    else process.env.BROWSER_SANDBOX_WORKER_ONLY = originalWorkerOnly
    if (originalPoolToken === undefined) delete process.env.BROWSER_SANDBOX_POOL_TOKEN
    else process.env.BROWSER_SANDBOX_POOL_TOKEN = originalPoolToken
    if (originalPrewarm === undefined) delete process.env.BROWSER_SANDBOX_PREWARM
    else process.env.BROWSER_SANDBOX_PREWARM = originalPrewarm
    if (originalSkipRunDb === undefined) delete process.env.BROWSER_SANDBOX_SKIP_RUN_DB
    else process.env.BROWSER_SANDBOX_SKIP_RUN_DB = originalSkipRunDb
    if (originalMaxSessions === undefined) delete process.env.BROWSER_SANDBOX_MAX_SESSIONS
    else process.env.BROWSER_SANDBOX_MAX_SESSIONS = originalMaxSessions
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    prepareBrowserRunMock = async () => ({ allowed: true, run: null, quota: null })
    finishedRuns.length = 0
})

class ControlledSocket extends EventEmitter {
    readonly OPEN = 1
    readyState = this.OPEN
    readonly messages: Record<string, unknown>[] = []

    send(message: string) {
        const payload = JSON.parse(message) as Record<string, unknown>
        this.messages.push(payload)
        this.emit('payload', payload)
    }

    close(code = 1000, reason = '') {
        if (this.readyState !== this.OPEN) return
        this.readyState = 3
        this.emit('close', code, Buffer.from(reason))
    }

    receive(payload: Record<string, unknown>) {
        this.emit('message', Buffer.from(JSON.stringify(payload)))
    }
}

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
    prepareBrowserRunMock = () => new Promise(resolve => {
        resolvePreparation = resolve
        markPreparationStarted()
    })

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
