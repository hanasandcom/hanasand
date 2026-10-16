import type { FileReputation } from './downloads.ts'

const MAX_RETAINED_NETWORK_EVENTS = 600
// Keep recent full events under both limits; oversized or evicted history is visible in summaries.
const MAX_RETAINED_NETWORK_EVENT_BYTES = 2 * 1024 * 1024
// The reported count stays exact until either retention cap, then truncation is explicit.
const MAX_RETAINED_CONTACTED_DOMAINS = 4096
const MAX_RETAINED_CONTACTED_DOMAIN_BYTES = 2 * 1024 * 1024

export type SandboxNetworkEvent = {
    kind: 'request' | 'response' | 'failed' | 'download'
    url: string
    method?: string
    resourceType?: string
    status?: number
    host?: string
    mimeType?: string
    initiator?: string
    durationMs?: number
    ip?: string
    asn?: string
    port?: number
    protocol?: string
    tlsIssuer?: string
    tlsSubject?: string
    tlsValidFrom?: number
    tlsValidTo?: number
    fileName?: string
    bytes?: number
    sha256?: string
    hashStatus?: string
    id?: string
    virusTotal?: FileReputation
    failure?: string
    at: string
}

type NetworkCounts = {
    requestCount: number
    responseCount: number
    failedCount: number
}

export class BrowserRunNetworkTelemetry {
    private events: SandboxNetworkEvent[] = []
    private eventBytes: number[] = []
    private retainedEventBytes = 0
    private eventHistoryTruncated = false
    private readonly contactedDomains = new Set<string>()
    private contactedDomainsTruncated = false
    private contactedDomainBytes = 0
    private counts: NetworkCounts = this.emptyCounts()
    private siteValue?: { url: string; ip: string }
    private siteBytes = 0

    get site() {
        return this.siteValue
    }

    set site(value: { url: string; ip: string } | undefined) {
        if (!value) {
            this.siteValue = undefined
            this.siteBytes = 0
            return
        }
        const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8')
        if (bytes > MAX_RETAINED_NETWORK_EVENT_BYTES) {
            this.siteValue = undefined
            this.siteBytes = 0
            this.eventHistoryTruncated = true
            return
        }
        this.siteValue = value
        this.siteBytes = bytes
        this.trimEventHistory()
    }

    record(event: SandboxNetworkEvent) {
        if (event.kind === 'request') this.counts.requestCount++
        if (event.kind === 'response') this.counts.responseCount++
        if (event.kind === 'failed') this.counts.failedCount++

        const domain = event.kind === 'download' ? '' : domainFromUrl(event.url)
        if (domain && !this.contactedDomains.has(domain)) {
            const domainBytes = Buffer.byteLength(domain, 'utf8')
            if (this.contactedDomains.size >= MAX_RETAINED_CONTACTED_DOMAINS
                || this.contactedDomainBytes + domainBytes > MAX_RETAINED_CONTACTED_DOMAIN_BYTES) {
                this.contactedDomainsTruncated = true
            } else {
                this.contactedDomains.add(domain)
                this.contactedDomainBytes += domainBytes
            }
        }

        const eventBytes = Buffer.byteLength(JSON.stringify(event), 'utf8')
        if (eventBytes > MAX_RETAINED_NETWORK_EVENT_BYTES) {
            this.eventHistoryTruncated = true
            return false
        }
        this.events.push(event)
        this.eventBytes.push(eventBytes)
        this.retainedEventBytes += eventBytes
        this.trimEventHistory()
        return this.events.includes(event)
    }

    refresh(event: SandboxNetworkEvent) {
        const index = this.events.indexOf(event)
        if (index === -1) return false
        const eventBytes = Buffer.byteLength(JSON.stringify(event), 'utf8')
        if (eventBytes > MAX_RETAINED_NETWORK_EVENT_BYTES) {
            this.events.splice(index, 1)
            this.retainedEventBytes -= this.eventBytes.splice(index, 1)[0]!
            this.eventHistoryTruncated = true
            return false
        }
        this.retainedEventBytes += eventBytes - this.eventBytes[index]!
        this.eventBytes[index] = eventBytes
        this.trimEventHistory()
        return this.events.includes(event)
    }

