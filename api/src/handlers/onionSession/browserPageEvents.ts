import type { BrowserContext, Page, Request, Response } from 'playwright'
import { fullscreenBrowserPage, lookupAsn, requestInitiator, responseDurationMs, elapsedMs } from './networkEvidence.ts'
import { domainFromUrl, type SandboxNetworkEvent } from './networkTelemetry.ts'
import { sandboxRequestSafety } from './sandboxSafety.ts'
import type { SessionState } from './sessionState.ts'

interface BrowserPageEventDependencies {
    state: SessionState
    context: BrowserContext
    page: Page
    network: 'tor' | 'regular'
    generation: number
    sessionId: string
    isCurrentRun: (generation: number) => boolean
    trackNetwork: (event: SandboxNetworkEvent) => void
    send: (payload: Record<string, unknown>) => void
    sendFrame: (force: boolean, reason?: string, generation?: number) => Promise<void>
    watchConsole: (page: Page, generation: number) => void
    watchDownloads: (page: Page, generation: number) => void
    queueDocumentEvidence: (html: Promise<string>, generation: number) => void
}

export async function attachBrowserPageEvents(deps: BrowserPageEventDependencies) {
    const { state, context, page, network, generation, sessionId, isCurrentRun, trackNetwork, send, sendFrame, watchConsole, watchDownloads, queueDocumentEvidence } = deps
    await fullscreenBrowserPage(context, page)
    watchConsole(page, generation)
    page.on('request', (request: Request) => {
        if (!isCurrentRun(generation)) return
        trackNetwork({ kind: 'request', url: request.url(), method: request.method(), resourceType: request.resourceType(), at: new Date().toISOString() })
    })
    page.on('response', async (response: Response) => {
        const [server, security] = await Promise.all([
            response.serverAddr().catch(() => null),
            response.securityDetails().catch(() => null),
        ])
        if (!isCurrentRun(generation)) return
        const request = response.request()
        if (network === 'regular' && server?.ipAddress && request.isNavigationRequest() && request.frame() === state.page?.mainFrame() && response.status() < 300) state.networkTelemetry.site = { url: response.url(), ip: server.ipAddress }
        const asn = await lookupAsn(server?.ipAddress)
        if (!isCurrentRun(generation)) return
        const capturedAt = new Date().toISOString()
        const startedAt = state.networkTelemetry.requestStartedAt(response.url(), request.method())
        trackNetwork({
            kind: 'response', url: response.url(), method: request.method(), resourceType: request.resourceType(), status: response.status(),
            host: domainFromUrl(response.url()), mimeType: response.headers()['content-type'], initiator: requestInitiator(request),
            durationMs: responseDurationMs(request.timing()) ?? elapsedMs(startedAt, capturedAt), ip: server?.ipAddress, asn, port: server?.port,
            protocol: security?.protocol, tlsIssuer: security?.issuer, tlsSubject: security?.subjectName,
            tlsValidFrom: security?.validFrom, tlsValidTo: security?.validTo, at: capturedAt,
        })
        if (request.resourceType() === 'document' && /html/i.test(response.headers()['content-type'] || '')) queueDocumentEvidence(response.text(), generation)
    })
    page.on('requestfailed', request => {
        if (!isCurrentRun(generation)) return
        trackNetwork({ kind: 'failed', url: request.url(), method: request.method(), resourceType: request.resourceType(), failure: request.failure()?.errorText || 'request failed', at: new Date().toISOString() })
    })
    watchDownloads(page, generation)
    page.on('framenavigated', frame => {
        if (!isCurrentRun(generation) || frame !== state.page?.mainFrame()) return
        send({ type: 'status', state: 'navigated', url: state.page.url(), sessionId })
        void sendFrame(true, 'navigation', generation)
    })
    page.on('domcontentloaded', () => {
        if (!isCurrentRun(generation)) return
        send({ type: 'status', state: 'domcontentloaded', url: state.page?.url(), sessionId, message: 'Captured DOM-ready browser state.' })
        void sendFrame(true, 'domcontentloaded', generation)
    })
    page.on('load', () => {
        if (!isCurrentRun(generation)) return
        send({ type: 'status', state: 'loaded', url: state.page?.url(), sessionId, message: 'Captured loaded browser state.' })
        void sendFrame(true, 'load', generation)
    })
}

export async function installSandboxRequestGuard(deps: {
    context: BrowserContext
    generation: number
    isCurrentRun: (generation: number) => boolean
    trackNetwork: (event: SandboxNetworkEvent) => void
    send: (payload: Record<string, unknown>) => void
}) {
    const { context, generation, isCurrentRun, trackNetwork, send } = deps
    await context.route('**/*', async route => {
        const request = route.request()
        const requestUrl = request.url()
        const safety = await sandboxRequestSafety(requestUrl)
        if (!isCurrentRun(generation)) return void await route.abort('aborted').catch(() => undefined)
        if (!safety.ok) {
            trackNetwork({ kind: 'failed', url: requestUrl, method: request.method(), resourceType: request.resourceType(), failure: `blocked unsafe sandbox request: ${safety.reason}`, at: new Date().toISOString() })
            send({ type: 'status', state: 'unsafe_request_blocked', url: requestUrl, message: `Blocked unsafe sandbox request: ${safety.reason}.` })
            return void await route.abort('blockedbyclient').catch(() => undefined)
        }
        await route.continue().catch(() => undefined)
    })
}
