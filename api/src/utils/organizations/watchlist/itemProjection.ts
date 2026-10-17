import type { OrganizationWatchlistRow } from '../rowTypes.ts'
import type { OrganizationWatchlistStatus, WatchlistKind } from '../inputTypes.ts'
import type { OrganizationWatchlistTerm } from '../contracts/alertGeneration.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { normalizeWatchlistStatus } from '../normalization/watchlistValues.ts'

export function toWatchlistItem(row: OrganizationWatchlistRow) {
    const status = normalizeWatchlistStatus(row)
    const lifecycleState = organizationWatchlistEnabledState(status)
    return {
        id: row.id,
        itemId: row.id,
        watchlistItemId: row.id,
        ...organizationTenantIdentity(row.organization_id, row.organization_id),
        ownerOrganizationId: row.organization_id,
        kind: row.kind,
        termFamily: row.kind,
        category: row.kind,
        term: row.value,
        value: row.value,
        terms: [row.value],
        status,
        enabled: lifecycleState.enabled,
        disabledReason: lifecycleState.disabledReason,
        notes: row.notes,
        createdBy: row.created_by,
        updatedBy: row.updated_by ?? null,
        lifecycleReason: row.lifecycle_reason ?? null,
        lifecycleRequestId: row.lifecycle_request_id ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        archivedAt: row.archived_at ?? null,
        alertGenerationReference: organizationWatchlistAlertReference({
            organizationId: row.organization_id,
            tenantId: row.organization_id,
            watchlistItemId: row.id,
            kind: row.kind,
            term: row.value,
            status,
            enabled: lifecycleState.enabled,
            disabledReason: lifecycleState.disabledReason,
        }),
    }
}

export function organizationWatchlistAlertReference<TStatus extends OrganizationWatchlistStatus>(input: {
    organizationId: string
    tenantId: string
    watchlistItemId: string
    kind: WatchlistKind
    term: string
    status: TStatus
    enabled: boolean
    disabledReason: OrganizationWatchlistTerm['disabledReason']
}) {
    return {
        schemaVersion: 'organization.watchlist_item_alert_reference.v1' as const,
        ...organizationTenantIdentity(input.organizationId, input.tenantId),
        watchlistItemId: input.watchlistItemId,
        itemId: input.watchlistItemId,
        termFamily: input.kind,
        category: input.kind,
        term: input.term,
        status: input.status,
        enabled: input.enabled,
        disabledReason: input.disabledReason,
    }
}

export function organizationWatchlistEnabledState(status: OrganizationWatchlistStatus): {
    enabled: boolean
    disabledReason: OrganizationWatchlistTerm['disabledReason']
} {
    if (status === 'paused') {
        return { enabled: false, disabledReason: 'watchlist_paused' }
    }
    if (status === 'archived') {
        return { enabled: false, disabledReason: 'watchlist_archived' }
    }
    return { enabled: true, disabledReason: null }
}
