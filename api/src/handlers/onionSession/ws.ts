import WebSocket from 'ws'
import { type SandboxNetworkEvent } from './networkTelemetry.ts'
import { collectPageEvidence } from './pageEvidence.ts'
import { providerRunResult } from './providerAnalysis.ts'
import type { SandboxToolAnalysis } from './providerTypes.ts'
import recordLog from '#utils/logs/recordLog.ts'
import { createSessionState } from './sessionState.ts'
import { createBrowserSupportService } from './browserSupport.ts'
import { createSessionLifecycleService } from './sessionLifecycle.ts'
import { createInputService } from './inputHandlers.ts'
import { createFrameCaptureService } from './frameCapture.ts'
import { createDocumentEvidenceService } from './documentEvidence.ts'
import { createNavigationService } from './navigationService.ts'
import { createSessionMessageHandler } from './messageHandler.ts'
import { attachSessionTransport } from './sessionTransport.ts'
import { createProviderProfileCaptureService } from './providerProfileCapture.ts'
import { createDownloadInspectionService } from './downloadInspection.ts'
import { prepareBrowserAdmission, acquireBrowserAdmission, launchBrowserContext } from './browserStartup.ts'
import { currentBrowserAdmissionStatus } from '../../utils/ws/browserAdmission.ts'
import type { BrokerMessage } from './protocol.ts'
import { updateBrowserRunProviderResult } from '../browserSandboxRuns.ts'
import { prestartedBrowser } from './browserRuntime.ts'
import { attachBrowserPageEvents } from './browserPageEvents.ts'
export { registerPrestartedBrowser } from './browserRuntime.ts'

