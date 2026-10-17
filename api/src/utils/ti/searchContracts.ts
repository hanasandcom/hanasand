export interface TiSearchRequest {
    query: string
    preferCached?: boolean
    preflightHealth?: boolean
}

export type TiResultState = 'queued' | 'searching' | 'partial' | 'ready' | 'metadata_review' | 'blocked_unsafe_target' | 'needs_source_activation' | 'unavailable'

export interface TiActivity {
    date: string
    title: string
    detail: string
    confidence: number
    sourceIds: string[]
    url?: string
    claimType?: 'campaign' | 'victim_claim' | 'malware_activity' | 'vulnerability_exploitation' | 'infrastructure_activity' | 'general_activity'
    victimName?: string
    affectedSectors?: string[]
    countries?: string[]
    impact?: string
    firstReportedAt?: string
    lastReportedAt?: string
    publisherCount?: number
    corroboratingSourceIds?: string[]
    contradictingSourceIds?: string[]
    assertionKind?: 'source_claim'
    reviewState?: string
    corroborationState?: string
    observationSummary?: string
}

export interface TiTarget {
    sector: string
    regions: string[]
    rationale: string
    confidence: number
}

export interface TiTtp {
    name: string
    attackId?: string
    tactic: string
    detail: string
    confidence: number
    extractionMethod?: string
    extractorVersion?: string
}

export interface TiDataset {
    name: string
    type: 'clear_web' | 'public_channel' | 'darknet_metadata' | 'vendor_report' | 'stix_export'
    coverage: string
    status: 'available' | 'planned' | 'metadata_only'
    url?: string
}

export interface TiSource {
    id: string
    name: string
    type: string
    provenance: string
    url?: string
    captureId?: string
    sourceRequestId?: string
    sourceFamily?: string
    parserStatus?: string
    reportDate?: string
    lastCollectedAt?: string
}

export interface TiActorIntelligenceContract {
    actorClass?: string
    attribution?: string
    firstSeen?: string
    lastSeen?: string
    motivation?: string[]
    malwareTools?: string[]
    campaigns?: string[]
    infrastructure?: string[]
    targetSectors?: string[]
    geographies?: string[]
    confidence?: number
    confidenceReasoning?: string[]
    sourceProvenance?: string[]
}

export interface TiActionabilityContract {
    schemaVersion?: 'ti.query.actionability.v1'
    alertDisposition?: 'ready_for_alert_review' | 'watchlist_required' | 'case_ready' | 'not_alertable' | 'needs_enrichment'
    shouldAlert?: boolean
    rationale?: string
    watchlistCandidates?: Array<{
        kind: 'company' | 'domain' | 'vendor'
        value: string
        reason: string
        confidence?: number
    }>
    [key: string]: unknown
}

export const tiQueryKinds = ['actor', 'domain', 'cve', 'indicator', 'organization', 'free_text'] as const
export type TiQueryKind = typeof tiQueryKinds[number]

export interface TiSearchResponse {
    query: string
    queryKind?: TiQueryKind
    generatedAt: string
    mode: 'scraper' | 'seeded' | 'live_search' | 'unavailable'
    cacheStatus?: 'hit' | 'miss'
    status?: TiResultState
    runId?: string
    refreshAfterSeconds?: number
    summary: string
    confidence: number
    lastSeen: string
    aliases: string[]
    recentActivity: TiActivity[]
    targets: TiTarget[]
    ttps: TiTtp[]
    datasets: TiDataset[]
    sources: TiSource[]
    notes: string[]
    operationalStatus?: unknown
    analystLoop?: unknown
    actorIntelligence?: TiActorIntelligenceContract
    actionability?: TiActionabilityContract
    [key: string]: unknown
}
