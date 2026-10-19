import { roleCanEditOrganization, type OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationRow, OrganizationWatchlistRow } from '../rowTypes.ts'
import { normalizeOrganizationStatus } from '../normalization/organizationValues.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationWatchlistLifecycleBlockers, organizationWatchlistAlertBridgeBlockers } from './readinessBlockers.ts'
import { organizationWatchlistAlertCaseProofBlockers } from './caseProofBlockers.ts'
import { organizationWatchlistLifecycleProjection } from './lifecycleProjection.ts'
import { organizationSharedWatchlistProjectionFromLifecycle } from './sharedWatchlistProjection.ts'
import { buildOrganizationAlertBridgeContract } from './alertBridgeContract.ts'
import { organizationAlertCaseWorkflowState } from './caseWorkflowState.ts'
import { organizationSharedWatchlistAlertQueueVisibility } from './alertQueueVisibility.ts'
import { buildWebhookDeliveryPolicy } from './webhookDeliveryPolicy.ts'
import { buildWebhookDeliveryConsumer } from './webhookDeliveryConsumer.ts'
import { buildOrganizationActiveWatchlistTerms, buildOrganizationTermLifecycle } from './exportProjections.ts'
import { buildOrganizationAlertGenerationConsumer } from './alertGenerationConsumer.ts'
import { buildOrganizationConsumerReadiness } from './supportReadinessExport.ts'
import { buildOrganizationReadinessExport } from './readinessExport.ts'
import { organizationSharedWatchlistIntegrationGuardrails } from './integrationGuardrails.ts'
import { buildOrganizationAlertTermsReceipts } from './alertTermsReceipts.ts'
import type { OrganizationWatchlistAlertTermsExport, OrganizationWebhookDestinationAccessDecision } from '../types.ts'

