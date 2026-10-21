import type { SiteNetwork } from '../SiteNetworkDetails'
import { finiteNumber, capacityValue, quotaValue, stringValue } from '../browserValues'
import { runHistoryValue, sanitizeHistory, persistHistory } from '../historyData'
import { streamUrlForPath, historyApiPath } from '../browserSetup'
import type { BrowserSocketMessageContext } from './browserSocketMessageTypes'
import { getOrCreateBrowserClientId } from '../browserClientId'

export function handleBrowserConnectionMessage(context: BrowserSocketMessageContext) {
    const { payload, socket, runState, override, id, url, runNetwork, socketRef, receivedEvidenceRef, recoveryDeadlineRef, replaceSandbox, refreshRunStats, pushEvent, setSocketState, setStreamUrl, setCaptures, setStreamStats, setRunTiming, setClockNow, setCapacity, setHistory, setQuota, setSessionState, setRunBlocker } = context

    if (payload.type === 'reconnected') { setSocketState('open'); return }
    if (payload.type === 'resume_unavailable') { replaceSandbox(); return }
    if (payload.type === 'stream_ready' && typeof payload.streamUrl === 'string') {
        setStreamUrl(streamUrlForPath(payload.streamUrl))
        pushEvent('WebRTC browser stream ready.')
        return
    }
    if (payload.type === 'site_network' && payload.site && typeof payload.site === 'object') {
        const site = payload.site as SiteNetwork
        setCaptures(current => current.map(capture => capture.kind === 'page' && (capture.networkSummary?.site ? capture.networkSummary.site.url === site.url && capture.networkSummary.site.ip === site.ip : capture.url === site.url)
            ? { ...capture, networkSummary: { ...capture.networkSummary, site } } : capture))
        return
    }
    if (payload.type === 'stream_metrics') {
        setStreamStats({ fps: finiteNumber(payload.fps) || undefined, latencyMs: finiteNumber(payload.latencyMs) || undefined })
        return
    }
    if (payload.type === 'run_time' && typeof payload.expiresAt === 'string') {
        const deadline = Date.parse(payload.expiresAt)
        if (Number.isFinite(deadline) && (!override?.recovery || payload.freeExtensionUsed || payload.paidExtensionUsed || payload.suspiciousExtended)) recoveryDeadlineRef.current = deadline
        setRunTiming({
            expiresAt: payload.expiresAt,
            suspiciousExtended: payload.suspiciousExtended === true,
            freeExtensionUsed: payload.freeExtensionUsed === true,
            paidExtensionUsed: payload.paidExtensionUsed === true,
        })
        setClockNow(Date.now())
        return
    }
    if (payload.type === 'ready') {
        setCapacity(capacityValue(payload.capacity) || null)
        void refreshRunStats()
        const runRecord = runHistoryValue(payload.run) || {
            id,
            target: url,
            network: runNetwork,
            status: 'running',
            startedAt: new Date().toISOString(),
            title: '',
        }
        setHistory(current => persistHistory([runRecord, ...current]))
        void fetch(`${historyApiPath}?clientId=${encodeURIComponent(getOrCreateBrowserClientId())}`, { credentials: 'include' })
            .then(response => response.ok ? response.json() : null)
            .then(payload => {
                const runs = sanitizeHistory(payload?.runs)
                const stored = runs.find(run => run.id === id)
                if (stored?.resultId && socketRef.current === socket) {
                    setHistory(persistHistory(runs))
                    window.history.replaceState(null, '', `/sandbox/${stored.resultId}`)
                }
            }).catch(() => undefined)
        const nextQuota = quotaValue(payload.quota)
        if (nextQuota) setQuota(nextQuota)
        setSessionState(runState.navigationFailed ? 'unreachable' : 'live')
        pushEvent('Browser is live.')
        return
    }
    if (payload.type === 'ended') {
        if (payload.reason === 'launch_failed') { replaceSandbox(); return }
        runState.receivedEnd = true
        const failed = payload.reason === 'launch_failed' || payload.reason === 'quota_exhausted' || !receivedEvidenceRef.current
        setStreamUrl('')
        if (failed) setRunBlocker(current => current || stringValue(payload.message) || 'The browser stopped before capturing any evidence. Try again.')
        setSessionState(current => current === 'failed' || current === 'unreachable' ? current : failed ? 'failed' : 'ended')
        pushEvent('Sandbox run ended.')
        return
    }
}
