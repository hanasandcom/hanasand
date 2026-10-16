import { EventEmitter } from 'node:events'
import { afterEach, expect, mock, test } from 'bun:test'

class FakePage extends EventEmitter {
    closed = false
    currentUrl = 'about:blank'
    editableSelections = 0
    readonly keyboard = {
        pressed: [] as string[],
        async press(key: string) { this.pressed.push(key) },
        async insertText(text: string) { void text },
    }

    async goto(url: string) {
        this.currentUrl = url
        return null
    }

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

class FakeContext {
    readonly pages: FakePage[] = []

    async exposeBinding() {}
    async addInitScript() {}
    async route() {}
    async newCDPSession() {
        return { send: async () => ({ windowId: 1 }), detach: async () => undefined }
    }
    async newPage() {
        const page = new FakePage()
        this.pages.push(page)
        return page
    }
    async close() {
        await Promise.all(this.pages.map(page => page.close()))
    }
}

class FakeBrowser extends EventEmitter {
    readonly contexts: FakeContext[] = []

    async newContext() {
        const context = new FakeContext()
        this.contexts.push(context)
        return context
    }
    async close() {}
}

class ControlledSocket extends EventEmitter {
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
    receive(payload: Record<string, unknown>) {
        this.emit('message', Buffer.from(JSON.stringify(payload)))
    }
}

class FakeDownload {
    deleteCount = 0
    cancelCount = 0
    pathCount = 0

