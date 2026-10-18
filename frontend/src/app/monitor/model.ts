import type { TrafficMetrics } from '@/utils/monitoring/types'
import type { TrafficSummaryMetric } from '@/utils/traffic/getMetrics'
import type { TiAdminCapture, TiAdminOverview } from '@/utils/tiAdmin/types'

export type MonitorRow = {
    domain: string
    customer: string
    status: string
    monitoredSince: string
    lastSeenAt: string
    breachMentions: number
    matchedTerms: string[]
    sources: string[]
    requestsToday: number
    requestsThisWeek: number
    requestsThisMonth: number
    requestsTotal: number
}

export function buildMonitorRows({ trafficMetrics, domainTraffic, ti }: {
    trafficMetrics: TrafficMetrics | string
    domainTraffic: TrafficSummaryMetric[]
    ti: TiAdminOverview
}): MonitorRow[] {
    const trafficRows = Array.isArray(domainTraffic) ? domainTraffic : []
    const topDomains = typeof trafficMetrics === 'string' ? [] : trafficMetrics.top_domains
    const trafficByDomain = indexFirst(trafficRows, row => row.value)
    const topDomainByName = indexFirst(topDomains, row => row.key)
    const tiByDomain = new Map(ti.domains.map(domain => [domain.domain, domain]))
    const sourceById = indexFirst(ti.sources, source => source.id)
    const capturesByDomain = groupCapturesByDomain(ti.captures)
    const firstSourceDateByDomain = firstSourceDatesByDomain(ti)
    const domains = new Set([
        ...topDomains.map(domain => domain.key),
        ...trafficRows.map(row => row.value),
        ...ti.domains.map(domain => domain.domain),
    ].filter(isMonitorDomain))

    return [...domains].map(domain => {
        const tiDomain = tiByDomain.get(domain)
        const captures = capturesByDomain.get(domain) || []
        const traffic = trafficByDomain.get(domain)
        const sources = (tiDomain?.sourceIds || []).map(id => sourceById.get(id)?.name).filter((name): name is string => Boolean(name))

        return {
            domain,
            customer: tiDomain?.company || customerFromDomain(domain),
            status: tiDomain?.status || 'watching',
            monitoredSince: captures[0]?.monitoredSince || firstSourceDateByDomain.get(domain) || '',
            lastSeenAt: tiDomain?.lastSeenAt || '',
            breachMentions: tiDomain?.resultCount || captures.length,
            matchedTerms: tiDomain?.matchedTerms || [domain],
            sources,
            requestsToday: traffic?.hits_today || 0,
            requestsThisWeek: traffic?.hits_last_week || 0,
            requestsThisMonth: traffic?.hits_this_month || 0,
            requestsTotal: traffic?.hits_total || topDomainByName.get(domain)?.count || 0,
        }
    })
}

function indexFirst<T>(rows: T[], keyOf: (row: T) => string) {
    const indexed = new Map<string, T>()
    for (const row of rows) {
        const key = keyOf(row)
        if (!indexed.has(key)) indexed.set(key, row)
    }
    return indexed
}

function groupCapturesByDomain(captures: TiAdminCapture[]) {
    const grouped = new Map<string, TiAdminCapture[]>()
    for (const capture of captures) {
        const rows = grouped.get(capture.domain) || []
        rows.push(capture)
        grouped.set(capture.domain, rows)
    }
    return grouped
}

function firstSourceDatesByDomain(ti: TiAdminOverview) {
    const dates = new Map<string, string>()
    for (const source of ti.sources) {
        for (const domain of source.domains) {
            if (!dates.has(domain)) dates.set(domain, source.monitoredSince)
        }
    }
    return dates
}

function customerFromDomain(domain: string) {
    return domain.replace(/^www\./, '').split('.')[0]?.replaceAll('-', ' ') || domain
}

function isMonitorDomain(value: string) {
    return Boolean(value && !value.startsWith('/') && !value.includes(' ') && (value.includes('.') || value === 'localhost') && !/^[\d.]+$/.test(value))
}
