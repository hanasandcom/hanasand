import type WebSocket from 'ws'
import { finishBrowserRun } from '../browserSandboxRuns.ts'
import type { SessionState } from './sessionState.ts'
import type { BrokerMessage } from './protocol.ts'
import type { SandboxToolAnalysis } from './providerTypes.ts'
import { MAX_DURATION_MS, MANUAL_EXTENSION_MS, SUSPICIOUS_DURATION_MS } from './browserRuntime.ts'

type SessionLifecycleDependencies = {
    state: SessionState
    connection: WebSocket
    sessionId: string
    send: (payload: Record<string, unknown>) => void
    trace: (event: string, detail?: Record<string, unknown>) => void
    isCurrentRun: (generation: number) => boolean
    publishDownloads: () => void
}

export function createSessionLifecycleService({ state, connection, sessionId, send, trace, isCurrentRun, publishDownloads }: SessionLifecycleDependencies) {
    function resetRunTelemetry() {
        state.remoteClipboard = ''
        state.editableSelectAllArmed = false
        state.networkTelemetry.reset()
        state.downloadTargets.clear()
        state.documentEvidencePromises = []
        state.downloadCount = 0
        state.fileLookups.clear()
        state.fileLookupQueue = Promise.resolve()
        state.downloadsInFlight = 0
        state.lastFrame = ''
        state.firstFrameAttemptedAt = 0
        state.lastHeavyFrameAt = 0
        state.fastFrameInFlight = false
        state.cachedDeobfuscationTasks = []
        state.cachedThreatAssociations = []
        state.cachedIndicators = null
        state.cachedFrameQuality = null
        state.cachedPageEvidence = null
        state.openingBackgroundTabs = 0
    }

    async function cleanup(runStatus: 'ended' | 'failed' | 'unreachable' = state.terminalRunStatus) {
        state.runGeneration++
        trace('cleanup', { runStatus, hasPage: Boolean(state.page), hasContext: Boolean(state.context), ownsBrowser: state.ownsBrowser })
        state.closed = true
        if (state.runLeaseTimer) clearInterval(state.runLeaseTimer)
        state.runLeaseTimer = null
        state.networkTelemetry.interruptDownloads()
        publishDownloads()
        state.cancelAdmission?.()
        state.cancelAdmission = null
        state.cancelAdmissionWait?.()
        state.cancelAdmissionWait = null
        state.releaseAdmission?.()
        state.releaseAdmission = null
        if (state.closeTimer) clearTimeout(state.closeTimer)
        if (state.interactionFrameTimer) clearTimeout(state.interactionFrameTimer)
        state.interactionFrameTimer = null
        state.closeTimer = null
        const runId = state.currentRunId
        state.currentRunId = null
        if (runId) {
            const title = state.page ? await state.page.title().catch(() => '') : ''
            await finishBrowserRun(runId, runStatus, title).catch(() => undefined)
        }
        state.terminalRunStatus = 'ended'
        state.toolPages.clear()
        await state.context?.close().catch(() => undefined)
        if (state.ownsBrowser) await state.browser?.close().catch(() => undefined)
        resetRunTelemetry()
        state.context = null
        state.browser = null
        state.page = null
        state.activeRemoteTabId = 'browser'
        state.runStartedAt = 0
        state.runExpiresAt = 0
        state.suspiciousExtensionApplied = false
        state.freeExtensionUsed = false
        state.paidExtensionUsed = false
        state.ownsBrowser = false
    }

    function sendRunTiming(reason: string) {
        if (!state.runStartedAt || !state.runExpiresAt) return
        send({
            type: 'run_time',
            sessionId,
            startedAt: new Date(state.runStartedAt).toISOString(),
            expiresAt: new Date(state.runExpiresAt).toISOString(),
            remainingSeconds: Math.max(0, Math.ceil((state.runExpiresAt - Date.now()) / 1000)),
            suspiciousExtended: state.suspiciousExtensionApplied,
            freeExtensionUsed: state.freeExtensionUsed,
            paidExtensionUsed: state.paidExtensionUsed,
            reason,
        })
    }

    function scheduleCloseTimer(reason: string) {
        if (state.closeTimer) clearTimeout(state.closeTimer)
        const generation = state.runGeneration
        const delay = Math.max(0, state.runExpiresAt - Date.now())
        state.closeTimer = setTimeout(() => {
            if (!isCurrentRun(generation)) return
            send({ type: 'ended', reason: 'timeout', sessionId })
            void cleanup().finally(() => connection.close())
        }, delay)
        sendRunTiming(reason)
    }

    function extendRun(extension: BrokerMessage['extension'], paidAuthorized: boolean) {
        if (!state.runStartedAt || !state.runExpiresAt) {
            send({ type: 'status', state: 'extension_unavailable', message: 'The browser run has not started yet.' })
            return
        }
        if (extension === 'free') {
            if (state.freeExtensionUsed) {
                send({ type: 'status', state: 'extension_used', message: 'The included five-minute extension has already been used.' })
                return
            }
            state.freeExtensionUsed = true
        } else if (extension === 'paid') {
            if (!state.freeExtensionUsed || state.paidExtensionUsed || !paidAuthorized) {
                send({ type: 'status', state: paidAuthorized ? 'extension_used' : 'payment_required', message: paidAuthorized ? 'No additional extension is available for this run.' : 'A paid browser plan is required for the second five-minute extension.' })
                return
            }
            state.paidExtensionUsed = true
        } else {
            return
        }
        state.runExpiresAt = Math.min(state.runStartedAt + MAX_DURATION_MS, Math.max(Date.now(), state.runExpiresAt) + MANUAL_EXTENSION_MS)
        scheduleCloseTimer(extension === 'paid' ? 'paid_extension' : 'free_extension')
        send({ type: 'status', state: 'run_extended', message: 'Browser run extended by five minutes.' })
    }

    function maybeExtendSuspiciousRun(evidence?: { verdict?: string } | null, analysis?: SandboxToolAnalysis | null, generation = state.runGeneration) {
        if (!isCurrentRun(generation) || state.suspiciousExtensionApplied || !state.runStartedAt || !state.runExpiresAt) return
        const suspicious = evidence?.verdict === 'suspicious'
            || analysis?.verdict === 'suspicious'
            || Number(analysis?.vendorFlagged || 0) > 0
            || Number(analysis?.alertCount || 0) > 0
        if (!suspicious) return
        state.suspiciousExtensionApplied = true
        state.runExpiresAt = Math.max(state.runExpiresAt, state.runStartedAt + SUSPICIOUS_DURATION_MS)
        scheduleCloseTimer('suspicious_evidence')
        send({ type: 'status', state: 'suspicious_time_extension', message: 'Suspicious evidence detected; run extended to at least three minutes.' })
    }

    return { resetRunTelemetry, cleanup, sendRunTiming, scheduleCloseTimer, extendRun, maybeExtendSuspiciousRun }
}
