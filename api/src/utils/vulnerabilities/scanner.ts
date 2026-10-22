import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { runTrackedBackgroundJob } from '../backgroundJobRuntime.ts'

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown'
export type SeverityCount = Record<SeverityLevel, number>
export type ScannerEngine = 'trivy' | 'dockerScout'

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
    timedOut: boolean
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
    coverage: { known: boolean, requestedAddresses: number, attemptedAddresses: number, completedAddresses: number, completedAddressList: string[], missingAddresses: string[], unattemptedAddresses: string[] }
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

export type GvmFinding = {
    findingId: string; provider: 'gvm'; nvtOid: string | null; cveIds: string[]; title: string; severity: SeverityLevel | 'info'
    cvssScore: number | null; description: string | null; solution: string | null; evidence: string | null
    assetAddress: string; port: number | null; protocol: string | null; qualityOfDetection: string | null
}
export type GvmRun = {
    runId: string; organizationId: string; assetId: string; requestId: string; target: string; addresses: string[]
    status: 'queued' | 'launching' | 'running' | 'cancelling' | 'succeeded' | 'partial' | 'failed' | 'cancelled'
    progress: string | null; findings: GvmFinding[]; coverage: { attemptedAddresses: number, completedAddresses: number, completedAddressList: string[], missingAddresses: string[] } | null
    rawReportSha256: string | null; error: string | null; createdAt: string; startedAt: string | null; finishedAt: string | null
}
export type GvmEngineStatus = { id: 'gvm', name: string, provider: 'gvm', available: boolean, configured: boolean, ready: boolean, profile: string, protocol?: string | null, feedsReady?: boolean, feedsSyncing?: boolean, feedVersions?: string[], error: string | null }

export type VulnerabilityDetail = {
    id: string
    title: string
    severity: SeverityLevel
    source: string
    packageName: string | null
    packageType: string | null
    installedVersion: string | null
    fixedVersion: string | null
    description: string | null
    references: string[]
    scanners: ScannerEngine[]
}

export type EngineScanReport = {
    status: 'success' | 'error' | 'not_run'
    scannedAt: string | null
    totalVulnerabilities: number
    severity: SeverityCount
    error: string | null
    quickview?: string | null
}

export type ImageVulnerabilityReport = {
    image: string
    scannedAt: string
    totalVulnerabilities: number
    severity: SeverityCount
    groups: Array<{ source: string, total: number, severity: SeverityCount }>
    vulnerabilities: VulnerabilityDetail[]
    scanError: string | null
    engines: Record<ScannerEngine, EngineScanReport>
}

export type VulnerabilityScanLog = {
    at: string
    level: 'info' | 'warn' | 'error'
    message: string
}

export type ImageScannerStatus = {
    isRunning: boolean
    startedAt: string | null
    finishedAt: string | null
    lastSuccessAt: string | null
    lastError: string | null
    totalImages: number | null
    completedImages: number
    currentImage: string | null
    estimatedCompletionAt: string | null
    enabled: boolean
    paused: boolean
    schedule: string
    cadenceSeconds: number
    nextRunAt: string | null
    targetCount: number
    failureCount: number
    stale: boolean
    staleReason: string | null
    blocker: string | null
    blockerAction: string | null
    logs: VulnerabilityScanLog[]
}

export type VulnerabilityReport = {
    generatedAt: string | null
    imageCount: number
    images: ImageVulnerabilityReport[]
    scanStatus: ImageScannerStatus
    legacyImportComplete?: boolean
}

export const VULNERABILITY_SCAN_JOB_ID = 'api-vulnerability-scanner'
export const VULNERABILITY_SCAN_CADENCE_SECONDS = Number(process.env.SCANNER_INTERVAL_SECONDS || process.env.VULNERABILITY_SCAN_INTERVAL_SECONDS || 3600)
const scannerUrl = (process.env.HANASAND_SCANNER_URL || '').trim().replace(/\/$/, '')
const serviceToken = process.env.HANASAND_SCANNER_SERVICE_TOKEN || ''
const legacyStatePath = process.env.VULNERABILITY_SCAN_STATE_PATH || '/var/lib/hanasand/vulnerability-scan.json'
const requestTimeoutMs = 30_000
let legacyImportInProgress = false

function emptyReport(error?: string): VulnerabilityReport {
    const now = new Date().toISOString()
    const schedule = VULNERABILITY_SCAN_CADENCE_SECONDS % 3600 === 0
        ? `Every ${VULNERABILITY_SCAN_CADENCE_SECONDS / 3600} hour${VULNERABILITY_SCAN_CADENCE_SECONDS === 3600 ? '' : 's'}`
        : `Every ${Math.max(1, Math.round(VULNERABILITY_SCAN_CADENCE_SECONDS / 60))} minutes`
    const log = error
        ? { at: now, level: 'error' as const, message: error }
        : { at: new Date(0).toISOString(), level: 'info' as const, message: 'Waiting for Scanner service.' }
    return {
        generatedAt: null,
        imageCount: 0,
        images: [],
        scanStatus: {
            isRunning: false,
            startedAt: null,
            finishedAt: null,
            lastSuccessAt: null,
            lastError: error || null,
            totalImages: null,
            completedImages: 0,
            currentImage: null,
            estimatedCompletionAt: null,
            enabled: true,
            paused: false,
            schedule,
            cadenceSeconds: VULNERABILITY_SCAN_CADENCE_SECONDS,
            nextRunAt: null,
            targetCount: 0,
            failureCount: error ? 1 : 0,
            stale: true,
            staleReason: error || 'No vulnerability scan has completed yet.',
            blocker: error || null,
            blockerAction: error ? 'Check that the standalone Scanner service is running and reachable.' : null,
            logs: [log],
        },
    }
}

