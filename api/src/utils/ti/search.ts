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

const tiQueryKinds = ['actor', 'domain', 'cve', 'indicator', 'organization', 'free_text'] as const
type TiQueryKind = typeof tiQueryKinds[number]

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

const cache = new Map<string, { expiresAt: number, result: TiSearchResponse }>()
const MAX_CACHED_SEARCH_RESULTS = 500
const COMPLETED_SEARCH_CACHE_TTL_MS = 60_000
const PENDING_SEARCH_CACHE_MAX_TTL_MS = 5_000
const DEFAULT_PENDING_REFRESH_SECONDS = 5

export async function searchThreatIntel(input: TiSearchRequest): Promise<TiSearchResponse> {
    const query = input.query.trim()
    if (!query) throw new Error('query is required')

    const queryKind = classifyTiQuery(query)
    const key = query.toLowerCase()
    const cached = cache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
        return { ...cached.result, queryKind: cached.result.queryKind ?? queryKind, generatedAt: new Date().toISOString(), cacheStatus: 'hit' }
    }
    if (cached) cache.delete(key)

    const scraperBase = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    if (scraperBase) {
        const scraperResult = await fetchCanonicalScraperSearch(scraperBase, query, queryKind, {
            cachedOnly: input.preferCached && queryKind === 'actor',
            preflightHealth: input.preflightHealth,
        })
        if (scraperResult) {
            const result = { ...scraperResult, queryKind: isTiQueryKind(scraperResult.queryKind) ? scraperResult.queryKind : queryKind, mode: 'scraper' as const, cacheStatus: 'miss' as const }
            if (!(input.preferCached && queryKind === 'actor')) writeCache(key, result)
            return result
        }
    }

    return unavailableResult(query, queryKind)
}

export function classifyTiQuery(query: string): TiQueryKind {
    const clean = query.trim()
    if (/^cve-\d{4}-\d{4,}$/i.test(clean)) return 'cve'
    if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(clean)) return 'domain'
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(clean) || /^(?:https?:\/\/|[a-f0-9]{32,128}$)/i.test(clean)) return 'indicator'
    if (/^(?:apt\d+|unc\d+|ta\d+)$/i.test(clean)) return 'actor'
    if (/\b(?:inc|corp|corporation|company|limited|ltd|llc|group|bank|university|hospital)\b/i.test(clean) || clean.includes(' ')) return 'organization'
    return 'free_text'
}

function isTiQueryKind(value: unknown): value is TiQueryKind {
    return typeof value === 'string' && tiQueryKinds.includes(value as TiQueryKind)
}

async function fetchCanonicalScraperSearch(
    scraperBase: string,
    query: string,
    queryKind: TiQueryKind,
    options: { cachedOnly?: boolean, preflightHealth?: boolean } = {},
): Promise<TiSearchResponse | null> {
    try {
        const serviceToken = process.env.TI_SCRAPER_SERVICE_TOKEN?.trim()
        const headers = serviceToken ? { 'x-hanasand-service-token': serviceToken } : undefined
        if (options.preflightHealth) {
            const health = await fetch(new URL('/v1/health', `${scraperBase}/`), { headers, signal: AbortSignal.timeout(350) })
            if (!health.ok) return null
        }
        const target = new URL('/v1/intel/search', `${scraperBase}/`)
        target.searchParams.set('q', query)
        const entityType = scraperEntityType(queryKind)
        if (entityType) target.searchParams.set('entityType', entityType)
        target.searchParams.set('limit', '50')
        if (options.cachedOnly) target.searchParams.set('cached', 'true')
        const response = await fetch(target, { headers, signal: AbortSignal.timeout(12_000) })
        if (!response.ok) return null
        const result = await response.json() as TiSearchResponse
        if (result.query.trim().toLowerCase() !== query.toLowerCase() || !Array.isArray(result.sources) || !Array.isArray(result.recentActivity)) return null
        return result
    } catch {
        return null
    }
}

function unavailableResult(query: string, queryKind: TiQueryKind): TiSearchResponse {
    const domainCandidate = queryKind === 'domain' ? [{
        kind: 'domain' as const,
        value: query.toLowerCase(),
        reason: 'Exact domain supplied by the user; organization watchlists support domain terms.',
        confidence: 1,
    }] : []
    return {
        query,
        queryKind,
        generatedAt: new Date().toISOString(),
        mode: 'unavailable',
        status: 'unavailable',
        summary: 'Search unavailable',
        confidence: 0,
        lastSeen: '',
        aliases: [],
        recentActivity: [],
        targets: [],
        ttps: [],
        datasets: [],
        sources: [],
        notes: ['Canonical TI collection is temporarily unavailable; no intelligence was inferred.'],
        cacheStatus: 'miss',
        actionability: { schemaVersion: 'ti.query.actionability.v1', alertDisposition: 'needs_enrichment', shouldAlert: false, rationale: 'No durable evidence is available.', watchlistCandidates: domainCandidate },
    }
}

function scraperEntityType(queryKind: TiQueryKind) {
    switch (queryKind) {
        case 'actor':
        case 'domain':
        case 'cve':
        case 'indicator':
            return queryKind
        default:
            return undefined
    }
}

function writeCache(key: string, result: TiSearchResponse) {
    const pending = result.status === 'queued' || result.status === 'searching'
    const requestedRefreshMs = Number(result.refreshAfterSeconds ?? DEFAULT_PENDING_REFRESH_SECONDS) * 1_000
    const ttlMs = pending
        ? Math.min(PENDING_SEARCH_CACHE_MAX_TTL_MS, Math.max(0, requestedRefreshMs))
        : COMPLETED_SEARCH_CACHE_TTL_MS
    cache.set(key, { expiresAt: Date.now() + ttlMs, result })
    evictOldestCacheEntry()
}

function evictOldestCacheEntry() {
    if (cache.size <= MAX_CACHED_SEARCH_RESULTS) return
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) cache.delete(oldestKey)
}
