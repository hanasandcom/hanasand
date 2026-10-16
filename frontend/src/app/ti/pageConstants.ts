export type PublicTiPageEffectsProps = {
    initialQuery: string
    initialResult: TiSearchResponse | null
    query: string
    result: TiSearchResponse | null
    setQuery: (value: string) => void
    setResult: (value: TiSearchResponse | null) => void
    setBusy: (value: boolean) => void
    setError: (value: string) => void
    activeQueryRef: { current: string }
    requestSeqRef: { current: number }
}
import type { TiSearchResponse } from '@/utils/ti/search'
