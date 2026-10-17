export const STATE_PATH = process.env.WEB_SCAN_STATE_PATH || '/var/lib/hanasand/web-scan.json'
export const LOCK_PATH = `${STATE_PATH}.lock`
export const RECOVERY_LOCK_PATH = `${LOCK_PATH}.recovery`
export const TARGET_ID = 'primary'
export const PORTS = [80, 443, 8080, 8443]
export const DEFAULT_INTERVAL_MINUTES = normalizeIntervalMinutes(process.env.WEB_SCAN_INTERVAL_MINUTES, 60)
export const MAX_HISTORY = 100
export type WebScanSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type WebScanCheck = { id: string, status: 'pass' | 'warn' | 'fail' | 'error', severity: WebScanSeverity, title: string, explanation?: string, evidence: Record<string, unknown> }
export type WebScanTargetResult = { target: string, status: string, checks: WebScanCheck[], ports: Array<{ port: number, open: boolean, elapsedMs: number }> }
export type WebScanRun = { scanId: string, status: 'running' | 'completed' | 'failed', startedAt: string, finishedAt: string | null, durationMs: number | null, target: string, targets: WebScanTargetResult[], severityCounts: Record<WebScanSeverity, number>, error: string | null }
export type WebScanSchedule = { enabled: boolean, intervalMinutes: number, nextRunAt: string | null, lastRunAt: string | null, target: string | null, scope: 'global' }
export type WebScanReport = { current: WebScanRun | null, history: WebScanRun[], schedule: WebScanSchedule, error: string | null }

export type ConfiguredTarget = { target: string | null, error: string | null }
export type StoredRun = { scan_id: string, target_url: string, status: WebScanRun['status'], target_status: string, started_at: string, finished_at: string | null, duration_ms: number | null, severity_counts: Record<WebScanSeverity, number>, error: string | null }
export type StoredFinding = { scan_id: string, target_url: string, kind: 'check' | 'port', check_id: string, status: string, severity: WebScanSeverity, title: string, explanation: string | null, evidence: Record<string, unknown>, port: number | null, elapsed_ms: number | null }
export function normalizeIntervalMinutes(value: unknown, fallback = 60) {
    const parsed = Number(value)
    const safeFallback = Number.isFinite(fallback) ? Math.floor(fallback) : 60
    return Math.min(Math.max(Number.isFinite(parsed) ? Math.floor(parsed) : safeFallback, 5), 1440)
}
export function normalizeTarget(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return null
    try {
        const url = new URL(value.trim())
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
        return url.toString().replace(/\/$/, '')
    } catch { return null }
}
export function isUsefulExplanation(value: string | undefined) { return Boolean(value && value.length >= 40 && !/explanation is not available|completed this check/i.test(value)) }
export function fallbackExplanation(check: WebScanCheck): string {
    const present = Boolean(check.evidence.value)
    if (check.id === 'http.reachable') return check.status === 'pass' ? 'The target accepted an HTTPS request during this scan, so encrypted transport was reachable.' : `The scanner could not complete an HTTPS request to the target: ${String(check.evidence.error || 'the connection failed')}.`
    if (check.id === 'dns.resolution') return check.status === 'pass' ? 'DNS returned one or more addresses for the configured host.' : `DNS could not resolve the configured host: ${String(check.evidence.error || 'resolution failed')}.`
    if (check.id === 'tls.certificate') return check.status === 'pass' ? `The TLS certificate is valid for the target and expires in ${String(check.evidence.daysRemaining)} days.` : `The scanner could not confirm a healthy TLS certificate: ${String(check.evidence.error || check.title)}.`
    if (check.id === 'http.redirect') return check.status === 'pass' ? 'The target did not downgrade an HTTPS request during its redirect handling.' : `The target redirects to ${String(check.evidence.location || 'an insecure endpoint')}.`
    if (check.id === 'cookie.security') return check.status === 'pass' ? 'The response did not set cookies without baseline security attributes.' : 'At least one response cookie is missing a baseline security attribute; review the cookie flags before shipping it to browsers.'
    if (check.id === 'header.hsts') return present ? 'The response included Strict-Transport-Security, telling browsers to keep using HTTPS for this host.' : 'The response did not include Strict-Transport-Security, so browsers are not instructed to enforce HTTPS on future visits.'
    if (check.id === 'header.csp') return present ? 'The response included Content-Security-Policy; this scan confirms presence but does not assess directive quality.' : 'The response did not include Content-Security-Policy, so the browser has no explicit resource-loading policy.'
    if (check.id === 'header.frame-ancestors') return present ? `The response included ${String(check.evidence.header || 'a framing policy')}, which gives browsers a clickjacking protection rule.` : 'The response did not include a framing restriction, so the site may be embeddable in an attacker-controlled frame.'
    if (check.id === 'header.nosniff') return present ? 'The response included X-Content-Type-Options, telling browsers to respect declared content types.' : 'The response did not include X-Content-Type-Options: nosniff, so browsers may MIME-sniff content.'
    if (check.id === 'header.referrer-policy') return present ? 'The response declares a referrer-sharing policy for outbound requests.' : 'The response does not declare how much referrer information browsers should send.'
    if (check.id === 'header.permissions-policy') return present ? 'The response declares browser feature restrictions through Permissions-Policy.' : 'The response does not declare restrictions for browser features such as camera, microphone, or geolocation.'
    if (check.id === 'header.server') return present ? `The response included a Server header (${String(check.evidence.value)}), which reveals an implementation detail useful for fingerprinting.` : 'The response did not expose a Server header, so this scan found no server implementation detail to fingerprint.'
    return check.status === 'pass' ? `The scan observed the condition described by “${check.title}”; no immediate change is indicated.` : `The scan observed “${check.title}” as needing attention; inspect the retained evidence next.`
}
export function countSeverities(targets: WebScanTargetResult[]) {
    const counts = emptySeverityCounts()
    for (const check of targets.flatMap(target => target.checks)) if (check.status !== 'pass') counts[check.severity] += 1
    for (const port of targets.flatMap(target => target.ports)) if (port.open && ![80, 443].includes(port.port)) counts.medium += 1
    return counts
}

export function emptySeverityCounts(): Record<WebScanSeverity, number> { return { critical: 0, high: 0, medium: 0, low: 0, info: 0 } }

