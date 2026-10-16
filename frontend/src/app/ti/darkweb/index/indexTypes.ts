export interface DarkwebStatusResponse {
    status?: DarkwebStatus
    darkwebIndex?: DarkwebStatus
}

export interface DarkwebStatus {
    indexedRecordCount?: number
    monitoredSourceCount?: number
    metadataOnly?: boolean
    generatedAt?: string
    latestRecordAt?: string
    counts?: {
        byNetwork?: Record<string, number>
        byLegalTriage?: Record<string, number>
        byLiveness?: Record<string, number>
        byReviewState?: Record<string, number>
    }
    noLeakSerialization?: { passed?: boolean }
}

export interface DarkwebSearchResponse {
    generatedAt?: string
    count?: number
    nextCursor?: string
    rows?: DarkwebRecord[]
    canonicalIdentity?: {
        type: 'actor'
        canonicalName: string
        aliases: string[]
        canonicalPath: string
        restrictedEvidenceState: 'available' | 'no_approved_restricted_evidence'
        restrictedRecordCount: number
    }
    noLeakSerialization?: { passed?: boolean }
}

export interface DarkwebRecord {
    id: string
    network: string
    title: string
    safeSummary: string
    category: string
    legalTriage: string
    liveness: string
    firstSeen: string
    lastSeen: string
    reviewState: string
    actorHints?: string[]
    victimHints?: string[]
    datasetHints?: string[]
    sectorHints?: string[]
    countryHints?: string[]
    safeLocatorHash: string
}

export interface DarkwebIndexFilters {
    query: string
    category: string
    legalTriage: string
    network: string
    reviewState: string
}
