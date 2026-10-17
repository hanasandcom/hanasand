import { tiQueryKinds, type TiQueryKind, type TiSearchRequest, type TiSearchResponse } from './searchContracts.ts'
import { fetchCanonicalScraperSearch } from './scraperSearch.ts'

export type {
    TiActionabilityContract,
    TiActivity,
    TiActorIntelligenceContract,
    TiDataset,
    TiQueryKind,
    TiResultState,
    TiSearchRequest,
    TiSearchResponse,
    TiSource,
    TiTarget,
    TiTtp,
} from './searchContracts.ts'

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