export async function getVulnerabilityReport(): Promise<VulnerabilityReport> {
    try {
        let report = await requestScanner<VulnerabilityReport>('/v1/report')
        if (!report.legacyImportComplete && !legacyImportInProgress) {
            legacyImportInProgress = true
            try {
                let state: unknown = null
                if (existsSync(legacyStatePath)) {
                    try {
                        state = JSON.parse(await readFile(legacyStatePath, 'utf8'))
                    } catch {
                        // A malformed legacy file must not keep the new service unavailable.
                    }
                }
                await requestScanner('/v1/legacy-state', { method: 'POST', body: { state } })
                report = await requestScanner<VulnerabilityReport>('/v1/report')
            } finally {
                legacyImportInProgress = false
            }
        }
        return report
    } catch (error) {
        return emptyReport(`Scanner service is temporarily unavailable: ${errorMessage(error)}`)
    }
}

export async function startTrackedVulnerabilityScan() {
    return runTrackedBackgroundJob(VULNERABILITY_SCAN_JOB_ID, async () => {
        const response = await requestScanner<{ report?: VulnerabilityReport }>('/v1/scan', { method: 'POST' })
        return response.report || getVulnerabilityReport()
    })
}

export async function setVulnerabilityScannerPaused(paused: boolean) {
    return requestScanner<VulnerabilityReport>('/v1/schedule', { method: 'PUT', body: { enabled: !paused } })
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

export async function getGvmEngineStatus() {
    return requestScanner<GvmEngineStatus>('/v1/integrations/gvm/status', { timeoutMs: 8_000 })
}

export async function startGvmRun(input: { organizationId: string, assetId: string, requestId: string, target: string, addresses: string[] }) {
    const accepted = await requestScanner<{ runId: string, status: GvmRun['status'] }>('/v1/integrations/gvm/runs', { method: 'POST', body: input })
    return getGvmRun(accepted.runId, input.organizationId)
}

export async function getGvmRun(runId: string, organizationId: string) {
    return requestScanner<GvmRun>(`/v1/integrations/gvm/runs/${encodeURIComponent(runId)}?organizationId=${encodeURIComponent(organizationId)}`)
}

export async function getGvmRuns(organizationId: string, limit = 50) {
    return requestScanner<{ runs: GvmRun[] }>(`/v1/integrations/gvm/runs?organizationId=${encodeURIComponent(organizationId)}&limit=${encodeURIComponent(String(limit))}`)
}

export async function cancelGvmRun(runId: string, organizationId: string) {
    return requestScanner<GvmRun>(`/v1/integrations/gvm/runs/${encodeURIComponent(runId)}/cancel?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST' })
}

async function requestScanner<T>(route: string, options: { method?: string, body?: unknown, timeoutMs?: number } = {}): Promise<T> {
    if (!scannerUrl) throw new Error('HANASAND_SCANNER_URL is not configured.')
    if (!serviceToken) throw new Error('HANASAND_SCANNER_SERVICE_TOKEN is not configured.')
    const response = await fetch(`${scannerUrl}${route}`, {
        method: options.method || 'GET',
        headers: {
            'x-hanasand-service-token': serviceToken,
            ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(options.timeoutMs || requestTimeoutMs),
    })
    if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(scannerErrorMessage(body, response.status))
    }
    return response.json() as Promise<T>
}

function scannerErrorMessage(body: string, status: number) {
    let code = ''
    try {
        const parsed = JSON.parse(body) as { error?: unknown, message?: unknown }
        if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.slice(0, 300)
        if (typeof parsed.error === 'string') code = parsed.error
    } catch { return body.slice(0, 300) || `Scanner service returned HTTP ${status}.` }
    if (code === 'tenable_scan_configuration_busy') return 'Another assessment is already running from this Tenable scan profile. Try again after it finishes.'
    if (code === 'tenable_scan_configuration_unavailable') return 'The selected Tenable scan profile is unavailable or disabled. Refresh the profile list and choose an enabled profile.'
    if (code === 'tenable_integration_not_configured') return 'Connect a Tenable Vulnerability Management account before starting this assessment.'
    return code ? code.replaceAll('_', ' ') : `Scanner service returned HTTP ${status}.`
}

function errorMessage(error: unknown) {
    if (error instanceof Error) return error.name === 'TimeoutError' ? 'Request timed out.' : error.message
    return String(error)
}
