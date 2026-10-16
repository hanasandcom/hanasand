export type TiAdminSource = {
    tenantId?: string
    id: string
    name: string
    family: string
    type: string
    accessMethod: string
    status: 'active' | 'candidate' | 'paused' | 'review'
    risk: 'low' | 'medium' | 'restricted'
    owner: string
    url: string
    domain: string
    lastRunAt: string
    nextRunAt: string
    executable?: boolean
    monitoredSince: string
    cadenceMinutes: number
    retainedEvidenceCount: number
    customerMatchCount: number
    productiveCycleCount: number
    qualifiesForBaseline: boolean
    qualificationReasons: string[]
    baselineFamily: string
    lastError?: string
    healthState: string
    lastCheckedAt: string
    lastContentAt: string
    lastUsefulAt: string
    backoffUntil?: string
    domains: string[]
    resultTypes: string[]
    buyerValue: string
    legalNotes: string
    screenshotIds: string[]
    aiReview?: TiAdminAiReview
}

export type TiAdminDomain = {
    domain: string
    company: string
    matchedTerms: string[]
    sourceIds: string[]
    resultCount: number
    lastSeenAt: string
    status: 'watching' | 'review' | 'quiet'
    aiReview?: TiAdminAiReview
}

export type TiAdminAiReview = {
    reviewer: 'hanasand-ai'
    status: 'approved' | 'rejected' | 'stale' | 'needs_human' | 'pending'
    reviewedAt: string
    confidencePercent: number
    summary: string
    checks: string[]
}

export type TiAdminCapture = {
    id: string
    sourceId: string
    sourceName: string
    sourceFamily: string
    domain: string
    actor: string
    title: string
    publishedAt: string
    capturedAt: string
    monitoredSince: string
    owner: string
    pageUrl: string
    pageType: string
    screenshotLabel: string
    screenshotTakenAt: string
    resultSummary: string
    metadata: Array<{ label: string, value: string }>
    normalizedEvidence?: {
        status: string
        failureReason?: string
        title?: string
        author?: string
        publishedAt?: string
        headings: string[]
        namedEntities: string[]
        incidentLanguage: string[]
        text: string
        excerpt: string
    }
}

export type TiAdminRun = {
    id: string
    sourceId: string
    sourceName: string
    sourceFamily: string
    sourceUrl: string
    status: 'completed' | 'queued' | 'running' | 'failed'
    startedAt: string
    finishedAt?: string
    nextRunAt: string
    rows: number
    captures: number
    screenshots: number
    message: string
    trigger: 'automated' | 'manual' | 'unknown'
}

export type TiAdminOverview = {
    sources: TiAdminSource[]
    domains: TiAdminDomain[]
    captures: TiAdminCapture[]
    runs: TiAdminRun[]
    availability: {
        state: 'live' | 'degraded'
        failedResources: string[]
    }
    sourcePage: {
        total: number
        page: number
        limit: number
        nextCursor?: string
        previousCursor?: string
    }
    sourceTotals: {
        configured: number
        executable: number
        active: number
        qualifying: number
        qualifyingClearWeb: number
        qualifyingLawfulDarkWeb: number
        qualifyingPublicTelegram: number
    }
}
