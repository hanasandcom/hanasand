import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationAlertVisibilityPolicy } from '../../organizationVisibility.ts'
import type { WatchlistKind, OrganizationWatchlistStatus } from '../inputTypes.ts'

export type OrganizationWatchlistTerm = {
    watchlistItemId: string
    itemId: string
    organizationId: string
    tenantId: string
    kind: WatchlistKind
    termFamily: WatchlistKind
    family: WatchlistKind
    category: WatchlistKind
    term: string
    value: string
    terms: string[]
    status: OrganizationWatchlistStatus
    enabled: boolean
    disabledReason: 'watchlist_paused' | 'watchlist_archived' | null
    createdBy: string
    updatedBy: string | null
    lifecycleReason: string | null
    lifecycleRequestId: string | null
}

export type OrganizationWatchlistAlertGenerationContract = {
    schemaVersion: 'organization.watchlist_alert_generation.v1'
    organizationId: string
    tenantId: string
    ownerOrganizationId: string
    visibilityPolicy: OrganizationAlertVisibilityPolicy
    allowedViewerRoles: OrganizationRole[]
    activeWatchlistTerms: OrganizationWatchlistTerm[]
    termFamilies: WatchlistKind[]
    blockedReasons: string[]
    canGenerateAlerts: boolean
}

export type OrganizationWatchlistAlertGenerationRef = {
    schemaVersion: 'organization.watchlist_alert_generation_ref.v1'
    source: 'organization_shared_watchlist'
    organizationId: string
    tenantId: string
    ownerOrganizationId: string
    watchlistId: string
    watchlistItemId: string
    itemId: string
    termFamily: WatchlistKind
    category: WatchlistKind
    term: string
    normalizedTerm: string
    status: 'active'
    enabled: true
    disabledReason: null
    lifecycle: {
        status: 'active'
        enabled: true
        disabledReason: null
        reason: string | null
        requestId: string | null
        createdBy: string
        updatedBy: string | null
    }
    dedupe: {
        scope: 'organization_watchlist_term'
        key: string
        parts: {
            organizationId: string
            tenantId: string
            watchlistItemId: string
            termFamily: WatchlistKind
            normalizedTerm: string
        }
    }
}
