export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown'

export type SeverityCount = Record<SeverityLevel, number>

export type VulnerabilityGroup = {
    source: string
    total: number
    severity: SeverityCount
}

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

export type ScannerEngine = 'trivy' | 'dockerScout'

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
    groups: VulnerabilityGroup[]
    vulnerabilities: VulnerabilityDetail[]
    scanError: string | null
    engines: Record<ScannerEngine, EngineScanReport>
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
    logs: Array<{
        at: string
        level: 'info' | 'warn' | 'error'
        message: string
    }>
}

export type GetVulnerabilities = {
    generatedAt: string | null
    imageCount: number
    images: ImageVulnerabilityReport[]
    scanStatus: ImageScannerStatus
    legacyImportComplete?: boolean
}


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
    scheduleEngine: 'nmap' | 'tenable-vm' | 'gvm'
    scheduleScanId: string | null
    scheduleProfile: 'tcp-top-100' | 'tcp-top-1000'
    intervalMinutes: number
    nextRunAt: string | null
    createdAt: string
}
export type UvmEngine = { id: string, name: string, status: 'available' | 'unavailable', version: string | null, reason: string | null, profiles: Array<{ id: string, name: string, safe: boolean }>, coverage: string[], notCovered: string[] }
export type UvmPort = { port: number, protocol: string, state: string, service: string | null, product: string | null, version: string | null, extraInfo: string | null }
export type UvmHost = { address: string, status: string, timedOut: boolean, ports: UvmPort[] }
export type UvmTenableFinding = { findingId: string, provider: 'tenable-vm', pluginId: string, cveIds: string[], title: string, severity: string, cvssScore: number | null, description: string | null, solution: string | null, evidence: string | null, assetAddress: string, firstSeen: string | null, lastSeen: string | null, status: string, observed: boolean, port: number | null, protocol: string | null }
export type UvmTenableIntegration = { provider: 'tenable-vm', configured: boolean, credentialStoreAvailable: boolean, region: string | null, accessKeyHint: string | null, testedAt: string | null, updatedAt: string | null, error: string | null }
export type UvmTenableScan = { id: string, scheduleUuid: string | null, name: string, enabled: boolean, status: string | null, scannerName: string | null, targets: string }
export type UvmFinding = { id: string, assetId: string | null, asset: string, address: string | null, engine: string, externalId: string, title: string, severity: string, cvssScore: number | null, cveIds: string[], description: string | null, solution: string | null, evidence: string | null, status: 'open' | 'in_progress' | 'pending_verification' | 'accepted_risk' | 'false_positive' | 'resolved', triageNote: string | null, firstSeen: string | null, lastSeen: string | null, updatedAt: string }
export type UvmRun = { id: string, scannerRunId: string | null, requestId: string, assetId: string, target: string, engine: string, profile: string, source: 'manual' | 'scheduled', status: string, createdAt: string, startedAt: string | null, finishedAt: string | null, error: string | null, hosts: UvmHost[], findings?: UvmTenableFinding[], engineVersion: string | null, rawXmlSha256: string | null, coverage: { known?: boolean, requestedAddresses?: number, attemptedAddresses: number, completedAddresses: number, completedAddressList?: string[], missingAddresses?: string[], unattemptedAddresses?: string[], openPorts?: number } | null }
export type UvmAssessment = { id: string, requestId: string, status: 'queued' | 'running' | 'cancelling' | 'succeeded' | 'partial' | 'failed' | 'cancelled', createdAt: string, startedAt: string | null, finishedAt: string | null, jobs: Array<{ id: string, assetId: string, asset: string, engine: 'nmap' | 'tenable-vm' | 'gvm', profile: string, stageIndex: number, stage: string, runId: string | null, status: string, error: string | null, attemptCount: number, nextAttemptAt: string | null, createdAt: string, startedAt: string | null, finishedAt: string | null }> }
export type UvmDashboard = { assets: UvmAsset[], engines: UvmEngine[], runs: UvmRun[], assessments: UvmAssessment[], scannerError: string | null, tenableIntegration: UvmTenableIntegration | null, tenableScans: UvmTenableScan[], findings: UvmFinding[] }

export type TrafficMetric = {
    key: string
    count: number
}

export type TrafficSlowMetric = {
    key: string
    avg_time: number
}

export type TrafficMetrics = {
    sampled_at?: string
    total_requests: number
    avg_request_time: number
    error_rate: number
    top_methods: TrafficMetric[]
    top_status_codes: TrafficMetric[]
    top_domains: TrafficMetric[]
    top_os: TrafficMetric[]
    top_browsers: TrafficMetric[]
    requests_over_time: TrafficMetric[]
    top_error_paths: TrafficMetric[]
    top_slow_paths: TrafficSlowMetric[]
    top_paths: TrafficMetric[]
}

export type TrafficRecord = {
    id: number
    user_agent: string
    domain: string
    path: string
    method: string
    referer: string
    request_time: number
    status: number
    timestamp: string
    country_iso?: string | null
}

export type TrafficRecords = {
    result: TrafficRecord[]
    total: number
}

export type TrafficDomains = {
    domains: string[]
}
