import { connect as connectTls } from 'node:tls'
import type { AutomationRow } from './automationTypes.ts'
import { monitoringLookup, monitoringUrl, resolveMonitoringAddresses } from './publicMonitoringRequest.ts'

export function certificateTarget(automation: Pick<AutomationRow, 'monitoring_type' | 'target_url'>): URL | null {
    if (!automation.target_url || automation.monitoring_type === 'ssh') return null
    const target = new URL(automation.monitoring_type === 'tcp' ? `tcp://${automation.target_url}` : automation.target_url)
    if (target.protocol === 'https:') return target
    if (automation.monitoring_type === 'tcp' && target.port === '443') return new URL(`https://${target.host}`)
    return null
}
export async function checkCertificate(target: URL, timeoutMs: number) {
    monitoringUrl(target)
    const signal = AbortSignal.timeout(timeoutMs)
    const addresses = await resolveMonitoringAddresses(target.hostname, signal)
    return new Promise<{ status: 'valid' | 'expiring' | 'invalid', subject: string | null, issuer: string | null, expiresAt: string | null }>((resolve, reject) => {
        const hostname = target.hostname.replace(/^\[|\]$/g, '')
        // Inspect invalid certificates without sending HTTP data; the content request still enforces TLS trust.
        const socket = connectTls({ host: hostname, port: Number(target.port) || 443, servername: hostname, lookup: monitoringLookup(addresses), rejectUnauthorized: false })
        const abort = () => socket.destroy(new Error('Certificate check timed out.'))
        signal.addEventListener('abort', abort, { once: true })
        socket.once('close', () => signal.removeEventListener('abort', abort))
        if (signal.aborted) abort()
        const finish = (value: { status: 'valid' | 'expiring' | 'invalid', subject: string | null, issuer: string | null, expiresAt: string | null }) => { socket.destroy(); resolve(value) }
        socket.setTimeout(timeoutMs, () => { socket.destroy(); reject(new Error(`Certificate check timed out after ${timeoutMs / 1000} second${timeoutMs === 1000 ? '' : 's'}.`)) })
        socket.once('error', error => { socket.destroy(); reject(new Error(`Certificate check failed: ${error.message}`, { cause: error })) })
        socket.once('secureConnect', () => {
            const certificate = socket.getPeerCertificate()
            const expiresAt = certificate.valid_to ? new Date(certificate.valid_to).toISOString() : null
            const daysRemaining = expiresAt ? (Date.parse(expiresAt) - Date.now()) / 86_400_000 : -1
            finish({ status: !socket.authorized || daysRemaining < 0 ? 'invalid' : daysRemaining <= 30 ? 'expiring' : 'valid', subject: certificate.subject?.CN || null, issuer: certificate.issuer?.O || certificate.issuer?.CN || null, expiresAt })
        })
    })
}

export function getCertificateFromError(error: unknown) {
    return error && typeof error === 'object' && 'certificate' in error ? error.certificate as { status: string, subject: string | null, issuer: string | null, expiresAt: string | null } : null
}
