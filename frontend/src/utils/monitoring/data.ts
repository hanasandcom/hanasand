'use server'

import type {
    GetVulnerabilities,
    TrafficDomains,
    TrafficMetrics,
    TrafficRecords,
    WebScanReport,
} from './types'
import { requestService } from './serviceApi'

export async function getVulnerabilities() {
    return await requestService<GetVulnerabilities>('internal', 'vulnerabilities', {
        signal: AbortSignal.timeout(30_000),
    })
}

export async function triggerVulnerabilityScan() {
    return await requestService<{ message: string, status: GetVulnerabilities['scanStatus'] }>(
        'internal',
        'vulnerabilities/scan',
        { method: 'POST', body: JSON.stringify({}) }
    )
}

export async function getWebScan() {
    const result = await requestService<WebScanReport>('internal', 'vulnerabilities/web-scan')
    if (typeof result === 'string') throw new Error(result)
    return result
}
export async function triggerWebScan() {
    const result = await requestService<{ message: string, status: WebScanReport }>('internal', 'vulnerabilities/web-scan', { method: 'POST', body: JSON.stringify({}) })
    if (typeof result === 'string') throw new Error(result)
    return result
}
export async function updateWebScanSchedule(input: { enabled?: boolean, intervalMinutes?: number }) {
    const result = await requestService<WebScanReport>('internal', 'vulnerabilities/web-scan/schedule', { method: 'PUT', body: JSON.stringify(input) })
    if (typeof result === 'string') throw new Error(result)
    return result
}

export async function getTrafficDomains() {
    return await requestService<TrafficDomains>('cdn', 'traffic/domains')
}

export async function getTrafficMetrics(domain?: string) {
    const params = new URLSearchParams()
    if (domain) {
        params.set('domain', domain)
    }

    // A cold domain snapshot can take longer than a normal cached request.
    // Its Suspense boundary keeps the page usable while that calculation finishes.
    return await requestService<TrafficMetrics>('cdn', `traffic/metrics?${params.toString()}`, {
        signal: AbortSignal.timeout(60000),
    })
}

export async function getTrafficRecords(domain?: string, limit = 12, page = 1) {
    const params = new URLSearchParams({
        limit: String(limit),
        page: String(page),
    })
    if (domain) {
        params.set('domain', domain)
    }

    return await requestService<TrafficRecords>('cdn', `traffic/records?${params.toString()}`, {
        signal: AbortSignal.timeout(60000),
    })
}

export async function getTrafficDashboardData(domain?: string) {
    const [domains, metrics, records] = await Promise.all([
        getTrafficDomains(),
        getTrafficMetrics(domain),
        getTrafficRecords(domain, 200, 1),
    ])

    if (!isTrafficDomains(domains) || !isTrafficMetrics(metrics) || !isTrafficRecords(records)) return null
    return { domains, metrics, records }
}

function isTrafficDomains(value: unknown): value is TrafficDomains {
    return Boolean(value && typeof value === 'object' && Array.isArray((value as TrafficDomains).domains))
}

function isTrafficMetrics(value: unknown): value is TrafficMetrics {
    return Boolean(
        value
        && typeof value === 'object'
        && Array.isArray((value as TrafficMetrics).top_domains)
        && Array.isArray((value as TrafficMetrics).top_methods)
        && Array.isArray((value as TrafficMetrics).top_status_codes)
    )
}

function isTrafficRecords(value: unknown): value is TrafficRecords {
    return Boolean(value && typeof value === 'object' && Array.isArray((value as TrafficRecords).result))
}
