import type { OrganizationWatchlistAction, OrganizationWatchlistStatus, WatchlistActionInput, WatchlistCleanupInput, WatchlistInput, WatchlistKind } from './types.ts'
import { cleanText } from './normalization/text.ts'
import { normalizeWatchlistMutationMetadata } from './normalization/requestValues.ts'
import { normalizeWatchlistValue } from './normalization/watchlistValues.ts'

const watchlistActions = new Set<OrganizationWatchlistAction>(['pause', 'resume', 'archive', 'restore'])
const watchlistKinds = new Set<WatchlistKind>(['company', 'domain', 'vendor', 'actor', 'keyword'])
const watchlistStatuses = new Set<OrganizationWatchlistStatus>(['active', 'paused', 'archived'])

export function normalizeWatchlistInput(body: WatchlistInput | undefined) {
    const kind = cleanText(body?.kind).toLowerCase()
    if (!watchlistKinds.has(kind as WatchlistKind)) {
        throw new Error('Watchlist kind must be company, domain, vendor, actor, or keyword.')
    }

    const value = normalizeWatchlistValue(kind as WatchlistKind, body?.value)
    if (!value) {
        throw new Error('Watchlist value is required.')
    }

    if (value.length > 240) {
        throw new Error('Watchlist value must be 240 characters or fewer.')
    }

    const notes = cleanText(body?.notes)
    const { reason, requestId } = normalizeWatchlistMutationMetadata(body)
    return {
        kind: kind as WatchlistKind,
        value,
        notes: notes.slice(0, 2000),
        reason,
        requestId,
    }
}

export function normalizeOptionalWatchlistKind(value: unknown): WatchlistKind | null {
    const kind = cleanText(value).toLowerCase()
    return watchlistKinds.has(kind as WatchlistKind) ? kind as WatchlistKind : null
}

export function normalizeOptionalWatchlistStatus(value: unknown): OrganizationWatchlistStatus | null {
    const status = cleanText(value).toLowerCase()
    return watchlistStatuses.has(status as OrganizationWatchlistStatus) ? status as OrganizationWatchlistStatus : null
}

export function normalizeWatchlistActionInput(body: WatchlistActionInput | undefined) {
    const action = cleanText(body?.action).toLowerCase()
    if (!watchlistActions.has(action as OrganizationWatchlistAction)) {
        throw new Error('Watchlist action must be pause, resume, archive, or restore.')
    }

    const { reason, requestId } = normalizeWatchlistMutationMetadata(body)
    return { action: action as OrganizationWatchlistAction, reason, requestId }
}

export function normalizeWatchlistCleanupInput(body: WatchlistCleanupInput | undefined) {
    const rawIds = Array.isArray(body?.itemIds)
        ? body?.itemIds
        : Array.isArray(body?.item_ids)
            ? body?.item_ids
            : []
    const itemIds = Array.from(new Set(rawIds.map(id => cleanText(id)).filter(Boolean)))
    if (!itemIds.length) {
        throw new Error('Add at least one watchlist item id to clean up.')
    }

    if (itemIds.length > 50) {
        throw new Error('Clean up at most 50 watchlist items at a time.')
    }

    const { reason, requestId } = normalizeWatchlistMutationMetadata(body)
    return { itemIds, reason, requestId }
}
