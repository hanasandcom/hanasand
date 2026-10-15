import { EventEmitter } from 'node:events'
import { afterEach, expect, test } from 'bun:test'
import { currentBrowserAdmissionStatus, requestBrowserAdmission } from '../src/utils/ws/browserAdmission.ts'

const originalWorkerOnly = process.env.BROWSER_SANDBOX_WORKER_ONLY
const originalPoolToken = process.env.BROWSER_SANDBOX_POOL_TOKEN
const originalPrewarm = process.env.BROWSER_SANDBOX_PREWARM
const originalSkipRunDb = process.env.BROWSER_SANDBOX_SKIP_RUN_DB
const originalMaxSessions = process.env.BROWSER_SANDBOX_MAX_SESSIONS
const originalNodeEnv = process.env.NODE_ENV

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

test('a closed onion socket leaves its queued admission and preserves the running slot', async () => {
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

        socket.close()
        await new Promise<void>(resolve => setImmediate(resolve))

        expect(currentBrowserAdmissionStatus()).toMatchObject({ activeSessions: 1, queuedSessions: 0, maxSessions: 1 })
        expect(socket.messages.some(message => message.state === 'launching')).toBe(false)
        activeSlot.release()
        expect(currentBrowserAdmissionStatus()).toMatchObject({ activeSessions: 0, queuedSessions: 0, maxSessions: 1 })
    } finally {
        socket.close()
        active.cancel()
        activeSlot.release()
    }
})
