import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationSharedWatchlistConsumerReadiness } from '../contracts/consumerAdapters.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from '../contracts/downstreamProof.ts'
import type { OrganizationSharedWatchlistIntegrationGuardrails } from '../contracts/integrationGuardrails.ts'
import type { OrganizationSharedWatchlistAlertQueueVisibility } from '../contracts/alertQueueVisibility.ts'
import { organizationAlertCaseWorkflowState } from './caseWorkflowState.ts'
import { organizationTenantIdentity } from '../identity.ts'

type ConsumerReadinessInput = {
    organizationId: string
    member: { userId: string, role: OrganizationRole }
    downstreamProof: OrganizationSharedWatchlistDownstreamProof
    integrationGuardrails: OrganizationSharedWatchlistIntegrationGuardrails
    alertQueueVisibility: OrganizationSharedWatchlistAlertQueueVisibility
    webhookDestinationOwnership: ReturnType<typeof organizationAlertCaseWorkflowState>['webhookDestinationOwnership']
}

export function buildOrganizationConsumerReadiness(input: ConsumerReadinessInput): OrganizationSharedWatchlistConsumerReadiness {
    const webhook = input.webhookDestinationOwnership
    const visibility = input.alertQueueVisibility
    const consumerReadinessBlockers = Array.from(new Set([
        ...input.integrationGuardrails.blockerCodes,
        ...visibility.blockerCodes,
        ...visibility.denialGuardrails.blockerCodes,
        ...input.integrationGuardrails.caseSafety.blockerCodes,
        ...webhook.blockerCodes,
    ].map(String)))
    const consumerReadiness: OrganizationSharedWatchlistConsumerReadiness = {
        schemaVersion: 'organization.shared_watchlist_consumer_readiness.v1',
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        sourceFamily: 'organization_watchlist',
        member: { userId: input.member.userId, role: input.member.role, status: 'active' },
        routes: {
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
            alertList: visibility.routes.list,
            alertReplay: visibility.routes.replay,
            caseList: input.downstreamProof.caseBridge.caseWorkflowContract.routes.list,
            caseOpen: input.downstreamProof.caseBridge.caseWorkflowContract.routes.open,
            webhookDeliver: webhook.route,
            dashboardReadiness: 'GET /api/organizations/:id/alert-readiness',
        },
        watchlists: {
            activeCount: input.downstreamProof.watchlistOwnership.activeCount,
            pausedCount: input.downstreamProof.watchlistOwnership.pausedCount,
            archivedCount: input.downstreamProof.watchlistOwnership.archivedCount,
            activeIds: input.downstreamProof.watchlistOwnership.activeIds,
            pausedIds: input.downstreamProof.watchlistOwnership.pausedIds,
            archivedIds: input.downstreamProof.watchlistOwnership.archivedIds,
            alertGeneratorKeys: visibility.watchlistScope.alertGeneratorKeys,
            crossTenantCollisionAllowed: visibility.watchlistScope.crossTenantCollisionAllowed,
        },
        readiness: {
            alertQueueReady: visibility.visibility.allowed && visibility.blockerCodes.length === 0,
            caseWorkflowReady: input.integrationGuardrails.caseSafety.ok,
            webhookDeliveryReady: webhook.blockerCodes.length === 0,
            dashboardReadinessReady: true,
        },
        roleGates: {
            mutateWatchlists: ['owner', 'admin', 'editor'],
            exportTerms: visibility.visibility.allowedRoles,
            manualWebhookTrigger: webhook.roleGates.manualTriggerAllowedRoles,
            assignCase: visibility.roleActionMatrix.roleGates.assign_case,
        },
        blockers: consumerReadinessBlockers,
        noLeakFields: [
            'activeTerms[].term', 'activeTerms[].value', 'otherOrg.watchlistItemIds',
            'otherOrg.alertGeneratorKeys', 'destination.secret', 'case.evidence.rawContent',
        ],
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
    return consumerReadiness
}
