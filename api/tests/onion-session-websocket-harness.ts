import { EventEmitter } from 'node:events'
import { afterEach, mock } from 'bun:test'

export class FakePage extends EventEmitter {
    closed = false
    currentUrl = 'about:blank'
    editableSelections = 0
    readonly mouse = {
        clicks: [] as Array<{ x: number; y: number }>,
        moves: [] as Array<{ x: number; y: number }>,
        wheels: [] as Array<{ deltaX: number; deltaY: number }>,
        async click(x: number, y: number) { this.clicks.push({ x, y }) },
        async move(x: number, y: number) { this.moves.push({ x, y }) },
        async wheel(deltaX: number, deltaY: number) { this.wheels.push({ deltaX, deltaY }) },
        async down() {},
        async up() {},
    }
    readonly keyboard = {
        pressed: [] as string[],
        async press(key: string) { this.pressed.push(key) },
        async insertText(text: string) { void text },
    }

    async goto(url: string) { this.currentUrl = url; return null }
    url() { return this.currentUrl }
    title() { return this.currentUrl }
    mainFrame() { return this }
    viewportSize() { return { width: 1365, height: 768 } }
    isClosed() { return this.closed }
    setDefaultTimeout() {}
    async screenshot() { throw new Error('screenshot unavailable in restart test') }
    async evaluate<T>(callback: () => T): Promise<T> {
        const source = callback.toString()
        if (source.includes('active.select()')) {
            this.editableSelections++
            return true as T
        }
        if (source.includes('selectionStart')) return '' as T
        if (source.includes('return active.value')) return 'prior run form value' as T
        if (source.includes('navigator.clipboard')) return '' as T
        throw new Error('page evaluation unavailable in restart test')
    }
    async bringToFront() {}
    async waitForTimeout() {}
    async close() {
        if (this.closed) return
        this.closed = true
        this.emit('close')
    }
}

export class FakeContext {
    readonly pages: FakePage[] = []
    async exposeBinding() {}
    async addInitScript() {}
    async route() {}
    async newCDPSession() { return { send: async () => ({ windowId: 1 }), detach: async () => undefined } }
    async newPage() {
        const page = new FakePage()
        this.pages.push(page)
        return page
    }
    async close() { await Promise.all(this.pages.map(page => page.close())) }
}

export class FakeBrowser extends EventEmitter {
    readonly contexts: FakeContext[] = []
    async newContext() {
        const context = new FakeContext()
        this.contexts.push(context)
        return context
    }
    async close() {}
}

export class ControlledSocket extends EventEmitter {
    readonly OPEN = 1
    readyState = this.OPEN
    readonly messages: Record<string, any>[] = []
    send(message: string) {
        const payload = JSON.parse(message)
        this.messages.push(payload)
        this.emit('payload', payload)
    }
    close(code = 1000, reason = '') {
        if (this.readyState !== this.OPEN) return
        this.readyState = 3
        this.emit('close', code, Buffer.from(reason))
    }
    receive(payload: Record<string, unknown>) { this.emit('message', Buffer.from(JSON.stringify(payload))) }
}

export class FakeDownload {
    deleteCount = 0
    cancelCount = 0
    pathCount = 0
    constructor(readonly fileUrl: string, readonly getPath: () => Promise<string | null>) {}
    url() { return this.fileUrl }
    suggestedFilename() { return 'sample.bin' }
    path() { this.pathCount++; return this.getPath() }
    async cancel() { this.cancelCount++ }
    async delete() { this.deleteCount++ }
}

const originalEnvironment = new Map([
    'BROWSER_SANDBOX_WORKER_ONLY', 'BROWSER_SANDBOX_POOL_TOKEN', 'BROWSER_SANDBOX_PREWARM',
    'BROWSER_SANDBOX_SKIP_RUN_DB', 'BROWSER_SANDBOX_MAX_SESSIONS', 'ONION_SESSION_PROXY', 'NODE_ENV',
].map(key => [key, process.env[key]]))
let activeBrowser: FakeBrowser

mock.module('playwright', () => ({ chromium: { launch: async () => activeBrowser } }))
mock.module('../src/handlers/onionSession/analysis.ts', () => ({
    extractIndicators: () => ({ domains: [], ips: [], urls: [] }),
    extractThreatAssociations: () => [],
    inspectScript: () => ({}),
    isActionableObfuscatedScript: () => false,
    sandboxUrlSafety: () => ({ ok: true }),
    summarizeDeobfuscationTask: () => ({}),
}))
mock.module('../src/handlers/onionSession/webcrack.ts', () => ({
    watchWebCrackOutput: async () => undefined,
    readWebCrackOutput: async () => ({}),
    submitWebCrackSample: async () => ({}),
}))
mock.module('../src/handlers/onionSession/providerCapture.ts', () => ({ providerCaptureMessage: () => ({}) }))
mock.module('../src/handlers/browserSandboxRuns.ts', () => ({
    browserPaidExtensionAllowed: async () => false,
    refreshBrowserRunLease: async () => undefined,
    finishBrowserRun: async () => undefined,
    prepareBrowserRun: async (input: { userId?: string; sessionToken?: string; clientId?: string }) => {
        const clientId = typeof input.clientId === 'string' ? input.clientId.trim() : ''
        return /^[a-zA-Z0-9_.:-]{8,160}$/.test(clientId)
            ? { allowed: true, run: null, quota: null }
            : { allowed: false, quota: null, reason: 'identity_required' }
    },
    updateBrowserRunProviderResult: async () => undefined,
    persistBrowserRunEvidence: async () => undefined,
}))

afterEach(() => {
    for (const [key, value] of originalEnvironment) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
})

export function configureTestEnvironment() {
    process.env.NODE_ENV = 'test'
    process.env.BROWSER_SANDBOX_WORKER_ONLY = '0'
    delete process.env.BROWSER_SANDBOX_POOL_TOKEN
    process.env.BROWSER_SANDBOX_PREWARM = '0'
    process.env.BROWSER_SANDBOX_SKIP_RUN_DB = '1'
    process.env.BROWSER_SANDBOX_MAX_SESSIONS = '4'
    delete process.env.ONION_SESSION_PROXY
    activeBrowser = new FakeBrowser()
    return activeBrowser
}

export async function waitFor<T>(read: () => T | undefined, description: string): Promise<T> {
    const deadline = Date.now() + 2_000
    while (Date.now() < deadline) {
        const value = read()
        if (value !== undefined) return value
        await new Promise(resolve => setTimeout(resolve, 5))
    }
    throw new Error(`Timed out waiting for ${description}`)
}

export async function startRun(socket: ControlledSocket, target: string) {
    const readyCount = socket.messages.filter(message => message.type === 'ready').length
    socket.receive({ type: 'start', target, network: 'tor', clientId: 'restart-test-client' })
    await waitFor(() => {
        const ready = socket.messages.filter(message => message.type === 'ready')
        return ready.length > readyCount ? ready.at(-1) : undefined
    }, 'browser run readiness')
}

export async function endSession(socket: ControlledSocket) {
    const ended = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Onion session did not end')), 2_000)
        socket.on('payload', payload => {
            if (payload.type !== 'ended') return
            clearTimeout(timeout)
            resolve()
        })
    })
    socket.receive({ type: 'end' })
    await ended
    await waitFor(() => socket.readyState === 3 ? true : undefined, 'websocket close')
}
