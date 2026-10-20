import type WebSocket from 'ws'
import { chromium } from 'playwright'
import { browserStartOptions } from '../../utils/ws/browserAccess.ts'
import { requestBrowserAdmission, type BrowserAdmissionStatus } from '../../utils/ws/browserAdmission.ts'
import { prepareBrowserRun, refreshBrowserRunLease } from '../browserSandboxRuns.ts'
import { DEFAULT_TARGET, normalizeTarget, type BrokerMessage } from './protocol.ts'
import { browserProfileForMessage } from './browserProfile.ts'
import { resizeBrowserDisplay } from './networkEvidence.ts'
import { assertProductionBrowserWorker, chromiumLaunchOptions, DEFAULT_DURATION_MS, MAX_DURATION_MS, prestartedBrowser, regularBrowser } from './browserRuntime.ts'
import { installSandboxRequestGuard } from './browserPageEvents.ts'
import type { SessionState } from './sessionState.ts'

export async function prepareBrowserAdmission(message: BrokerMessage, deps: {
    state: SessionState
    sessionId: string
    defaultNetwork: 'tor' | 'regular'
    cleanup: (status?: 'ended' | 'failed' | 'unreachable') => Promise<void>
    isCurrentRun: (generation: number) => boolean
    send: (payload: Record<string, unknown>) => void
    connection: WebSocket
}) {
    const { state, sessionId, defaultNetwork, cleanup, isCurrentRun, send, connection } = deps
    assertProductionBrowserWorker()
    state.closed = false
    const generation = state.runGeneration
    const target = normalizeTarget(message.target || DEFAULT_TARGET)
    const network = message.network === 'regular' || message.network === 'tor' ? message.network : defaultNetwork
    const proxy = network === 'tor' ? process.env.ONION_SESSION_PROXY || process.env.TOR_SOCKS_PROXY || '' : ''
    const browserRun = process.env.BROWSER_SANDBOX_SKIP_RUN_DB === '1'
        ? { allowed: true as const, run: null, quota: null }
        : await prepareBrowserRun({ id: sessionId, target, network, clientId: message.clientId, userId: message.userId, sessionToken: message.sessionToken })
    if (state.sessionEnding) {
        if (browserRun.allowed && browserRun.run) {
            state.currentRunId = browserRun.run.id
            await cleanup()
        }
        return null
    }
    if (!browserRun.allowed) {
        send({ type: 'status', state: browserRun.reason, sessionId, network, quota: browserRun.quota, message: 'Close an active browser or upgrade for more simultaneous runs.' })
        send({ type: 'ended', reason: browserRun.reason, sessionId })
        connection.close()
        return null
    }
    if (browserRun.quota) message = browserStartOptions(message as unknown as Record<string, unknown>, browserRun.quota) as BrokerMessage
    const requestedDurationMs = Number(message.durationSeconds) > 0
        ? Number(message.durationSeconds) * 1000
        : Number(message.durationMinutes) > 0 ? Number(message.durationMinutes) * 60_000 : DEFAULT_DURATION_MS
    const durationMs = Math.min(MAX_DURATION_MS, Math.max(60_000, requestedDurationMs))
    state.currentRunId = browserRun.run?.id || null
    state.network = network
    if (state.currentRunId) {
        const runId = state.currentRunId
        state.runLeaseTimer = setInterval(() => {
            if (!isCurrentRun(generation)) return
            void refreshBrowserRunLease(runId).catch(() => {
                if (!isCurrentRun(generation)) return
                void cleanup('failed')
                connection.close()
            })
        }, 30_000)
        state.runLeaseTimer.unref()
    }
    return { message, generation, target, network, proxy, durationMs, browserRun }
}

export async function acquireBrowserAdmission(state: SessionState, sessionId: string, send: (payload: Record<string, unknown>) => void) {
    const admission = requestBrowserAdmission(sessionId, send)
    state.cancelAdmission = admission?.cancel || null
    let resolveAdmissionWait: (value: null) => void = () => undefined
    const admissionWaitCancelled = new Promise<null>(resolve => { resolveAdmissionWait = resolve })
    const cancelThisAdmissionWait = () => resolveAdmissionWait(null)
    state.cancelAdmissionWait = cancelThisAdmissionWait
    const slot = admission ? await Promise.race([admission.promise, admissionWaitCancelled]) : null
    if (state.cancelAdmissionWait === cancelThisAdmissionWait) state.cancelAdmissionWait = null
    state.cancelAdmission = null
    if (!slot) return null
    if (state.closed) {
        slot.release()
        return null
    }
    state.releaseAdmission = slot.release
    return slot
}

export async function launchBrowserContext(input: {
    state: SessionState
    message: BrokerMessage
    sessionId: string
    generation: number
    target: string
    network: 'tor' | 'regular'
    proxy: string
    slot: { release: () => void; status: BrowserAdmissionStatus }
    syncVisibleRemoteTab: (page: import('playwright').Page, generation: number) => void
    isCurrentRun: (generation: number) => boolean
    trackNetwork: (event: import('./networkTelemetry.ts').SandboxNetworkEvent) => void
    send: (payload: Record<string, unknown>) => void
    trace: (event: string, detail?: Record<string, unknown>) => void
}) {
    const { state, message, sessionId, generation, target, network, proxy, slot, syncVisibleRemoteTab, isCurrentRun, trackNetwork, send, trace } = input
    send({
        type: 'status', state: 'launching', sessionId, network, torProxyConfigured: Boolean(proxy), capacity: slot?.status,
        message: network === 'regular'
            ? 'Launching isolated regular-web browser with a fresh context.'
            : proxy ? 'Launching isolated browser through configured Tor proxy.' : 'Launching isolated browser without Tor proxy; configure ONION_SESSION_PROXY or TOR_SOCKS_PROXY for onion routing.',
    })
    state.ownsBrowser = Boolean(proxy || network !== 'regular' || process.env.BROWSER_SANDBOX_WORKER_ONLY === '1')
    const profile = browserProfileForMessage(message, network)
    if (process.env.BROWSER_SANDBOX_WORKER_ONLY === '1') await resizeBrowserDisplay(profile.viewport)
    trace('launch_chromium', { target, network, ownsBrowser: state.ownsBrowser })
    if (process.env.BROWSER_SANDBOX_POOL_TOKEN) {
        if (proxy || network !== 'regular') throw new Error('Prestarted browser requires regular network mode.')
        state.browser = prestartedBrowser.take(sessionId)
    } else state.browser = state.ownsBrowser ? await chromium.launch(chromiumLaunchOptions(proxy)) : await regularBrowser()
    trace('chromium_launched')
    state.context = await state.browser.newContext({ ...profile.options, serviceWorkers: 'block' })
    trace('context_created')
    await state.context.exposeBinding('__hanasandRemoteTabSelected', ({ page }) => {
        if (isCurrentRun(generation)) return syncVisibleRemoteTab(page, generation)
    })
    await state.context.addInitScript((platform) => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
        if (platform) Object.defineProperty(navigator, 'platform', { get: () => platform })
    }, profile.platform)
    await state.context.addInitScript(() => {
        const reportVisibleTab = () => {
            if (document.visibilityState !== 'visible') return
            const notify = (window as unknown as { __hanasandRemoteTabSelected?: () => Promise<void> }).__hanasandRemoteTabSelected
            void notify?.()
        }
        document.addEventListener('visibilitychange', reportVisibleTab)
    })
    await installSandboxRequestGuard({ context: state.context, generation, network, isCurrentRun, trackNetwork, send })
    state.page = await state.context.newPage()
    trace('page_created')
}
