import type { SeverityLevel } from './scanner.ts'
import { requestScanner } from './scannerClient.ts'

export type NetworkScannerEngine = {
    id: 'nmap'
    name: string
    status: 'available' | 'unavailable'
    version: string | null
    reason: string | null
    profiles: Array<{ id: 'tcp-top-100', name: string, safe: true }>
    coverage: string[]
    notCovered: string[]
}

export type NetworkScannerHost = {
    address: string
    status: string
    ports: Array<{
        port: number
        protocol: 'tcp'
        state: string
        service: string | null
        product: string | null
        version: string | null
        extraInfo: string | null
    }>
}

export type NetworkScannerRun = {
    runId: string
    requestId: string
    organizationId: string
    assetId: string
    target: string
    addresses: string[]
    profile: 'tcp-top-100'
    status: 'queued' | 'running' | 'succeeded' | 'partial' | 'failed' | 'cancelled'
    createdAt: string
    startedAt: string | null
    finishedAt: string | null
    engineVersion: string | null
    rawXmlSha256: string | null
    hosts: NetworkScannerHost[]
    error: string | null
}

export type TenableIntegration = {
    provider: 'tenable-vm'
    configured: boolean
    credentialStoreAvailable: boolean
    region: string | null
    accessKeyHint: string | null
    testedAt: string | null
    updatedAt: string | null
    error: string | null
}

export type TenableScan = { id: string, scheduleUuid: string | null, name: string, enabled: boolean, status: string | null, scannerName: string | null, targets: string }
export type TenableFinding = {
    findingId: string
    provider: 'tenable-vm'
    pluginId: number
    cveIds: string[]
    title: string
    severity: SeverityLevel
    cvssScore: number | null
    cvssVector: string | null
    description: string | null
    solution: string | null
    evidence: string | null
    assetAddress: string
    firstSeen: string | null
    lastSeen: string | null
    status: string
    observed: string | null
    port: number | null
    protocol: string | null
}
export type TenableRun = {
    runId: string
    requestId: string
    organizationId: string
    assetId: string
    target: string
    addresses: string[]
    scanId: string
    status: 'queued' | 'launching' | 'running' | 'exporting' | 'succeeded' | 'partial' | 'failed' | 'cancelled'
    createdAt: string
    startedAt: string | null
    finishedAt: string | null
    error: string | null
    findings: TenableFinding[]
    coverage?: { attemptedAddresses: number, completedAddresses: number }
}

export async function getNetworkScannerEngines() {
    return requestScanner<{ engines: NetworkScannerEngine[] }>('/v1/network/engines')
}

export async function startNetworkScannerRun(input: {
    organizationId: string
    assetId: string
    requestId: string
    target: string
    addresses: string[]
    profile: 'tcp-top-100'
}) {
    const accepted = await requestScanner<{ runId: string, status: NetworkScannerRun['status'] }>('/v1/network/runs', { method: 'POST', body: input })
    return getNetworkScannerRun(accepted.runId, input.organizationId)
}

export async function getNetworkScannerRuns(organizationId: string, limit = 50) {
    return requestScanner<{ runs: NetworkScannerRun[] }>(`/v1/network/runs?organizationId=${encodeURIComponent(organizationId)}&limit=${encodeURIComponent(String(limit))}`)
}

export async function getNetworkScannerRun(runId: string, organizationId: string) {
    return requestScanner<NetworkScannerRun>(`/v1/network/runs/${encodeURIComponent(runId)}?organizationId=${encodeURIComponent(organizationId)}`)
}

export async function cancelNetworkScannerRun(runId: string, organizationId: string) {
    await requestScanner<{ runId: string, status: NetworkScannerRun['status'], cancelled: boolean }>(`/v1/network/runs/${encodeURIComponent(runId)}/cancel?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST' })
    return getNetworkScannerRun(runId, organizationId)
}

export async function getTenableIntegration(organizationId: string) {
    return requestScanner<TenableIntegration>(`/v1/integrations/tenable?organizationId=${encodeURIComponent(organizationId)}`)
}

export async function setTenableIntegration(organizationId: string, input: { region: 'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp', accessKey: string, secretKey: string }) {
    return requestScanner<TenableIntegration>(`/v1/integrations/tenable?organizationId=${encodeURIComponent(organizationId)}`, { method: 'PUT', body: input })
}

export async function removeTenableIntegration(organizationId: string) {
    return requestScanner<TenableIntegration>(`/v1/integrations/tenable?organizationId=${encodeURIComponent(organizationId)}`, { method: 'DELETE' })
}

export async function getTenableScans(organizationId: string) {
    return requestScanner<{ scans: TenableScan[] }>(`/v1/integrations/tenable/scans?organizationId=${encodeURIComponent(organizationId)}`)
}

export async function startTenableRun(input: { organizationId: string, assetId: string, requestId: string, target: string, addresses: string[], scanId: string }) {
    const accepted = await requestScanner<{ runId: string, status: TenableRun['status'] }>('/v1/integrations/tenable/runs', { method: 'POST', body: input })
    return getTenableRun(accepted.runId, input.organizationId)
}

export async function getTenableRuns(organizationId: string, limit = 50) {
    return requestScanner<{ runs: TenableRun[] }>(`/v1/integrations/tenable/runs?organizationId=${encodeURIComponent(organizationId)}&limit=${encodeURIComponent(String(limit))}`)
}

export async function getTenableRun(runId: string, organizationId: string) {
    return requestScanner<TenableRun>(`/v1/integrations/tenable/runs/${encodeURIComponent(runId)}?organizationId=${encodeURIComponent(organizationId)}`)
}

export async function cancelTenableRun(runId: string, organizationId: string) {
    return requestScanner<TenableRun>(`/v1/integrations/tenable/runs/${encodeURIComponent(runId)}/cancel?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST' })
}