    interruptDownloads() {
        for (const event of [...this.events]) {
            if (event.kind !== 'download') continue
            if (event.virusTotal?.status === 'checking') {
                event.virusTotal = { status: 'interrupted', detail: 'Run ended before the hash lookup finished' }
            }
            if (event.hashStatus === 'downloading') event.hashStatus = 'Download interrupted when the run ended'
            this.refresh(event)
        }
    }

    requestStartedAt(url: string, method: string) {
        for (let index = this.events.length - 1; index >= 0; index--) {
            const event = this.events[index]
            if (event.kind === 'request' && event.url === url && event.method === method) return event.at
        }
        return undefined
    }

    summary() {
        return {
            ...summarizeNetworkEvents(this.events, this.eventHistoryTruncated),
            ...this.counts,
            uniqueDomainCount: this.contactedDomains.size,
            uniqueDomainCountTruncated: this.contactedDomainsTruncated,
            eventHistoryTruncated: this.eventHistoryTruncated,
            site: this.site,
        }
    }

    reset() {
        this.events = []
        this.eventBytes = []
        this.retainedEventBytes = 0
        this.eventHistoryTruncated = false
        this.contactedDomains.clear()
        this.contactedDomainsTruncated = false
        this.contactedDomainBytes = 0
        this.counts = this.emptyCounts()
        this.siteValue = undefined
        this.siteBytes = 0
    }

    private trimEventHistory() {
        while (this.events.length > MAX_RETAINED_NETWORK_EVENTS
            || this.retainedEventBytes + this.siteBytes > MAX_RETAINED_NETWORK_EVENT_BYTES) {
            this.events.shift()
            this.retainedEventBytes -= this.eventBytes.shift()!
            this.eventHistoryTruncated = true
        }
    }

    private emptyCounts(): NetworkCounts {
        return { requestCount: 0, responseCount: 0, failedCount: 0 }
    }
}

export function domainFromUrl(value: string) {
    try {
        return new URL(value).hostname.toLowerCase()
    } catch {
        return ''
    }
}

function summarizeNetworkEvents(events: SandboxNetworkEvent[], eventHistoryTruncated: boolean) {
    const requests = events.filter(event => event.kind === 'request')
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
            url: event.url,
            method: event.method,
            resourceType: event.resourceType,
            status: event.status,
            host: event.host || domainFromUrl(event.url),
            mimeType: event.mimeType,
            initiator: event.initiator,
            durationMs: event.durationMs,
            ip: event.ip,
            asn: event.asn,
            port: event.port,
            protocol: event.protocol,
            tlsIssuer: event.tlsIssuer,
            tlsSubject: event.tlsSubject,
            tlsValidFrom: event.tlsValidFrom,
            tlsValidTo: event.tlsValidTo,
            failure: event.failure,
            at: event.at,
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
        requestCount: requests.length,
        responseCount: responses.length,
        failedCount: failures.length,
        uniqueDomainCount: domains.length,
        domainsTruncated,
        domains,
        recentRequests,
        statusCounts,
        redirectChain,
        downloads: events.filter(event => event.kind === 'download').slice(-20).map(event => ({
            id: event.id,
            url: event.url,
            fileName: event.fileName,
            bytes: event.bytes,
            sha256: event.sha256,
            hashStatus: event.hashStatus,
            virusTotal: event.virusTotal,
            at: event.at,
        })),
        recentFailures: failures.slice(-8).map(event => ({
            url: event.url,
            failure: event.failure || 'failed',
            at: event.at,
        })),
        lastUpdatedAt: events.at(-1)?.at,
    }
}
