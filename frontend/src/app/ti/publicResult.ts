import type { TiSearchResponse } from '@/utils/ti/search'
import { projectPublicResult } from './publicResultProjection'

export function sanitizeTiResultForPublicPage(result: TiSearchResponse | null): TiSearchResponse | null {
    return result ? projectPublicResult(result) : null
}