export function organizationWatchlistAlertTermsExport(
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'status' | 'member_count' | 'owner_count' | 'admin_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy' | 'role'>,
    items: OrganizationWatchlistRow[],
    member: { userId: string, role: OrganizationRole }
): OrganizationWatchlistAlertTermsExport {
    const watchlistProjection = organizationWatchlistLifecycleProjection(items)
    const sharedProjection = organizationSharedWatchlistProjectionFromLifecycle(organization, watchlistProjection, member)
    const { alertGeneration, downstreamAuthorization, sharedWatchlistDownstreamProof } = sharedProjection
    const activeTerms = buildOrganizationActiveWatchlistTerms(alertGeneration)
    const { active: activeItems, paused: pausedItems, archived: archivedItems } = watchlistProjection.itemsByStatus
    const pausedCount = pausedItems.length
    const archivedCount = archivedItems.length
    const termLifecycle = buildOrganizationTermLifecycle(organization, activeItems, pausedItems, archivedItems)
    const activeAdminCount = Number(organization.admin_count ?? organization.owner_count ?? 0)
    const organizationStatus = normalizeOrganizationStatus(organization.status)
    const typedBlockers = organizationWatchlistAlertBridgeBlockers({
        ...organizationTenantIdentity(organization.id, organization.id),
        organizationStatus,
        activeAdminCount,
        activeTermCount: activeTerms.length,
        pausedCount,
        archivedCount,
        missingAlertRefCount: 0,
    })
    const lifecycleTypedBlockers = organizationWatchlistLifecycleBlockers({
        activeTermCount: activeTerms.length,
        pausedCount,
        archivedCount,
    })
    const alertCaseProofBlockers = organizationWatchlistAlertCaseProofBlockers({
        ...organizationTenantIdentity(organization.id, organization.id),
        activeAdminCount,
        activeTermCount: activeTerms.length,
        pausedCount,
        archivedCount,
    })
    const cleanupRequired = pausedCount + archivedCount > 0
    const sharedWatchlistIntegrationGuardrails = organizationSharedWatchlistIntegrationGuardrails(sharedWatchlistDownstreamProof)
    const sharedWatchlistAlertQueueVisibility = organizationSharedWatchlistAlertQueueVisibility(sharedWatchlistDownstreamProof)
    const webhookDestinationOwnership = organizationAlertCaseWorkflowState(
        sharedWatchlistDownstreamProof,
        downstreamAuthorization
    ).webhookDestinationOwnership
    const canManageWebhookDestinations = roleCanEditOrganization(member.role)
    const activeMemberActor = () => ({
        userId: member.userId,
        role: member.role,
        status: 'active' as const,
    })
    const webhookDestinationScope = () => ({
        requiredDestinationOrgId: webhookDestinationOwnership.requiredDestinationOrgId,
        selectedDestinationOrgField: webhookDestinationOwnership.selectedDestinationOrgField,
        selectedDestinationIdField: webhookDestinationOwnership.selectedDestinationIdField,
        crossOrgDestinationAllowed: false as const,
        nonmemberDestinationEnumeration: webhookDestinationOwnership.nonmemberDestinationEnumeration,
    })
    const deliveryBlockerCodes = Array.from(new Set([
        ...alertGeneration.blockedReasons,
        ...sharedWatchlistIntegrationGuardrails.caseSafety.blockerCodes,
        ...webhookDestinationOwnership.blockerCodes,
        ...(canManageWebhookDestinations ? [] : ['role_not_allowed']),
    ].map(String)))
    const webhookDestinationAccessDecision: OrganizationWebhookDestinationAccessDecision = {
        schemaVersion: 'organization.webhook_destination_access_decision.v1',
        ...organizationTenantIdentity(organization.id, organization.id),
        sourceFamily: 'organization_watchlist',
        member: activeMemberActor(),
        route: webhookDestinationOwnership.route,
        destinationScope: webhookDestinationScope(),
        ...buildWebhookDeliveryPolicy({ organizationId: organization.id, member, ownership: webhookDestinationOwnership, canManageWebhookDestinations }),
        ...buildWebhookDeliveryConsumer({ organizationId: organization.id, member, ownership: webhookDestinationOwnership, canManageWebhookDestinations, activeTerms, alertGeneration, integrationGuardrails: sharedWatchlistIntegrationGuardrails, deliveryBlockerCodes }),
        proofAssertions: [
            'destination_org_matches_alert_org',
            'idempotency_scoped_to_org_destination_alert',
            'manual_trigger_owner_admin_only',
            'member_viewer_cannot_configure_destination',
            'nonmember_cannot_enumerate_destinations',
        ],
        noLeakFields: [
            'destination.secret',
            'destination.endpoint',
            'otherOrg.destinationIds',
            'otherOrg.alertGeneratorKeys',
            'activeTerms[].term',
        ],
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
    const consumerReadiness = buildOrganizationConsumerReadiness({
        organizationId: organization.id,
        member,
        downstreamProof: sharedWatchlistDownstreamProof,
        integrationGuardrails: sharedWatchlistIntegrationGuardrails,
        alertQueueVisibility: sharedWatchlistAlertQueueVisibility,
        webhookDestinationOwnership,
    })
    const alertGenerationConsumer = buildOrganizationAlertGenerationConsumer({
        organization,
        member,
        activeTerms,
        termLifecycle,
        alertGeneration,
        sharedWatchlistAlertQueueVisibility,
        sharedWatchlistIntegrationGuardrails,
        webhookDestinationAccessDecision,
        webhookDestinationOwnership,
        canManageWebhookDestinations,
    })
    const { termExportDeltaReceipt, alertCasePersistenceReceipt } = buildOrganizationAlertTermsReceipts({ organizationId: organization.id, member, activeTerms, termLifecycle, alertGeneration, sharedWatchlistDownstreamProof, sharedWatchlistAlertQueueVisibility })
    const readinessExport = buildOrganizationReadinessExport({
        organization,
        member,
        consumerReadiness,
        sharedWatchlistDownstreamProof,
        alertGenerationConsumer,
        alertCasePersistenceReceipt,
        webhookDestinationOwnership,
        webhookDestinationAccessDecision,
        termExportDeltaReceipt,
        termLifecycle,
    })
    return {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        ...organizationTenantIdentity(organization.id, organization.id),
        ownerOrganizationId: organization.id,
        member: activeMemberActor(),
        visibilityPolicy: alertGeneration.visibilityPolicy,
        allowedViewerRoles: alertGeneration.allowedViewerRoles,
        recommendedDownstreamRoute: 'organization_watchlist',
        downstreamAuthorization,
        alertBridgeContract: buildOrganizationAlertBridgeContract({
            organizationId: organization.id,
            member,
            alertGeneration,
            lifecycleTypedBlockers,
            activeTerms,
            activeAdminCount,
            cleanupRequired,
            pausedCount,
            archivedCount,
            alertCaseProofBlockers,
            typedBlockers,
        }),
        activeTerms,
        sharedWatchlistDownstreamProof,
        sharedWatchlistIntegrationGuardrails,
        sharedWatchlistAlertQueueVisibility,
        webhookDestinationOwnership,
        webhookDestinationAccessDecision,
        consumerReadiness,
        alertGenerationConsumer,
        termExportDeltaReceipt,
        alertCasePersistenceReceipt,
        readinessExport,
        activeWatchlistTerms: alertGeneration.activeWatchlistTerms,
        termFamilies: alertGeneration.termFamilies,
        excluded: {
            pausedCount,
            archivedCount,
            inactiveCount: pausedCount + archivedCount,
        },
        termLifecycle,
        blockedReasons: alertGeneration.blockedReasons,
        canGenerateAlerts: alertGeneration.canGenerateAlerts,
    }
}
