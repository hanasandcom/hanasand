import { nowRow, rows, iso } from './rowHelpers.ts'
import type { SmokeQueryHandler } from './queryTypes.ts'

export const handleWatchlistQueries: SmokeQueryHandler = (compact, params, state) => {
    if (compact.startsWith('SELECT id FROM organization_watchlist_items')) {
        const [organizationId, kind, value] = params
        const existing = [...state.watchlists.values()].find(item => item.organization_id === organizationId && item.kind === kind && item.value.toLowerCase() === String(value).toLowerCase() && !item.archived_at)
        return rows(existing ? [{ id: existing.id }] : [])
    }

    if (compact.startsWith('SELECT COUNT(*)::int AS used FROM organization_watchlist_items')) {
        const [userId] = params
        const organizationIds = new Set([...state.members.values()]
            .filter(member => member.user_id === userId && member.status === 'active')
            .map(member => member.organization_id))
        const used = [...state.watchlists.values()].filter(item => organizationIds.has(item.organization_id)
            && !item.archived_at && item.status !== 'archived').length
        return rows([{ used }])
    }

    if (compact.startsWith('UPDATE organization_watchlist_items SET value')) {
        const [id, organizationId, value, notes, updatedBy, reason, requestId] = params
        const existing = state.watchlists.get(id)
        if (!existing || existing.organization_id !== organizationId) return rows([])
        const updated = { ...existing, value, notes, status: 'active', updated_by: updatedBy, lifecycle_reason: reason, lifecycle_request_id: requestId, updated_at: iso() }
        state.watchlists.set(id, updated)
        return rows([updated])
    }

    if (compact.startsWith('UPDATE organization_watchlist_items SET kind')) {
        const [id, organizationId, kind, value, notes, updatedBy, reason, requestId] = params
        const existing = state.watchlists.get(id)
        if (!existing || existing.organization_id !== organizationId || existing.archived_at || existing.status === 'archived') return rows([])
        const updated = { ...existing, kind, value, notes, updated_by: updatedBy, lifecycle_reason: reason, lifecycle_request_id: requestId, updated_at: iso() }
        state.watchlists.set(id, updated)
        return rows([updated])
    }

    if (compact.startsWith('INSERT INTO organization_watchlist_items')) {
        const [id, organizationId, kind, value, notes, createdBy, reason, requestId] = params
        const item = nowRow({ id, organization_id: organizationId, kind, value, notes, status: 'active', created_by: createdBy, updated_by: createdBy, lifecycle_reason: reason, lifecycle_request_id: requestId, archived_at: null })
        state.watchlists.set(id, item)
        return rows([item])
    }

    if (compact.startsWith('SELECT * FROM organization_watchlist_items')) {
        return readWatchlists(compact, params, state)
    }

    if (compact.startsWith('UPDATE organization_watchlist_items SET status = \'archived\'') && compact.includes('id = ANY')) {
        const [organizationId, itemIds, updatedBy, reason, requestId] = params
        const archived = []
        for (const itemId of itemIds) {
            const existing = state.watchlists.get(itemId)
            if (!existing || existing.organization_id !== organizationId || existing.archived_at) continue
            const archivedItem = { ...existing, status: 'archived', archived_at: iso(), updated_by: updatedBy, lifecycle_reason: reason, lifecycle_request_id: requestId, updated_at: iso() }
            state.watchlists.set(itemId, archivedItem)
            archived.push(archivedItem)
        }
        return rows(archived)
    }

    if (compact.startsWith('UPDATE organization_watchlist_items SET status = \'archived\'')) {
        const [id, organizationId, updatedBy, reason, requestId] = params
        const existing = state.watchlists.get(id)
        if (!existing || existing.organization_id !== organizationId || existing.archived_at) return rows([])
        const archived = { ...existing, status: 'archived', archived_at: iso(), updated_by: updatedBy, lifecycle_reason: reason, lifecycle_request_id: requestId, updated_at: iso() }
        state.watchlists.set(id, archived)
        return rows([archived])
    }

    if (compact.startsWith('UPDATE organization_watchlist_items SET status = $3')) {
        return updateWatchlistStatus(params, state)
    }

    return undefined
}

function readWatchlists(compact: string, params: any[], state: Parameters<SmokeQueryHandler>[2]) {
    if (compact.includes('WHERE id = $1')) {
        const [itemId, organizationId] = params
        const existing = state.watchlists.get(itemId)
        return rows(existing && existing.organization_id === organizationId ? [existing] : [])
    }

    if (params.length === 1 && compact.includes('ORDER BY status ASC')) {
        const [organizationId] = params
        return rows([...state.watchlists.values()]
            .filter(item => item.organization_id === organizationId)
            .sort((a, b) => `${a.status}:${a.kind}:${a.value}`.localeCompare(`${b.status}:${b.kind}:${b.value}`)))
    }

    if (params.length === 1) {
        const [organizationId] = params
        return rows([...state.watchlists.values()].filter(item => item.organization_id === organizationId && !item.archived_at && item.status === 'active').sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`)))
    }

    const [organizationId, includeArchived, kind, status] = params
    return rows([...state.watchlists.values()]
        .filter(item => item.organization_id === organizationId)
        .filter(item => includeArchived || !item.archived_at)
        .filter(item => !kind || item.kind === kind)
        .filter(item => !status || item.status === status)
        .sort((a, b) => `${a.status}:${a.kind}:${a.value}`.localeCompare(`${b.status}:${b.kind}:${b.value}`)))
}

function updateWatchlistStatus(params: any[], state: Parameters<SmokeQueryHandler>[2]) {
    const [id, organizationId, status, updatedBy, reason, requestId, action] = params
    const existing = state.watchlists.get(id)
    if (!existing || existing.organization_id !== organizationId || (existing.archived_at && action !== 'restore')) return rows([])
    const updated = {
        ...existing,
        status,
        archived_at: status === 'archived' ? iso() : action === 'restore' ? null : existing.archived_at,
        updated_by: updatedBy,
        lifecycle_reason: reason,
        lifecycle_request_id: requestId,
        updated_at: iso(),
    }
    state.watchlists.set(id, updated)
    return rows([updated])
}
