import type { TiSearchResponse } from './response'

const cacheTtlMs = 60_000
const memoryCache = new Map<string, { expiresAt: number; result: TiSearchResponse }>()
const browserCachePrefix = 'hanasand:ti-search:'

export default async function searchThreatIntel(query: string, options: { preferCached?: boolean; bypassCache?: boolean } = {}): Promise<TiSearchResponse | null> {
    const clean = query.trim()
    if (!clean) return null

    const key = clean.toLowerCase()
    if (!options.bypassCache) {
        const cached = readCachedResult(key)
        if (cached) return cached
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
        writeCachedResult(key, result)
        return result
    } catch {
        return null
    }
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

function readCachedResult(key: string) {
    const now = Date.now()
    const memoryHit = memoryCache.get(key)
    if (memoryHit && memoryHit.expiresAt > now) {
        return memoryHit.result
    }
    if (memoryHit) memoryCache.delete(key)

    if (typeof window === 'undefined') return null

    try {
        const raw = window.localStorage.getItem(`${browserCachePrefix}${key}`)
        if (!raw) return null
        const parsed = JSON.parse(raw) as { expiresAt?: number; result?: TiSearchResponse }
        if (!parsed.expiresAt || parsed.expiresAt <= now || !parsed.result?.query) {
            window.localStorage.removeItem(`${browserCachePrefix}${key}`)
            return null
        }
        return parsed.result
    } catch {
        return null
    }
}

function writeCachedResult(key: string, result: TiSearchResponse) {
    if (result.status === 'queued' || result.status === 'searching') {
        return
    }

    const record = { expiresAt: Date.now() + cacheTtlMs, result }
    memoryCache.set(key, record)

    if (typeof window === 'undefined') return

    try {
        window.localStorage.setItem(`${browserCachePrefix}${key}`, JSON.stringify(record))
    } catch {
        // Storage can be unavailable in private or locked-down browser contexts.
    }
}
