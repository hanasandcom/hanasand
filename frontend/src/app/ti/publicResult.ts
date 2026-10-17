import type { TiSearchResponse } from '@/utils/ti/search'
import searchThreatIntel from '@/utils/ti/search'
import { projectPublicResult } from './publicResultProjection'

export async function searchPublicTiResult(query: string, options: { preferCached?: boolean; bypassCache?: boolean } = {}) {
    return searchThreatIntel(query, {
        ...options,
        cacheScope: 'public',
        cacheProjection: projectPublicResult,
    })
}

export function sanitizeTiResultForPublicPage(result: TiSearchResponse | null): TiSearchResponse | null {
    return result ? projectPublicResult(result) : null
}
