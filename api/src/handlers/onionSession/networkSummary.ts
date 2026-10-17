import type { SandboxNetworkEvent } from './networkTelemetry.ts'
import { MAX_RETAINED_CONTACTED_DOMAIN_BYTES } from './networkTelemetryLimits.ts'

export function domainFromUrl(value: string) {
    try {
        return new URL(value).hostname.toLowerCase()
    } catch {
        return ''
    }
}

export function summarizeNetworkEvents(events: SandboxNetworkEvent[], eventHistoryTruncated: boolean) {
    const responses = events.filter(event => event.kind === 'response')
    const failures = events.filter(event => event.kind === 'failed')
    const domains: string[] = []
    const seenDomains = new Set<string>()
    let domainBytes = 0
    let domainsTruncated = eventHistoryTruncated
    for (const event of events) {
        const domain = domainFromUrl(event.url)
        if (!domain || seenDomains.has(domain)) continue
        const bytes = Buffer.byteLength(domain, 'utf8')
        if (domains.length >= 80 || domainBytes + bytes > MAX_RETAINED_CONTACTED_DOMAIN_BYTES) {
            domainsTruncated = true
            continue
        }
        seenDomains.add(domain)
        domains.push(domain)
        domainBytes += bytes
    }
    const recentRequests = events
        .filter(event => event.kind === 'request' || event.kind === 'response' || event.kind === 'failed')
        .slice(-60)
        .map(event => ({
            url: event.url, method: event.method, resourceType: event.resourceType, status: event.status,
            host: event.host || domainFromUrl(event.url), mimeType: event.mimeType, initiator: event.initiator,
            durationMs: event.durationMs, ip: event.ip, asn: event.asn, port: event.port, protocol: event.protocol,
            tlsIssuer: event.tlsIssuer, tlsSubject: event.tlsSubject, tlsValidFrom: event.tlsValidFrom,
            tlsValidTo: event.tlsValidTo, failure: event.failure, at: event.at,
        }))
    const statusCounts = responses.reduce<Record<string, number>>((current, event) => {
        const bucket = event.status ? `${Math.floor(event.status / 100)}xx` : 'unknown'
        current[bucket] = (current[bucket] || 0) + 1
        return current
    }, {})
    const redirectChain = events
        .filter(event => event.kind === 'response' && event.status && event.status >= 300 && event.status < 400)
        .map(event => event.url)
        .slice(-12)
    return {
        domainsTruncated, domains, recentRequests, statusCounts, redirectChain,
        downloads: events.filter(event => event.kind === 'download').slice(-20).map(event => ({
            id: event.id, url: event.url, fileName: event.fileName, bytes: event.bytes, sha256: event.sha256,
            hashStatus: event.hashStatus, virusTotal: event.virusTotal, at: event.at,
        })),
        recentFailures: failures.slice(-8).map(event => ({ url: event.url, failure: event.failure || 'failed', at: event.at })),
        lastUpdatedAt: events.at(-1)?.at,
    }
}
