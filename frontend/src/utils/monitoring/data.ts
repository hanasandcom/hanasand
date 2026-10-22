'use server'

import type {
    GetVulnerabilities,
    TrafficDomains,
    TrafficMetrics,
    TrafficRecords,
    WebScanReport,
    UvmDashboard,
} from './types'
import { isTrafficDomains, isTrafficMetrics, isTrafficRecords } from './trafficValidation'
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

export async function getUvm() {
    const result = await requestService<UvmDashboard>('internal', 'vulnerabilities/uvm')
    if (typeof result === 'string') throw new Error(result)
    return result
}

export async function createUvmAsset(input: { hostname: string }) {
    const result = await requestService<{ asset: UvmDashboard['assets'][number] }>('internal', 'vulnerabilities/uvm/assets', { method: 'POST', body: JSON.stringify(input) })
    if (typeof result === 'string') throw new Error(result)
    return result
}

export async function verifyUvmAsset(assetId: string) {
    const result = await requestService<{ asset: UvmDashboard['assets'][number] }>('internal', `vulnerabilities/uvm/assets/${encodeURIComponent(assetId)}/verify`, { method: 'POST', body: JSON.stringify({}) })
    if (typeof result === 'string') throw new Error(result)
    return result
}

export async function startUvmAssetScan(assetId: string, authorized: boolean) {
    const result = await requestService<{ run: UvmDashboard['runs'][number] }>('internal', `vulnerabilities/uvm/assets/${encodeURIComponent(assetId)}/scans`, { method: 'POST', body: JSON.stringify({ authorized }) })
    if (typeof result === 'string') throw new Error(result)
    return result
}

export async function updateUvmAssetSchedule(assetId: string, input: { enabled: boolean, intervalMinutes: number, authorized: boolean, engine: 'nmap' | 'tenable-vm', scanId?: string }) {
    const result = await requestService<{ asset: UvmDashboard['assets'][number] }>('internal', `vulnerabilities/uvm/assets/${encodeURIComponent(assetId)}/schedule`, { method: 'PUT', body: JSON.stringify(input) })
    if (typeof result === 'string') throw new Error(result)
    return result
}

export async function configureUvmTenable(input: { region: 'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp', accessKey: string, secretKey: string }) {
    const result = await requestService<{ integration: NonNullable<UvmDashboard['tenableIntegration']> }>('internal', 'vulnerabilities/uvm/integrations/tenable', { method: 'PUT', body: JSON.stringify(input) })
    if (typeof result === 'string') throw new Error(result)
    return result
}

export async function disconnectUvmTenable() {
    const result = await requestService<{ integration: NonNullable<UvmDashboard['tenableIntegration']> }>('internal', 'vulnerabilities/uvm/integrations/tenable', { method: 'DELETE', body: JSON.stringify({}) })
    if (typeof result === 'string') throw new Error(result)
    return result
}

export async function startUvmTenableScan(assetId: string, scanId: string, authorized: boolean) {
    const result = await requestService<{ run: UvmDashboard['runs'][number] }>('internal', `vulnerabilities/uvm/assets/${encodeURIComponent(assetId)}/tenable-scans`, { method: 'POST', body: JSON.stringify({ scanId, authorized }) })
    if (typeof result === 'string') throw new Error(result)
    return result
}

export async function cancelUvmRun(runId: string) {
    const result = await requestService<{ run: UvmDashboard['runs'][number] }>('internal', `vulnerabilities/uvm/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST', body: JSON.stringify({}) })
    if (typeof result === 'string') throw new Error(result)
    return result
}

export async function updateUvmFinding(findingId: string, input: { status: UvmDashboard['findings'][number]['status'], note: string }) {
    const result = await requestService<{ finding: { id: string, status: UvmDashboard['findings'][number]['status'], triage_note: string | null, updated_at: string } }>('internal', `vulnerabilities/uvm/findings/${encodeURIComponent(findingId)}`, { method: 'PUT', body: JSON.stringify(input) })
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
