export type RunMetrics = {
    event?: string
    fps?: number
    latencyMs?: number
    peerConnectionState?: string
    iceConnectionState?: string
    candidatePairState?: string
    localCandidateType?: string
    remoteCandidateType?: string
    videoPacketsReceived?: number
    videoFramesDecoded?: number
    videoFramesPerSecond?: number
    capacity?: { activeSessions?: number; maxSessions?: number } | null
}

export default function BrowserRunMetrics({ metrics }: { metrics: RunMetrics }) {
    return <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ui-muted'>
        {metrics.capacity ? <span aria-label='Browser capacity' title='Active browser sessions'>{metrics.capacity.activeSessions ?? 0}/{metrics.capacity.maxSessions ?? 100}</span> : null}
        <span>{metrics.event}{metrics.fps !== undefined ? ` · ${Math.round(metrics.fps)} FPS` : ''}{metrics.videoFramesPerSecond !== undefined ? ` · inbound ${metrics.videoFramesPerSecond.toFixed(1)} FPS` : ''}{metrics.latencyMs !== undefined ? <> · <span title='Ping' aria-label={`Ping: ${Math.round(metrics.latencyMs)} milliseconds`}>{Math.round(metrics.latencyMs)}ms</span></> : null}{metrics.peerConnectionState ? ` · WebRTC ${metrics.peerConnectionState}` : ''}{metrics.iceConnectionState ? ` · ICE ${metrics.iceConnectionState}` : ''}{metrics.candidatePairState ? ` · pair ${metrics.candidatePairState}` : ''}{metrics.localCandidateType && metrics.remoteCandidateType ? ` · ${metrics.localCandidateType}→${metrics.remoteCandidateType}` : ''}{metrics.videoPacketsReceived !== undefined ? ` · ${metrics.videoPacketsReceived} packets` : ''}{metrics.videoFramesDecoded !== undefined ? ` · ${metrics.videoFramesDecoded} frames` : ''}</span>
    </div>
}
