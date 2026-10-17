import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationSharedWatchlistConsumerReadiness } from '../contracts/consumerAdapters.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from '../contracts/downstreamProof.ts'
import type { OrganizationSharedWatchlistIntegrationGuardrails } from '../contracts/integrationGuardrails.ts'
import type { OrganizationSharedWatchlistSupportInspection } from '../contracts/supportInspection.ts'
import type { OrganizationWatchlistAlertBridgeContract } from '../contracts/alertBridge.ts'
import type { OrganizationWatchlistAlertGenerationContract } from '../contracts/alertGeneration.ts'
import type { OrganizationSharedWatchlistAlertQueueVisibility } from '../contracts/alertQueueVisibility.ts'
import { organizationAlertCaseWorkflowState } from './caseWorkflowState.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationSharedWatchlistSupportInspection } from './supportInspection.ts'

type SupportReadinessExportInput = {
    organizationId: string
    member: { userId: string, role: OrganizationRole }
    activeTermCount: number
    pausedCount: number
    archivedCount: number
    cleanupRequired: boolean
    alertGeneration: OrganizationWatchlistAlertGenerationContract
    downstreamProof: OrganizationSharedWatchlistDownstreamProof
    integrationGuardrails: OrganizationSharedWatchlistIntegrationGuardrails
    alertQueueVisibility: OrganizationSharedWatchlistAlertQueueVisibility
    webhookDestinationOwnership: ReturnType<typeof organizationAlertCaseWorkflowState>['webhookDestinationOwnership']
}

export function buildOrganizationSupportReadinessExport(input: SupportReadinessExportInput): {
    supportAccess: OrganizationWatchlistAlertBridgeContract['supportAccess']
    supportVisibility: OrganizationWatchlistAlertBridgeContract['supportVisibility']
    redactedSummary: OrganizationWatchlistAlertBridgeContract['redactedSummary']
    supportInspection: OrganizationSharedWatchlistSupportInspection
    consumerReadiness: OrganizationSharedWatchlistConsumerReadiness
} {
    const supportAccess: OrganizationWatchlistAlertBridgeContract['supportAccess'] = {
        mode: 'support_contract_only',
        blockerCode: 'support_only_access',
        message: 'Support users must inspect org watchlist alert exports through the admin support contract, not member-scoped org routes.',
    }
    const supportVisibility: OrganizationWatchlistAlertBridgeContract['supportVisibility'] = {
        mode: 'redacted_summary_only',
        contract: 'admin_support',
        safeFields: [
            'organizationId', 'tenantId', 'activeTermCount', 'termFamilies',
            'pausedCount', 'archivedCount', 'visibilityPolicy', 'allowedViewerRoles',
        ],
        redactedFields: [
            'member.userId', 'activeTerms[].term', 'activeTerms[].value', 'activeTerms[].terms',
            'activeTerms[].alertGenerationRef.term',
            'activeTerms[].alertGenerationRef.lifecycle.createdBy',
            'activeTerms[].alertGenerationRef.lifecycle.updatedBy',
        ],
        message: 'Support/admin consumers should use this summary unless an approved support action contract grants scoped member-visible inspection.',
    }
    const redactedSummary: OrganizationWatchlistAlertBridgeContract['redactedSummary'] = {
        schemaVersion: 'organization.watchlist_alert_bridge_redacted_summary.v1',
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        activeTermCount: input.activeTermCount,
        termFamilies: input.alertGeneration.termFamilies,
        pausedCount: input.pausedCount,
        archivedCount: input.archivedCount,
        cleanupRequired: input.cleanupRequired,
        visibilityPolicy: input.alertGeneration.visibilityPolicy,
        allowedViewerRoles: input.alertGeneration.allowedViewerRoles,
        containsRawTerms: false,
    }
    const supportInspection = organizationSharedWatchlistSupportInspection({
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        redactedSummary,
        supportVisibility,
        supportAccess,
        audit: input.downstreamProof.audit,
    })
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
            supportInspection: supportInspection.route,
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
            supportRedactedReadReady: supportInspection.guardrails.ok,
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
    return { supportAccess, supportVisibility, redactedSummary, supportInspection, consumerReadiness }
}
