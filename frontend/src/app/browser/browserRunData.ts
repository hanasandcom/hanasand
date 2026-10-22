import type { Capture, ProviderRunResult, SandboxNetworkSummary, SandboxToolAnalysis, SessionState, SocketState } from './types'
import { virusTotalVendorLabel } from './browserProviderData'

export function sessionStateLabel(state: SessionState) {
    if (state === 'queued') return 'queued'
    if (state === 'connecting') return 'starting'
    if (state === 'live') return 'running'
    if (state === 'ended') return 'complete'
    if (state === 'failed') return 'failed'
    if (state === 'unreachable') return 'unreachable'
    return 'ready'
}

export function formatRunDuration(seconds: number) {
    const safe = Math.max(0, Math.floor(seconds))
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

export function socketStateLabel(state: SocketState) {
    if (state === 'open') return 'connected'
    if (state === 'connecting') return 'connecting'
    if (state === 'error') return 'failed'
    return 'closed'
}

export function addCapture(current: Capture[], next: Capture) {
    if (current.some(capture => capture.id === next.id)) return current.map(capture => capture.id === next.id ? next : capture)
    const last = current[0]
    if (last && last.kind === next.kind && last.url === next.url && last.image === next.image) return [next, ...current.slice(1)]
    return [next, ...current].slice(0, 24)
}

export function providerRunResult(analysis?: SandboxToolAnalysis, error = ''): ProviderRunResult | null {
    if (!analysis?.toolKind) return null
    if (analysis.toolKind === 'virustotal') {
        if (analysis.vendorFlagged === undefined || !analysis.vendorTotal) return null
        const flagged = analysis.vendorFlagged || 0
        return { status: flagged > 0 ? 'suspicious' : error ? 'blocked' : 'clean', label: `${virusTotalVendorLabel(analysis)} VT` }
    }
    if (analysis.toolKind === 'urlquery') {
        if (analysis.alertCount === undefined) return null
        const alerts = analysis.alertCount || 0
        return { status: alerts > 0 ? 'suspicious' : error ? 'blocked' : 'clean', label: alerts > 0 ? `${alerts}` : 'urlquery' }
    }
    return null
}

export function isDegradedNavigationError(message = '') {
    return /invalid (?:v3 )?onion|onion hostname checksum|timeout|net::err_(?:connection_timed_out|timed_out|name_not_resolved|connection_refused|address_unreachable|socks_connection_failed|proxy_connection_failed)/i.test(message)
}

export function cleanConsoleEvent(value: string) {
    return value.replace(/^Remote console:\s*/i, '').trim() || 'Console event.'
}

export function captureLabel(reason: string) {
    if (reason === 'navigation') return 'Navigation capture'
    if (reason === 'domcontentloaded') return 'Screenshot'
    if (reason === 'load') return 'Loaded-page capture'
    if (reason === 'initial_target') return 'Initial target capture'
    if (reason === 'interval') return 'Interval capture'
    return 'Page capture'
}

export function networkPeerLabel(request: NonNullable<SandboxNetworkSummary['recentRequests']>[number]) {
    return [
        request.ip ? `${request.ip}${request.port ? `:${request.port}` : ''}` : '',
        request.asn ? `AS${request.asn}` : '',
        request.protocol || '',
        request.tlsSubject ? `cert ${request.tlsSubject}` : '',
        request.tlsIssuer || '',
        request.tlsValidTo ? `expires ${formatEpochDate(request.tlsValidTo)}` : '',
    ].filter(Boolean).join(' · ')
}

export function formatEpochDate(value: number) {
    return new Date(value * 1000).toISOString().slice(0, 10)
}

export function downloadEvidenceLine(item: NonNullable<SandboxNetworkSummary['downloads']>[number]) {
    return [
        item.fileName || item.url || 'download',
        item.bytes !== undefined ? `${item.bytes} bytes` : '',
        item.sha256 ? `sha256 ${item.sha256}` : item.hashStatus || '',
        item.virusTotal?.total ? `VirusTotal: ${item.virusTotal.flagged || 0}/${item.virusTotal.total} detections` : item.virusTotal?.detail || item.virusTotal?.status || '',
        item.url && item.fileName ? item.url : '',
    ].filter(Boolean).join('\n')
}
