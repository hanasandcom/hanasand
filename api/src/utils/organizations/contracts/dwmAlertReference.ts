import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationAlertVisibilityPolicy } from '../../organizationVisibility.ts'
import type { OrganizationBridgeContext, OrganizationBridgeContextFields } from '../bridgeContext.ts'
import type { OrganizationWatchlistStatus, WatchlistKind } from '../inputTypes.ts'

export type OrganizationDwmAlertReference = {
    schemaVersion: 'organization.dwm_alert_bridge.v1'
    organizationId: string
    tenantId: string
    watchlistItemId: string
    watchlistKind: WatchlistKind
    matchedTerm: {
        value: string
        kind: WatchlistKind
        termFamily: WatchlistKind
    }
    watchlist: {
        id: string
        name: string
        itemId: string
        kind: WatchlistKind
        termFamily: WatchlistKind
        status: OrganizationWatchlistStatus
        enabled: boolean
        disabledReason: 'watchlist_paused' | 'watchlist_archived' | null
        createdBy: string
        updatedBy: string | null
        terms: string[]
    }
    organization: OrganizationBridgeContext
    ownerContext: {
        schemaVersion: 'organization.alert_reference_owner_context.v1'
        organizationId: string
        tenantId: string
        ownerOrganizationId: string
        watchlistItemId: string
        watchlistId: string
        watchlistKind: WatchlistKind
        createdBy: string
        updatedBy: string | null
        visibilityPolicy: OrganizationAlertVisibilityPolicy
        allowedViewerRoles: OrganizationRole[]
        alertGeneratorKey: string
        webhookDestinationOrgField: 'destination.org_id'
        casePath: string
        crossTenantCollisionAllowed: false
    }
    alert: {
        id: string
        organizationId: string
        orgId: string
        tenantId: string
        orgName: string
    } & OrganizationBridgeContextFields & {
        watchlistItemId: string
        matchedTerm: {
            value: string
            kind: WatchlistKind
            termFamily: WatchlistKind
        }
        watchlist: OrganizationDwmAlertReference['watchlist']
        sourceFamily: 'organization_watchlist'
        artifactType: 'watchlist_readiness'
        route: 'organization_watchlist'
        casePath: string
        dedupeKey: string
        alertOwnership: OrganizationDwmAlertReference['alertOwnership']
        workflowContext: {
            organizationId: string
            tenantId: string
            ownerOrganizationId: string
            watchlistItemIds: string[]
            alertGeneratorKeys: string[]
            ownerContext: OrganizationDwmAlertReference['ownerContext']
        }
    }
    alertOwnership: {
        schemaVersion: 'organization.alert_ownership.v1'
        organizationId: string
        tenantId: string
        ownerOrganizationId: string
        watchlistItemId: string
        watchlistId: string
        sourceFamily: 'organization_watchlist'
        route: 'organization_watchlist'
        dedupeKey: string
        casePath: string
        visibilityPolicy: OrganizationAlertVisibilityPolicy
        allowedViewerRoles: OrganizationRole[]
        requiredPersistedFields: Array<'organizationId' | 'tenantId' | 'watchlistItemIds' | 'workflowContext.organizationId' | 'workflowContext.alertGeneratorKeys' | 'workflowContext.visibilityDecision' | 'casePath'>
        lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'member_revoked' | 'watchlist_archived' | 'watchlist_paused'>
        noLeakFields: Array<'otherOrg.watchlistItemIds' | 'otherOrg.alertGeneratorKeys' | 'activeTerms[]' | 'destination.secret'>
        crossTenantCollisionAllowed: false
    }
    webhookContract: {
        schemaVersion: 'organization.alert_reference_webhook_contract.v1'
        orgId: string
        organizationId: string
        tenantId: string
        watchlistId: string
        watchlistName: string
    } & OrganizationBridgeContextFields & {
        route: 'organization_watchlist'
        casePath: string
        requiredDestinationOrgId: string
        selectedDestinationOrgField: 'destination.org_id'
        selectedDestinationIdField: 'webhookDestinationIds[]'
        ownerContext: OrganizationDwmAlertReference['ownerContext']
        noLeakFields: Array<'destination.secret' | 'otherOrg.destinationIds' | 'otherOrg.alertGeneratorKeys'>
    }
}
