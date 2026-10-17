import type { OrganizationWatchlistRow } from '../rowTypes.ts'
import type { OrganizationWatchlistStatus } from '../inputTypes.ts'
import type { OrganizationWatchlistTerm } from '../contracts/alertGeneration.ts'
import { normalizeWatchlistStatus } from '../normalization/watchlistValues.ts'
import { organizationWatchlistEnabledState } from './itemProjection.ts'
import { organizationTenantIdentity } from '../identity.ts'

export type OrganizationWatchlistLifecycleProjection = {
    terms: OrganizationWatchlistTerm[]
    itemsByStatus: Record<OrganizationWatchlistStatus, OrganizationWatchlistRow[]>
}

export function organizationWatchlistLifecycleProjection(items: OrganizationWatchlistRow[]): OrganizationWatchlistLifecycleProjection {
    const terms: OrganizationWatchlistTerm[] = []
    const itemsByStatus: OrganizationWatchlistLifecycleProjection['itemsByStatus'] = {
        active: [],
        paused: [],
        archived: [],
    }

    for (const item of items) {
        const status = normalizeWatchlistStatus(item)
        const lifecycleState = organizationWatchlistEnabledState(status)
        itemsByStatus[status].push(item)
        terms.push({
            watchlistItemId: item.id,
            itemId: item.id,
            ...organizationTenantIdentity(item.organization_id, item.organization_id),
            kind: item.kind,
            termFamily: item.kind,
            family: item.kind,
            category: item.kind,
            term: item.value,
            value: item.value,
            terms: [item.value],
            status,
            enabled: lifecycleState.enabled,
            disabledReason: lifecycleState.disabledReason,
            createdBy: item.created_by,
            updatedBy: item.updated_by ?? null,
            lifecycleReason: item.lifecycle_reason ?? null,
            lifecycleRequestId: item.lifecycle_request_id ?? null,
        })
    }

    terms.sort((a, b) => `${a.termFamily}:${a.term}`.localeCompare(`${b.termFamily}:${b.term}`))
    return { terms, itemsByStatus }
}