export function handleOnionSessionSocket(connection: WebSocket, sessionId: string, defaultNetwork: 'tor' | 'regular' = 'tor') {
    const state = createSessionState()
    if (process.env.BROWSER_SANDBOX_POOL_TOKEN && !prestartedBrowser.connect(sessionId)) {
        connection.close(1008, 'Browser has not been reserved for this session.')
        return
    }

    const isCurrentRun = (generation: number) => generation === state.runGeneration && !state.closed

    const send = (payload: Record<string, unknown>) => {
        if (connection.readyState === connection.OPEN) {
            connection.send(JSON.stringify(payload))
        }
    }

    const trace = (event: string, detail: Record<string, unknown> = {}) => {
        if (process.env.BROWSER_SANDBOX_WORKER_ONLY !== '1') return
        console.warn(JSON.stringify({
            level: 'warn',
            category: 'browser_worker_lifecycle',
            sessionId,
            event,
            ...detail,
        }))
    }

    const frameCaptureRef: { current: ReturnType<typeof createFrameCaptureService> | null } = { current: null }
    const sendFrame = (force: boolean, reason = 'interval', generation = state.runGeneration) => frameCaptureRef.current!.sendFrame(force, reason, generation)
    const browserSupport = createBrowserSupportService({ state, send, isCurrentRun, sendFrame })
    const { newProviderPage, watchConsole, scheduleInteractionFrame } = browserSupport
    const downloads = createDownloadInspectionService({ state, send, isCurrentRun, newProviderPage, watchConsole, publishDownloads })
    const { watchDownloads } = downloads

    const lifecycle = createSessionLifecycleService({ state, connection, sessionId, send, trace, isCurrentRun, publishDownloads })
    const { cleanup, scheduleCloseTimer, extendRun, maybeExtendSuspiciousRun } = lifecycle
    const documentEvidence = createDocumentEvidenceService({ state, isCurrentRun, maybeExtendSuspiciousRun })
    const { rememberDeobfuscationTasks, queueDocumentEvidence, webCrackTasks } = documentEvidence
    const frameCapture = createFrameCaptureService({ state, connection, sessionId, send, networkSummary, trace, isCurrentRun, scheduleInteractionFrame: browserSupport.scheduleInteractionFrame, maybeExtendSuspiciousRun: lifecycle.maybeExtendSuspiciousRun, rememberDeobfuscationTasks })
    frameCaptureRef.current = frameCapture
    const navigation = createNavigationService({ state, sessionId, defaultNetwork, send, isCurrentRun, sendFrame, queueDocumentEvidence })
    const { navigate } = navigation
    const captureProfileTools = createProviderProfileCaptureService({ sessionId, isCurrentRun, send, webCrackTasks, newProviderPage, watchConsole, maybeExtendSuspiciousRun, persistProviderRunResult })

    const input = createInputService(state)
    const messageHandler = createSessionMessageHandler({
        state, connection, sessionId, send, startBrowser, cleanup,
        extendRun, navigate, sendFrame, scheduleInteractionFrame,
        handlePointer: input.handlePointer, handleWheel: input.handleWheel,
        handleKey: input.handleKey, readRemoteClipboard: input.readRemoteClipboard,
    })
    attachSessionTransport({ state, connection, sessionId, send, trace, cleanup, handleMessage: messageHandler })

    async function startBrowser(message: BrokerMessage) {
        await cleanup()
        if (state.sessionEnding) return
        // cleanup above resets browser-owned state; initialize only new-run telemetry here.
        const startup = await prepareBrowserAdmission(message, { state, sessionId, defaultNetwork, cleanup, isCurrentRun, send, connection })
        if (!startup) return
        const { message: preparedMessage, generation, target, network, proxy, durationMs, browserRun } = startup
        message = preparedMessage

        try {
            const slot = await acquireBrowserAdmission(state, sessionId, send)
            if (!slot) return
            await launchBrowserContext({ state, message, sessionId, generation, target, network, proxy, slot, isCurrentRun, trackNetwork, send, trace })
            await attachBrowserPageEvents({ state, context: state.context!, page: state.page!, network, generation, sessionId, isCurrentRun, trackNetwork, send, sendFrame, watchConsole, watchDownloads, queueDocumentEvidence })

            state.runStartedAt = Date.now()
            state.runExpiresAt = state.runStartedAt + durationMs
            scheduleCloseTimer('started')

            trace('navigate_start', { target })
            await navigate(target, generation)
            if (!isCurrentRun(generation)) return
            trace('navigate_returned', { url: state.page?.url() })
            await Promise.allSettled(state.documentEvidencePromises)
            if (!isCurrentRun(generation)) return
            trace('document_evidence_settled')
            const initialEvidence = state.page ? await collectPageEvidence(state.page).catch(() => null) : null
            if (!isCurrentRun(generation)) return
            trace('initial_evidence_collected', { hasEvidence: Boolean(initialEvidence) })
            maybeExtendSuspiciousRun(initialEvidence, null, generation)
            rememberDeobfuscationTasks(initialEvidence)
            void captureProfileTools(
                message.profileTools || [],
                target,
                initialEvidence?.deobfuscationTasks?.length ? initialEvidence.deobfuscationTasks : state.cachedDeobfuscationTasks,
                generation,
                state.currentRunId,
            ).catch(error => {
                if (!isCurrentRun(generation)) return
                send({
                    type: 'status',
                    state: 'profile_tools_failed',
                    sessionId,
                    message: error instanceof Error ? error.message : String(error),
                })
            })
            send({
                type: 'ready',
                sessionId,
                target,
                network,
                torProxyConfigured: Boolean(proxy),
                capacity: currentBrowserAdmissionStatus(),
                run: browserRun.run,
                quota: browserRun.quota,
            })
            void sendFrame(true, 'initial_target', generation)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            void recordLog({
                level: 'error',
                service: 'hanasand-api',
                message: `Browser run failed for ${target}: ${message}`,
                metadata: {
                    category: 'browser_run_failure',
                    sessionId,
                    target,
                    network,
                    runId: state.currentRunId,
                    hasPage: Boolean(state.page),
                    hasContext: Boolean(state.context),
                    hasBrowser: Boolean(state.browser),
                    lastUrl: state.page?.url(),
                    runStatus: 'failed',
                },
            }).catch(() => undefined)
            send({ type: 'status', state: 'failed', sessionId, message })
            send({ type: 'ended', reason: 'launch_failed', sessionId, message })
            await cleanup('failed')
        }
    }

    function persistProviderRunResult(analysis: SandboxToolAnalysis | undefined, error: string, runId: string | null, generation: number) {
        if (!isCurrentRun(generation) || !runId || !analysis?.toolKind) return
        const result = providerRunResult(analysis, error)
        if (!result) return
        void updateBrowserRunProviderResult(runId, analysis.toolKind, result).catch(() => undefined)
    }

    function trackNetwork(event: SandboxNetworkEvent) {
        state.networkTelemetry.record(event)
    }

    function networkSummary() {
        return state.networkTelemetry.summary()
    }

    function publishDownloads() {
        if (state.downloadCount) send({ type: 'downloads', networkSummary: networkSummary() })
    }




}