    constructor(readonly fileUrl: string, readonly getPath: () => Promise<string | null>) {}
    url() { return this.fileUrl }
    suggestedFilename() { return 'sample.bin' }
    path() {
        this.pathCount++
        return this.getPath()
    }
    async cancel() { this.cancelCount++ }
    async delete() { this.deleteCount++ }
}

const originalEnvironment = new Map([
    'BROWSER_SANDBOX_WORKER_ONLY', 'BROWSER_SANDBOX_POOL_TOKEN', 'BROWSER_SANDBOX_PREWARM',
    'BROWSER_SANDBOX_SKIP_RUN_DB', 'BROWSER_SANDBOX_MAX_SESSIONS', 'ONION_SESSION_PROXY', 'NODE_ENV',
].map(key => [key, process.env[key]]))

let browser: FakeBrowser
mock.module('playwright', () => ({ chromium: { launch: async () => browser } }))
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

function configureTestEnvironment() {
    process.env.NODE_ENV = 'test'
    process.env.BROWSER_SANDBOX_WORKER_ONLY = '0'
    delete process.env.BROWSER_SANDBOX_POOL_TOKEN
    process.env.BROWSER_SANDBOX_PREWARM = '0'
    process.env.BROWSER_SANDBOX_SKIP_RUN_DB = '1'
    process.env.BROWSER_SANDBOX_MAX_SESSIONS = '4'
    delete process.env.ONION_SESSION_PROXY
}

async function waitFor<T>(read: () => T | undefined, description: string): Promise<T> {
    const deadline = Date.now() + 2_000
    while (Date.now() < deadline) {
        const value = read()
        if (value !== undefined) return value
        await new Promise(resolve => setTimeout(resolve, 5))
    }
    throw new Error(`Timed out waiting for ${description}`)
}

async function startRun(socket: ControlledSocket, target: string) {
    const readyCount = socket.messages.filter(message => message.type === 'ready').length
    socket.receive({ type: 'start', target, network: 'tor', clientId: 'restart-test-client' })
    await waitFor(() => {
        const ready = socket.messages.filter(message => message.type === 'ready')
        return ready.length > readyCount ? ready.at(-1) : undefined
    }, 'browser run readiness')
}

async function endSession(socket: ControlledSocket) {
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

test('restarting an onion session resets per-run download limits and summaries', async () => {
    configureTestEnvironment()
    browser = new FakeBrowser()
    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const socket = new ControlledSocket()
    handleOnionSessionSocket(socket as never, 'restart-download-reset', 'regular')

    try {
        await startRun(socket, 'https://8.8.8.8/first')
        const firstPage = browser.contexts[0].pages[0]
        for (let index = 0; index < 10; index++) {
            const download = new FakeDownload(`https://files.example/${index}`, async () => null)
            firstPage.emit('download', download)
            await waitFor(() => download.deleteCount === 1 ? true : undefined, `first-run download ${index + 1}`)
        }

        await startRun(socket, 'https://8.8.8.8/second')
        const secondPage = browser.contexts[1].pages[0]
        const nextDownload = new FakeDownload('https://files.example/next', async () => null)
        secondPage.emit('download', nextDownload)
        await waitFor(() => nextDownload.deleteCount === 1 ? true : undefined, 'second-run download')

        expect(socket.messages.some(message => message.state === 'download_limit')).toBe(false)
        const latestSummary = socket.messages.filter(message => message.type === 'downloads').at(-1)?.networkSummary
        expect(latestSummary.downloads).toHaveLength(1)
        expect(latestSummary.downloads[0]).toMatchObject({ id: 'file-1', url: 'https://files.example/next' })
    } finally {
        await endSession(socket)
    }
})

test('restarting and ending an onion session close the retired and current pages', async () => {
    configureTestEnvironment()
    browser = new FakeBrowser()
    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const socket = new ControlledSocket()
    handleOnionSessionSocket(socket as never, 'restart-page-cleanup', 'regular')
    let currentPage: FakePage | undefined

    try {
        await startRun(socket, 'https://8.8.8.8/first')
        const retiredPage = browser.contexts[0].pages[0]

        await startRun(socket, 'https://8.8.8.8/second')
        currentPage = browser.contexts[1].pages[0]

        expect(retiredPage.isClosed()).toBe(true)
    } finally {
        await endSession(socket)
    }

    expect(currentPage?.isClosed()).toBe(true)
})

test('a prior run download cannot release a later run transfer slot', async () => {
    configureTestEnvironment()
    browser = new FakeBrowser()
    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const socket = new ControlledSocket()
    handleOnionSessionSocket(socket as never, 'restart-download-race', 'regular')
    let resolveOldPath!: (path: string | null) => void
    const oldPath = new Promise<string | null>(resolve => { resolveOldPath = resolve })
    const resolveActivePaths: Array<(path: string | null) => void> = []
    const activeDownloads: FakeDownload[] = []

    try {
        await startRun(socket, 'https://8.8.8.8/first')
        const firstPage = browser.contexts[0].pages[0]
        const oldDownload = new FakeDownload('https://files.example/old', () => oldPath)
        firstPage.emit('download', oldDownload)

        await startRun(socket, 'https://8.8.8.8/second')
        const secondPage = browser.contexts[1].pages[0]
        activeDownloads.push(...[0, 1].map(index => new FakeDownload(
            `https://files.example/active-${index}`,
            () => new Promise<string | null>(resolve => resolveActivePaths.push(resolve)),
        )))
        activeDownloads.forEach(download => secondPage.emit('download', download))
        await waitFor(() => activeDownloads.every(download => download.pathCount === 1) ? true : undefined, 'active second-run downloads')

        resolveOldPath(null)
        await waitFor(() => oldDownload.deleteCount === 1 ? true : undefined, 'retired download cleanup')

        const rejectedDownload = new FakeDownload('https://files.example/rejected', async () => null)
        secondPage.emit('download', rejectedDownload)
        await waitFor(() => socket.messages.some(message => message.state === 'download_limit') ? true : undefined, 'second-run transfer limit')
        expect(rejectedDownload.cancelCount).toBe(1)
        expect(socket.messages.filter(message => message.type === 'downloads').at(-1)?.networkSummary.downloads.map((file: any) => file.url))
            .toEqual(['https://files.example/active-0', 'https://files.example/active-1'])
    } finally {
        resolveOldPath(null)
        for (const resolve of resolveActivePaths) resolve(null)
        await Promise.all([...activeDownloads].map(download => waitFor(() => download.deleteCount === 1 ? true : undefined, 'active download cleanup')))
        await endSession(socket)
    }
})

test('restarting clears editable select-all state before a later copy', async () => {
    configureTestEnvironment()
    browser = new FakeBrowser()
    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const socket = new ControlledSocket()
    handleOnionSessionSocket(socket as never, 'restart-editable-select-all', 'regular')

    try {
        await startRun(socket, 'https://8.8.8.8/first')
        const firstPage = browser.contexts[0].pages[0]
        socket.receive({ type: 'key', key: 'a', ctrlKey: true })
        await waitFor(() => firstPage.editableSelections === 1 ? true : undefined, 'first-run editable select-all')

        await startRun(socket, 'https://8.8.8.8/second')
        const secondPage = browser.contexts[1].pages[0]
        socket.receive({ type: 'key', key: 'c', ctrlKey: true })
        await waitFor(() => secondPage.keyboard.pressed.includes('Control+C') ? true : undefined, 'second-run copy')
        socket.receive({ type: 'clipboard', direction: 'remote-to-browser' })
        const clipboard = await waitFor(() => socket.messages.find(message =>
            message.type === 'clipboard' && message.direction === 'remote-to-browser'), 'second-run clipboard response')

        expect(clipboard.text).toBe('')
    } finally {
        await endSession(socket)
    }
})

test('a late response from a prior run cannot enter the next run summary', async () => {
    configureTestEnvironment()
    browser = new FakeBrowser()
    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const socket = new ControlledSocket()
    handleOnionSessionSocket(socket as never, 'restart-response-race', 'regular')
    let resolveServerAddress!: (address: null) => void
    const serverAddress = new Promise<null>(resolve => { resolveServerAddress = resolve })

    try {
        await startRun(socket, 'https://8.8.8.8/first')
        const firstPage = browser.contexts[0].pages[0]
        const oldRequest = {
            isNavigationRequest: () => false,
            frame: () => ({ url: () => 'https://8.8.8.8/first' }),
            resourceType: () => 'image',
            method: () => 'GET',
            timing: () => ({ startTime: 0, responseEnd: 1 }),
        }
        firstPage.emit('response', {
            serverAddr: () => serverAddress,
            securityDetails: async () => null,
            request: () => oldRequest,
            status: () => 200,
            url: () => 'https://old-run.example/image.png',
            headers: () => ({ 'content-type': 'image/png' }),
        })

        await startRun(socket, 'https://8.8.8.8/second')
        resolveServerAddress(null)
        await new Promise(resolve => setImmediate(resolve))

        const secondPage = browser.contexts[1].pages[0]
        const download = new FakeDownload('https://files.example/current', async () => null)
        secondPage.emit('download', download)
        await waitFor(() => download.deleteCount === 1 ? true : undefined, 'second-run network summary')

        const summary = socket.messages.filter(message => message.type === 'downloads').at(-1)?.networkSummary
        expect(summary.responseCount).toBe(0)
        expect(summary.domains).not.toContain('old-run.example')
    } finally {
        resolveServerAddress(null)
        await endSession(socket)
    }
})
