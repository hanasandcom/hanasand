import type { DownstreamProofContext } from './context.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from '../../contracts/downstreamProof.ts'
import { organizationSharedWatchlistMonitoringWorkflow } from '../monitoringWorkflow.ts'
import { organizationSharedWatchlistAnalystPortalWorkflow } from '../analystPortalWorkflow.ts'
import { organizationSharedWatchlistEnrichmentProvenance } from '../enrichmentProvenance.ts'

export function workflowSections(context: DownstreamProofContext): Pick<OrganizationSharedWatchlistDownstreamProof, 'monitoringWorkflow' | 'analystPortalWorkflow' | 'enrichmentProvenance' | 'integration' | 'blockers'> {
    const { organization, member, downstreamAuthorization, activeTerms, alertGeneratorKeys, alertBlockers, caseBlockers, alertReadAllowed, caseReadAllowed, webhookBlockers, webhookDeliveryAllowedByRole, auditEventActions } = context
    return {
        monitoringWorkflow: organizationSharedWatchlistMonitoringWorkflow({
            organizationId: organization.id,
            activeWatchlistItemIds: activeTerms.map(term => term.watchlistItemId),
            alertGeneratorKeys,
            alertAllowedRoles: downstreamAuthorization.visibility.allowedRoles,
            allowedActions: downstreamAuthorization.allowedActions,
            alertReadAllowed,
            caseReadAllowed,
            webhookManualAllowed: webhookDeliveryAllowedByRole && downstreamAuthorization.organizationLifecycleState === 'active',
            alertBlockers,
            caseBlockers,
            webhookBlockers,
            auditEventActions,
        }),
        analystPortalWorkflow: organizationSharedWatchlistAnalystPortalWorkflow({
            organizationId: organization.id,
            actorRole: member.role,
            alertReadAllowed,
            caseReadAllowed,
            webhookManualAllowed: webhookDeliveryAllowedByRole && downstreamAuthorization.organizationLifecycleState === 'active',
            allowedActions: downstreamAuthorization.allowedActions,
            alertBlockers,
            caseBlockers,
            webhookBlockers,
            auditEventActions,
        }),
        enrichmentProvenance: organizationSharedWatchlistEnrichmentProvenance({
            organizationId: organization.id,
            activeWatchlistItemIds: activeTerms.map(term => term.watchlistItemId),
            alertGeneratorKeys,
            alertBlockers,
        }),
        integration: {
            expectedAdapter: 'organizationSharedWatchlistDownstreamProof',
            payloadShape: [
                'organizationId',
                'tenantId',
                'actor.role',
                'watchlistOwnership.activeIds',
                'watchlistOwnership.lifecycleStatuses',
                'alertBridge.alertGeneratorKeys',
                'alertBridge.persistenceContract.persistedAlertFields',
                'alertBridge.persistenceContract.workflowContextFields',
                'alertBridge.queueVisibilityContract.actorVisibility',
                'alertBridge.queueVisibilityContract.watchlistScope',
                'alertBridge.expectedAlertFields',
                'caseBridge.caseWorkflowContract.actorActions',
                'caseBridge.caseWorkflowContract.watchlistScope',
                'caseBridge.expectedCaseFields',
                'webhookBridge.expectedDeliveryFields',
                'webhookBridge.deliveryContract.destinationSelection',
                'webhookBridge.deliveryContract.idempotency',
                'monitoringWorkflow',
                'analystPortalWorkflow',
                'enrichmentProvenance',
                'audit.eventActions',
                'audit.eventBridge',
                'audit.requiredMetadataFields',
                'inviteLifecycle.pendingInviteCount',
            ],
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
            routeHandlers: [
                'api/src/handlers/organizations.ts',
                'scraper/src/api/dwmWorkflowRoutes.ts',
                'scraper/src/api/caseRoutes.ts',
            ],
            storageModules: [
                'api/src/utils/organizations.ts',
                'scraper/src/storage/dwmAlertRepository.ts',
            ],
            nonmemberEnumeration: false,
            containsRawTerms: false,
        },
        blockers: Array.from(new Set([...alertBlockers, ...caseBlockers, ...webhookBlockers])).sort(),
    }
}
