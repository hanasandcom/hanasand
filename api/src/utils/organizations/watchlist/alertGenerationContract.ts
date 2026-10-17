import type { OrganizationWatchlistAlertGenerationContract } from '../contracts/alertGeneration.ts'
import type { OrganizationRow, OrganizationWatchlistRow } from '../rowTypes.ts'
import type { OrganizationWatchlistLifecycleProjection } from './lifecycleProjection.ts'
import { normalizeOrganizationStatus } from '../normalization/organizationValues.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { buildOrganizationBridgeContext } from '../bridgeContext.ts'
import { organizationWatchlistLifecycleProjection } from './lifecycleProjection.ts'

export function organizationWatchlistAlertGenerationContract(
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'status' | 'member_count' | 'owner_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy'>,
    items: OrganizationWatchlistRow[]
): OrganizationWatchlistAlertGenerationContract {
    return organizationWatchlistAlertGenerationContractFromProjection(
        organization,
        organizationWatchlistLifecycleProjection(items)
    )
}

export function organizationWatchlistAlertGenerationContractFromProjection(
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'status' | 'member_count' | 'owner_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy'>,
    watchlistProjection: OrganizationWatchlistLifecycleProjection
): OrganizationWatchlistAlertGenerationContract {
    const organizationStatus = normalizeOrganizationStatus(organization.status)
    const activeItems = organizationStatus === 'active' ? watchlistProjection.itemsByStatus.active : []
    const bridgeContext = buildOrganizationBridgeContext({
        ...organization,
        shared_watchlist_count: activeItems.length,
    })
    const activeWatchlistTerms = organizationStatus === 'active'
        ? watchlistProjection.terms.filter(term => term.status === 'active')
        : []
    const termFamilies = [...new Set(activeWatchlistTerms.map(term => term.termFamily))].sort()
    const blockedReasons: string[] = []
    if (organizationStatus !== 'active') {
        blockedReasons.push(organizationStatus === 'archived' ? 'org_archived' : 'org_deleted')
    }

    if (!activeItems.length) {
        blockedReasons.push('needs_shared_watchlist_item')
    }

    if (!bridgeContext.allowedViewerRoles.length) {
        blockedReasons.push('needs_alert_visibility_roles')
    }

    return {
        schemaVersion: 'organization.watchlist_alert_generation.v1',
        ...organizationTenantIdentity(bridgeContext.id, bridgeContext.id),
        ownerOrganizationId: bridgeContext.id,
        visibilityPolicy: bridgeContext.alertVisibilityPolicy,
        allowedViewerRoles: bridgeContext.allowedViewerRoles,
        activeWatchlistTerms,
        termFamilies,
        blockedReasons,
        canGenerateAlerts: blockedReasons.length === 0,
    }
}

