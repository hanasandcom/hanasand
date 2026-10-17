import type { TiSearchResponse } from './response'

const cacheTtlMs = 60_000
const memoryCache = new Map<string, { expiresAt: number; result: TiSearchResponse }>()
const browserCachePrefix = 'hanasand:ti-search:'
const scopedCachePrefix = 'scope:'
type SearchOptions = {
    preferCached?: boolean
    bypassCache?: boolean
    cacheScope?: string
    cacheProjection?: (result: TiSearchResponse) => TiSearchResponse
}

export default async function searchThreatIntel(query: string, options: SearchOptions = {}): Promise<TiSearchResponse | null> {
    const clean = query.trim()
    if (!clean) return null

    const key = cacheKey(clean, options.cacheScope)
    if (!options.bypassCache) {
        const cached = readCachedResult(key)
        if (cached) {
            const projected = projectCachedResult(cached, key, options.cacheProjection)
            if (projected) return projected
        }
    }

    let response: Response
    try {
        const params = new URLSearchParams({ q: clean })
        if (options.preferCached) params.set('cached', 'true')
        response = await fetch(`/api/ti/search?${params.toString()}`, { cache: 'no-store' })
    } catch {
        return null
    }

    if (!response.ok) {
        return null
    }

    try {
        const result: unknown = await response.json()
        if (!isTiSearchResponse(result)) return null
        const projected = options.cacheProjection ? options.cacheProjection(result) : result
        if (options.cacheProjection) writeProjectedResult(key, projected)
        else writeCachedResult(key, projected)
        return projected
    } catch {
        return null
    }
}

function cacheKey(query: string, scope?: string) {
    const normalizedQuery = query.toLowerCase()
    if (scope) return `${scopedCachePrefix}${JSON.stringify([scope, normalizedQuery])}`
    return normalizedQuery.startsWith(scopedCachePrefix)
        ? `${scopedCachePrefix}${JSON.stringify([null, normalizedQuery])}`
        : normalizedQuery
}

function projectCachedResult(record: CachedResult, key: string, projection?: SearchOptions['cacheProjection']) {
    if (!projection) return record.result

    try {
        const projected = projection(record.result)
        writeProjectedResult(key, projected, record.expiresAt)
        return projected
    } catch {
        removeCachedResult(key)
        return null
    }
}

function writeProjectedResult(key: string, result: TiSearchResponse, expiresAt?: number) {
    if (result.status === 'queued' || result.status === 'searching') {
        removeCachedResult(key)
        return
    }
    writeCachedResult(key, result, expiresAt)
}

function isTiSearchResponse(value: unknown): value is TiSearchResponse {
    return typeof value === 'object'
        && value !== null
        && typeof (value as TiSearchResponse).query === 'string'
        && typeof (value as TiSearchResponse).summary === 'string'
        && Array.isArray((value as TiSearchResponse).recentActivity)
        && Array.isArray((value as TiSearchResponse).sources)
}

export const evidenceTimestamp = (...values: Array<string | null | undefined>) =>
    values.find(value => value?.trim()) ?? 'Observation date unavailable'

type CachedResult = { expiresAt: number; result: TiSearchResponse }

function readCachedResult(key: string) {
    const now = Date.now()
    const memoryHit = memoryCache.get(key)
    if (memoryHit && memoryHit.expiresAt > now) {
        return memoryHit
    }
    if (memoryHit) memoryCache.delete(key)

    if (typeof window === 'undefined') return null

    try {
        const raw = window.localStorage.getItem(`${browserCachePrefix}${key}`)
        if (!raw) return null
        const parsed = JSON.parse(raw) as { expiresAt?: number; result?: TiSearchResponse }
        if (!parsed.expiresAt || parsed.expiresAt <= now || !isTiSearchResponse(parsed.result)) {
            window.localStorage.removeItem(`${browserCachePrefix}${key}`)
            return null
        }
        return { expiresAt: parsed.expiresAt, result: parsed.result }
    } catch {
        return null
    }
}

function writeCachedResult(key: string, result: TiSearchResponse, expiresAt = Date.now() + cacheTtlMs) {
    if (result.status === 'queued' || result.status === 'searching') {
        return
    }

    const record = { expiresAt, result }
    memoryCache.set(key, record)

    if (typeof window === 'undefined') return

    try {
        window.localStorage.setItem(`${browserCachePrefix}${key}`, JSON.stringify(record))
    } catch {
        // Storage can be unavailable in private or locked-down browser contexts.
    }
}

function removeCachedResult(key: string) {
    memoryCache.delete(key)
    if (typeof window === 'undefined') return
    try {
        window.localStorage.removeItem(`${browserCachePrefix}${key}`)
    } catch {
        // Storage can be unavailable in private or locked-down browser contexts.
    }
}
