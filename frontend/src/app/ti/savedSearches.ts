export const TI_SAVED_SEARCHES_KEY = 'hanasand:ti:saved-searches'
export const TI_SAVED_SEARCH_LIMIT = 8
export type SavedSearch = { query: string, savedAt?: string }

export function parseSavedSearches(value: unknown, allowMissingTimestamp = false): SavedSearch[] {
    if (!Array.isArray(value)) return []
    return value
        .filter((item): item is SavedSearch => Boolean(item && typeof item.query === 'string' && (typeof item.savedAt === 'string' || allowMissingTimestamp && item.savedAt === undefined)))
        .slice(0, TI_SAVED_SEARCH_LIMIT)
}

export function addSavedSearch(searches: SavedSearch[], query: string, savedAt: string): SavedSearch[] {
    return [{ query, savedAt }, ...searches.filter(item => item.query.toLowerCase() !== query.toLowerCase())]
        .slice(0, TI_SAVED_SEARCH_LIMIT)
}

export function removeSavedSearch(searches: SavedSearch[], query: string): SavedSearch[] {
    return searches.filter(item => item.query !== query)
}

export function persistSavedSearches(storage: Pick<Storage, 'setItem'>, searches: SavedSearch[]): void {
    storage.setItem(TI_SAVED_SEARCHES_KEY, JSON.stringify(searches))
}
