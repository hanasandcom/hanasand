import type { TiQueryKind, TiSearchResponse } from './searchContracts.ts'

export async function fetchCanonicalScraperSearch(
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
