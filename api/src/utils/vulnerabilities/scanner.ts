import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { runTrackedBackgroundJob } from '../backgroundJobRuntime.ts'
import { errorMessage, requestScanner } from './scannerClient.ts'

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown'
export type SeverityCount = Record<SeverityLevel, number>
export type ScannerEngine = 'trivy' | 'dockerScout'

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
const legacyStatePath = process.env.VULNERABILITY_SCAN_STATE_PATH || '/var/lib/hanasand/vulnerability-scan.json'
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
