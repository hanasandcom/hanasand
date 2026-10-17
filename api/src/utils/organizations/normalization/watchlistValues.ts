import type { OrganizationWatchlistRow, OrganizationWatchlistStatus, WatchlistKind } from '../types.ts'
import { cleanText } from './text.ts'

export function normalizeWatchlistValue(kind: WatchlistKind, value: unknown) {
    const cleaned = cleanText(value)
    if (kind === 'domain') {
        return cleaned.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .split('/')[0]
    }

    if (kind === 'actor' || kind === 'keyword') {
        return cleaned.toLowerCase()
    }

    return cleaned
}

export function normalizeWatchlistStatus(row: Pick<OrganizationWatchlistRow, 'status' | 'archived_at'>): OrganizationWatchlistStatus {
    if (row.archived_at) return 'archived'
    if (row.status === 'paused' || row.status === 'archived') return row.status
    return 'active'
}
