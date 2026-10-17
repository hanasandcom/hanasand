import { EventEmitter } from 'node:events'
import { mock } from 'bun:test'

const originalEnvironment = new Map([
    'BROWSER_SANDBOX_WORKER_ONLY', 'BROWSER_SANDBOX_POOL_TOKEN', 'BROWSER_SANDBOX_PREWARM',
    'BROWSER_SANDBOX_SKIP_RUN_DB', 'BROWSER_SANDBOX_MAX_SESSIONS', 'NODE_ENV',
].map(key => [key, process.env[key]]))

export const finishedRuns: string[] = []
let prepareBrowserRunMock: () => Promise<any> = async () => ({ allowed: true, run: null, quota: null })

mock.module('../../src/handlers/browserSandboxRuns.ts', () => ({
    browserPaidExtensionAllowed: async () => false,
    refreshBrowserRunLease: async () => undefined,
    finishBrowserRun: async (id: string) => { finishedRuns.push(id) },
    prepareBrowserRun: (input: { userId?: string; sessionToken?: string; clientId?: string }) => {
        const clientId = typeof input.clientId === 'string' ? input.clientId.trim() : ''
        if (!/^[a-zA-Z0-9_.:-]{8,160}$/.test(clientId)) return Promise.resolve({ allowed: false, quota: null, reason: 'identity_required' })
        return prepareBrowserRunMock()
    },
    updateBrowserRunProviderResult: async () => undefined,
    persistBrowserRunEvidence: async () => undefined,
}))

export function resetLifecycleTestState() {
    for (const [key, value] of originalEnvironment) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
    prepareBrowserRunMock = async () => ({ allowed: true, run: null, quota: null })
    finishedRuns.length = 0
}

export function mockBrowserRunPreparation(prepare: () => Promise<any>) {
    prepareBrowserRunMock = prepare
}

export class ControlledSocket extends EventEmitter {
    readonly OPEN = 1
    readyState = this.OPEN
    readonly messages: Record<string, unknown>[] = []
    closeCode = 1000
    closeReason = ''

    send(message: string) {
        const payload = JSON.parse(message) as Record<string, unknown>
        this.messages.push(payload)
        this.emit('payload', payload)
    }

    close(code = 1000, reason = '') {
        if (this.readyState !== this.OPEN) return
        this.closeCode = code
        this.closeReason = reason
        this.readyState = 3
        this.emit('close', code, Buffer.from(reason))
    }

    receive(payload: Record<string, unknown>) {
        this.emit('message', Buffer.from(JSON.stringify(payload)))
    }
}
