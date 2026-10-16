import type { ApiPayload, ResourceResult } from './values'
import { numberValue, recordArray, stringValue } from './values'

// Keep the dashboard responsive when a secondary history query is unhealthy.
// Cached data is still served while the next request refreshes it.
const TI_ADMIN_FETCH_TIMEOUT_MS = 5_000
const TI_ADMIN_SOURCE_CACHE_TTL_MS = 60_000
const useProcessCache = process.env.NODE_ENV === 'production'
const sourceInventoryCache = new Map<string, { expiresAt: number, value: ResourceResult, refreshing?: Promise<void> }>()

export function invalidateTiAdminSourceOperationsCache() {
    for (const key of sourceInventoryCache.keys()) {
        if (key.startsWith('["source-operations",')) sourceInventoryCache.delete(key)
    }
}

export async function fetchResource(base: string, path: string, key: string, tenantId: string | null, page: { page?: number, limit?: number, sourceId?: string, query?: string, family?: string, lifecycle?: string, access?: string, health?: string, output?: string, matches?: string, sort?: string, direction?: string, includeCandidates?: boolean } = {}, skipCache = false): Promise<ResourceResult> {
    const resource = path.split('/').at(-1) || key
    const cacheKey = JSON.stringify([resource, base, tenantId, page])
    if (cacheKey && useProcessCache && !skipCache) {
        const cached = sourceInventoryCache.get(cacheKey)
        if (cached && cached.expiresAt > Date.now()) return cached.value
        if (cached) {
            cached.refreshing ||= fetchResource(base, path, key, tenantId, page, true).then(value => {
                if (value.ok) {
                    sourceInventoryCache.set(cacheKey, { expiresAt: Date.now() + resourceCacheTtl(resource), value })
                } else {
                    cached.expiresAt = Date.now() + 5_000
                }
            }).catch(() => { cached.expiresAt = Date.now() + 5_000 }).finally(() => { delete cached.refreshing })
            return cached.value
        }
    }
    try {
        const target = new URL(path, base)
        if (tenantId) target.searchParams.set('tenantId', tenantId)
        target.searchParams.set('limit', String(page.limit || 500))
        target.searchParams.set('page', String(page.page || 1))
        if (page.sourceId) target.searchParams.set('sourceId', page.sourceId)
        if (page.query) target.searchParams.set('q', page.query)
        for (const key of ['family', 'lifecycle', 'access', 'health', 'output', 'matches', 'sort', 'direction'] as const) if (page[key]) target.searchParams.set(key === 'direction' ? 'dir' : key, page[key] as string)
        if (page.includeCandidates) target.searchParams.set('includeCandidates', 'true')
        const serviceToken = process.env.TI_SCRAPER_SERVICE_TOKEN?.trim()
        const response = await fetch(target, {
            ...(resource === 'source-operations' ? { cache: 'no-store' as const } : { cache: 'force-cache' as const, next: { revalidate: 5 } }),
            headers: serviceToken ? { 'x-hanasand-service-token': serviceToken } : undefined,
            signal: AbortSignal.timeout(TI_ADMIN_FETCH_TIMEOUT_MS),
        })
        if (!response.ok) return { resource, ok: false, records: [] as ApiPayload[], total: 0, nextCursor: undefined, previousCursor: undefined, payload: {} as ApiPayload }
        const payload = await response.json() as ApiPayload
        const records = recordArray(payload[key])
        const result = {
            resource,
            ok: true,
            records,
            total: numberValue(payload.total, records.length),
            nextCursor: stringValue(payload.nextCursor) || undefined,
            previousCursor: stringValue(payload.previousCursor) || undefined,
            payload,
        }
        if (result.ok && cacheKey && useProcessCache) {
            sourceInventoryCache.set(cacheKey, { expiresAt: Date.now() + resourceCacheTtl(resource), value: result })
            while (sourceInventoryCache.size > 128) {
                const oldestKey = sourceInventoryCache.keys().next().value
                if (oldestKey === undefined) break
                sourceInventoryCache.delete(oldestKey)
            }
        }
        return result
    } catch {
        return { resource, ok: false, records: [] as ApiPayload[], total: 0, nextCursor: undefined, previousCursor: undefined, payload: {} as ApiPayload }
    }
}

function resourceCacheTtl(resource: string) {
    return resource === 'source-operations' ? TI_ADMIN_SOURCE_CACHE_TTL_MS : 5_000
}

export function emptyResource(resource: string) {
    return { resource, ok: true, records: [] as ApiPayload[], total: 0, nextCursor: undefined, previousCursor: undefined, payload: {} as ApiPayload }
}
