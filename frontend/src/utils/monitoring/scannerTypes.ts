export type NmapScanProfile = 'tcp-top-100' | 'tcp-top-1000' | 'tcp-all'
export type UvmEngineSelection = { engine: 'nmap' | 'tenable-vm' | 'gvm' | 'zap', scanId?: string, profile?: NmapScanProfile }
export type UvmAsset = {
    id: string
    hostname: string
    verificationStatus: 'pending' | 'verified' | 'disabled'
    verificationRecordName: string
    verificationRecordValue: string
    verificationMethod: 'dns_txt' | 'internal'
    verifiedAt: string | null
    scanAuthorizedAt: string | null
    authorizedAddresses: string[]
    scheduleEnabled: boolean
    schedulePlan: UvmEngineSelection[]
    scheduleEngine: 'nmap' | 'tenable-vm' | 'gvm' | 'zap'
    scheduleScanId: string | null
    scheduleProfile: NmapScanProfile | 'bounded-web-dast-v1'
    zapApiDefinitionPath?: string | null
    intervalMinutes: number
    nextRunAt: string | null
    createdAt: string
}
export type UvmAssetEngineCoverage = {
    assetId: string
    engine: 'nmap' | 'tenable-vm' | 'gvm' | 'zap'
    state: 'never_scanned' | 'queued' | 'running' | 'complete' | 'partial' | 'failed' | 'cancelled' | 'unknown'
    freshness: 'never' | 'fresh' | 'stale' | 'unknown'
    lastRunId: string | null
    lastRunAt: string | null
    source: 'manual' | 'scheduled' | 'assessment' | 'unknown' | null
    profile: string | null
    status: string | null
    authorizedAddresses: string[]
    requestedAddresses: string[]
    coverageKnown: boolean
    attemptedAddresses: number | null
    reportedAttemptedAddresses: number | null
    reportedCompletedAddresses: number | null
    completedAddresses: number | null
    completedAddressList: string[] | null
    missingAddresses: string[] | null
    unattemptedAddresses: string[] | null
    scopeMatchesAuthorizedSnapshot: boolean | null
    freshnessWindowHours: number
    ageHours: number | null
    freshnessReason: string
    verificationStatus?: 'pending' | 'verified' | 'disabled'
    webCoverage?: { origin: string, requestedAddresses: number, confirmedAddresses: string[], urlsVisited: number | null, urlsDiscovered?: number | null, crawlComplete?: boolean, totalAlerts: number, acceptedAlerts: number, acceptedInstances: number, scopeFiltered: boolean, truncated: boolean, truncationReasons: string[], complete: boolean } | null
    lastCompleteRun?: {
        runId: string | null
        at: string | null
        source: 'manual' | 'scheduled' | 'assessment' | 'unknown'
        profile: string | null
        requestedAddresses: string[]
        completedAddresses: number | null
        completedAddressList: string[] | null
        scopeMatchesAuthorizedSnapshot: boolean | null
    } | null
}
export type UvmEngine = { id: string, name: string, status: 'available' | 'unavailable', version: string | null, reason: string | null, profiles: Array<{ id: string, name: string, safe: boolean }>, coverage: string[], notCovered: string[] }
export type UvmPort = { port: number, protocol: string, state: string, service: string | null, product: string | null, version: string | null, extraInfo: string | null }
export type UvmHost = { address: string, status: string, timedOut: boolean, ports: UvmPort[] }
export type UvmTenableFinding = { findingId: string, provider: 'tenable-vm', pluginId: string, cveIds: string[], title: string, severity: string, cvssScore: number | null, description: string | null, solution: string | null, evidence: string | null, assetAddress: string, firstSeen: string | null, lastSeen: string | null, status: string, observed: boolean, port: number | null, protocol: string | null }
export type UvmGvmFinding = { findingId: string, provider: 'gvm', nvtOid: string | null, cveIds: string[], title: string, severity: string, cvssScore: number | null, description: string | null, solution: string | null, evidence: string | null, assetAddress: string, port: number | null, protocol: string | null, qualityOfDetection: string | null }
export type UvmZapFinding = { findingId: string, provider: 'zap', alertRef: string, title: string, severity: string, confidence: string, description: string | null, solution: string | null, evidence: string | null, instanceUrl: string, method: string | null, parameter: string | null }
export type UvmTenableIntegration = { provider: 'tenable-vm', configured: boolean, credentialStoreAvailable: boolean, region: string | null, accessKeyHint: string | null, testedAt: string | null, updatedAt: string | null, error: string | null }
export type UvmTenableScan = { id: string, scheduleUuid: string | null, name: string, enabled: boolean, status: string | null, scannerName: string | null, targets: string }
export type UvmFinding = { id: string, assetId: string | null, asset: string, address: string | null, engine: string, externalId: string, title: string, severity: string, cvssScore: number | null, cveIds: string[], description: string | null, solution: string | null, evidence: string | null, status: 'open' | 'in_progress' | 'pending_verification' | 'accepted_risk' | 'false_positive' | 'resolved', triageNote: string | null, firstSeen: string | null, lastSeen: string | null, updatedAt: string }
export type UvmRun = { id: string, scannerRunId: string | null, requestId: string, assetId: string, target: string, targetOrigin?: string, engine: string, profile: string, source?: 'manual' | 'scheduled' | 'assessment' | 'unknown', status: string, createdAt: string, startedAt: string | null, finishedAt: string | null, error: string | null, hosts?: UvmHost[], findings?: Array<UvmTenableFinding | UvmGvmFinding | UvmZapFinding>, engineVersion: string | null, rawXmlSha256: string | null, coverage: { known?: boolean, requestedAddresses?: number, attemptedAddresses?: number, completedAddresses?: number, completedAddressList?: string[], missingAddresses?: string[], unattemptedAddresses?: string[], openPorts?: number, origin?: string, urlsVisited?: number | null, urlsDiscovered?: number | null, crawlComplete?: boolean, totalAlerts?: number, acceptedAlerts?: number, acceptedInstances?: number, scopeFiltered?: boolean, truncationReasons?: string[], truncated?: boolean, complete?: boolean } | null }
export type UvmAssessment = { id: string, requestId: string, status: 'queued' | 'running' | 'cancelling' | 'succeeded' | 'partial' | 'failed' | 'cancelled', source: 'manual' | 'scheduled', createdAt: string, startedAt: string | null, finishedAt: string | null, jobs: Array<{ id: string, assetId: string, asset: string, engine: 'nmap' | 'tenable-vm' | 'gvm' | 'zap', profile: string, stageIndex: number, stage: string, runId: string | null, status: string, error: string | null, attemptCount: number, nextAttemptAt: string | null, createdAt: string, startedAt: string | null, finishedAt: string | null }> }
export type UvmAssessmentReport = Omit<UvmAssessment, 'jobs'> & { jobs: Array<UvmAssessment['jobs'][number] & { run: UvmRun | null, reportError?: string }> }
export type UvmDashboard = { assets: UvmAsset[], coverage?: UvmAssetEngineCoverage[], engines: UvmEngine[], runs: UvmRun[], assessments: UvmAssessment[], scannerError: string | null, tenableIntegration: UvmTenableIntegration | null, tenableScans: UvmTenableScan[], findings: UvmFinding[] }
