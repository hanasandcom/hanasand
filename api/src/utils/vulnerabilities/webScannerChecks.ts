import { lookup } from 'node:dns/promises'
import { connect } from 'node:net'
import { connect as tlsConnect } from 'node:tls'
import { requestAiCompletion } from '#utils/ai/client.ts'
import { fallbackExplanation, isUsefulExplanation, type WebScanCheck, type WebScanSeverity } from './webScannerModel.ts'

export function headerChecks(headers: Record<string, string>, https: boolean): WebScanCheck[] {
    const check = (id: string, label: string, header: string, required: boolean, severity: WebScanSeverity): WebScanCheck => {
        const present = Boolean(headers[header])
        return { id, title: `${label} is ${present ? 'present' : 'missing'}`, severity, status: present ? 'pass' : required ? 'fail' : 'warn', evidence: { header, value: headers[header] || null } }
    }
    return [
        { id: 'http.reachable', status: 'pass', severity: 'info', title: 'HTTPS request completed', evidence: { status: 'received' } },
        check('header.hsts', 'Strict-Transport-Security', 'strict-transport-security', https, 'high'),
        check('header.csp', 'Content-Security-Policy', 'content-security-policy', false, 'medium'),
        check('header.frame-ancestors', 'Clickjacking protection', 'x-frame-options', false, 'medium'),
        check('header.nosniff', 'MIME sniffing protection', 'x-content-type-options', false, 'low'),
        check('header.referrer-policy', 'Referrer-Policy', 'referrer-policy', false, 'low'),
        check('header.permissions-policy', 'Permissions-Policy', 'permissions-policy', false, 'low'),
        { id: 'header.server', title: headers.server ? 'Server header reveals implementation detail' : 'Server fingerprint is minimized', severity: 'low', status: headers.server ? 'warn' : 'pass', evidence: { value: headers.server || null } },
    ]
}

export function redirectChecks(status: number, location: string | undefined, target: URL): WebScanCheck[] {
    if (status < 300 || status >= 400 || !location) return [{ id: 'http.redirect', status: 'pass', severity: 'info', title: 'HTTPS endpoint does not redirect', evidence: { status, location: null } }]
    const redirected = new URL(location, target)
    const secure = redirected.protocol === 'https:'
    return [{ id: 'http.redirect', status: secure ? 'pass' : 'fail', severity: secure ? 'info' : 'high', title: secure ? 'Redirect stays on HTTPS' : 'Redirect downgrades to HTTP', evidence: { status, location: redirected.toString(), protocol: redirected.protocol } }]
}

export function cookieChecks(setCookie: string | undefined): WebScanCheck[] {
    if (!setCookie) return [{ id: 'cookie.security', status: 'pass', severity: 'info', title: 'No response cookies set', evidence: { count: 0 } }]
    const cookies = setCookie.split(/,(?=\s*[^;=,]+\s*=)/).map(cookie => cookie.trim())
    const lower = cookies.map(cookie => cookie.toLowerCase())
    const missingSecure = lower.filter(cookie => !cookie.includes('; secure')).length
    const missingHttpOnly = lower.filter(cookie => !cookie.includes('; httponly')).length
    const missingSameSite = lower.filter(cookie => !cookie.includes('; samesite=')).length
    const issues = [missingSecure ? `${missingSecure} missing Secure` : '', missingHttpOnly ? `${missingHttpOnly} missing HttpOnly` : '', missingSameSite ? `${missingSameSite} missing SameSite` : ''].filter(Boolean)
    return [{ id: 'cookie.security', status: issues.length ? missingSecure ? 'fail' : 'warn' : 'pass', severity: missingSecure ? 'high' : 'medium', title: issues.length ? `Cookie attributes need review (${issues.join(', ')})` : 'Response cookies include baseline security attributes', evidence: { count: cookies.length, missingSecure, missingHttpOnly, missingSameSite } }]
}
export async function dnsCheck(host: string): Promise<WebScanCheck> {
    try {
        const addresses = await lookup(host, { all: true })
        return { id: 'dns.resolution', status: 'pass', severity: 'info', title: 'DNS resolution completed', evidence: { host, addresses: addresses.map(address => address.address) } }
    } catch (error) {
        return { id: 'dns.resolution', status: 'error', severity: 'high', title: 'DNS resolution completed', evidence: { host, error: error instanceof Error ? error.message : String(error) } }
    }
}

export async function tlsCertificateCheck(host: string): Promise<WebScanCheck> {
    return new Promise(resolve => {
        const socket = tlsConnect({ host, port: 443, servername: host, rejectUnauthorized: false })
        let settled = false
        const finish = (check: WebScanCheck) => { if (settled) return; settled = true; socket.destroy(); resolve(check) }
        socket.setTimeout(5000, () => finish({ id: 'tls.certificate', status: 'error', severity: 'high', title: 'TLS certificate inspection completed', evidence: { host, error: 'TLS connection timed out' } }))
        socket.once('secureConnect', () => {
            const certificate = socket.getPeerCertificate()
            const expiresAt = certificate.valid_to ? new Date(certificate.valid_to) : null
            const daysRemaining = expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 86_400_000) : null
            const status = daysRemaining === null ? 'error' : daysRemaining <= 0 ? 'fail' : daysRemaining <= 30 ? 'warn' : 'pass'
            finish({ id: 'tls.certificate', status, severity: status === 'pass' ? 'info' : 'high', title: status === 'fail' ? 'TLS certificate is expired' : status === 'warn' ? 'TLS certificate expires soon' : 'TLS certificate is valid', evidence: { host, subject: certificate.subject?.CN || null, issuer: certificate.issuer?.CN || null, expiresAt: expiresAt?.toISOString() || null, daysRemaining } })
        })
        socket.once('error', error => finish({ id: 'tls.certificate', status: 'error', severity: 'high', title: 'TLS certificate inspection completed', evidence: { host, error: error.message } }))
    })
}
export async function explainChecks(checks: WebScanCheck[]): Promise<WebScanCheck[]> {
    const fallback = new Map(checks.map(check => [check.id, fallbackExplanation(check)]))
    try {
        const content = await requestAiCompletion([{ role: 'system', content: 'Explain each web security check in one concise sentence. Return only a JSON object keyed by check id. Use only supplied evidence.' }, { role: 'user', content: JSON.stringify(checks.map(check => ({ id: check.id, status: check.status, severity: check.severity, title: check.title, evidence: check.evidence }))) }], 15_000)
        const generated = parseExplanationObject(content)
        return checks.map(check => ({ ...check, explanation: isUsefulExplanation(generated[check.id]) ? generated[check.id] : fallback.get(check.id) }))
    } catch {
        return checks.map(check => ({ ...check, explanation: fallback.get(check.id) }))
    }
}
function parseExplanationObject(content: string): Record<string, string> {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return {}
    try {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>
        return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'string').map(([key, value]) => [key, String(value).trim().slice(0, 360)]))
    } catch { return {} }
}

export function checkPort(host: string, port: number): Promise<{ port: number, open: boolean, elapsedMs: number }> {
    return new Promise(resolve => {
        const started = performance.now()
        const socket = connect({ host, port })
        let settled = false
        const finish = (open: boolean) => { if (settled) return; settled = true; socket.destroy(); resolve({ port, open, elapsedMs: Math.round(performance.now() - started) }) }
        socket.setTimeout(2500, () => finish(false)); socket.once('connect', () => finish(true)); socket.once('error', () => finish(false))
    })
}
