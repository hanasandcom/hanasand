import type { OrganizationDwmAlertReference } from '../contracts/dwmAlertReference.ts'
import type { OrganizationRow, OrganizationWatchlistRow } from '../rowTypes.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationBridgeContextFields, buildOrganizationBridgeContext } from '../bridgeContext.ts'
import { normalizeWatchlistStatus } from '../normalization/watchlistValues.ts'
import { organizationWatchlistEnabledState } from './itemProjection.ts'

export const organizationPersistedAlertFields = [
    'organizationId',
    'tenantId',
    'watchlistItemIds',
    'workflowContext.organizationId',
    'workflowContext.alertGeneratorKeys',
    'workflowContext.visibilityDecision',
    'casePath',
] as const

export function buildOrganizationDwmAlertReference(
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'member_count' | 'owner_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy'>,
    item: OrganizationWatchlistRow
): OrganizationDwmAlertReference {
    const watchlistName = `${organization.name} ${item.kind} watchlist`
    const casePath = `/dwm?organizationId=${encodeURIComponent(organization.id)}&watchlistItemId=${encodeURIComponent(item.id)}`
    const dedupeKey = `org:${organization.id}:watchlist:${item.id}:${item.kind}:${item.value.toLowerCase()}`
    const bridgeContext = buildOrganizationBridgeContext(organization)
    const status = normalizeWatchlistStatus(item)
    const lifecycleState = organizationWatchlistEnabledState(status)
    const watchlist = {
        id: item.id,
        name: watchlistName,
        itemId: item.id,
        kind: item.kind,
        termFamily: item.kind,
        status,
        enabled: lifecycleState.enabled,
        disabledReason: lifecycleState.disabledReason,
        createdBy: item.created_by,
        updatedBy: item.updated_by ?? null,
        terms: [item.value],
    }
    const matchedTerm = {
        value: item.value,
        kind: item.kind,
        termFamily: item.kind,
    }
    const alertOwnership: OrganizationDwmAlertReference['alertOwnership'] = {
        schemaVersion: 'organization.alert_ownership.v1',
        ...organizationTenantIdentity(organization.id, organization.id),
        ownerOrganizationId: organization.id,
        watchlistItemId: item.id,
        watchlistId: item.id,
        sourceFamily: 'organization_watchlist',
        route: 'organization_watchlist',
        dedupeKey,
        casePath,
        visibilityPolicy: bridgeContext.alertVisibilityPolicy,
        allowedViewerRoles: bridgeContext.allowedViewerRoles,
        requiredPersistedFields: [...organizationPersistedAlertFields],
        lifecycleBlockers: [
            'org_archived',
            'org_deleted',
            'member_revoked',
            'watchlist_archived',
            'watchlist_paused',
        ],
        noLeakFields: [
            'otherOrg.watchlistItemIds',
            'otherOrg.alertGeneratorKeys',
            'activeTerms[]',
            'destination.secret',
        ],
        crossTenantCollisionAllowed: false,
    }
    const ownerContext: OrganizationDwmAlertReference['ownerContext'] = {
        schemaVersion: 'organization.alert_reference_owner_context.v1',
        ...organizationTenantIdentity(organization.id, organization.id),
        ownerOrganizationId: organization.id,
        watchlistItemId: item.id,
        watchlistId: item.id,
        watchlistKind: item.kind,
        createdBy: item.created_by,
        updatedBy: item.updated_by ?? null,
        visibilityPolicy: bridgeContext.alertVisibilityPolicy,
        allowedViewerRoles: bridgeContext.allowedViewerRoles,
        alertGeneratorKey: dedupeKey,
        webhookDestinationOrgField: 'destination.org_id',
        casePath,
        crossTenantCollisionAllowed: false,
    }

    return {
        schemaVersion: 'organization.dwm_alert_bridge.v1',
        ...organizationTenantIdentity(organization.id, organization.id),
        watchlistItemId: item.id,
        watchlistKind: item.kind,
        matchedTerm,
        watchlist,
        organization: bridgeContext,
        ownerContext,
        alertOwnership,
        alert: {
            id: dedupeKey,
            organizationId: organization.id,
            orgId: organization.id,
            tenantId: organization.id,
            orgName: organization.name,
            ...organizationBridgeContextFields(bridgeContext),
            watchlistItemId: item.id,
            matchedTerm,
            watchlist,
            sourceFamily: 'organization_watchlist',
            artifactType: 'watchlist_readiness',
            route: 'organization_watchlist',
            casePath,
            dedupeKey,
            alertOwnership,
            workflowContext: {
                ...organizationTenantIdentity(organization.id, organization.id),
                ownerOrganizationId: organization.id,
                watchlistItemIds: [item.id],
                alertGeneratorKeys: [dedupeKey],
                ownerContext,
            },
        },
        webhookContract: {
            schemaVersion: 'organization.alert_reference_webhook_contract.v1',
            orgId: organization.id,
            ...organizationTenantIdentity(organization.id, organization.id),
            watchlistId: item.id,
            watchlistName,
            ...organizationBridgeContextFields(bridgeContext),
            route: 'organization_watchlist',
            casePath,
            requiredDestinationOrgId: organization.id,
            selectedDestinationOrgField: 'destination.org_id',
            selectedDestinationIdField: 'webhookDestinationIds[]',
            ownerContext,
            noLeakFields: [
                'destination.secret',
                'otherOrg.destinationIds',
                'otherOrg.alertGeneratorKeys',
            ],
        },
    }
}
