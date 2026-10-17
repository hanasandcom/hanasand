import type { OrganizationSharedWatchlistDownstreamProof } from '../contracts/downstreamProof.ts'
import type { OrganizationDownstreamAuthorizationExport } from '../contracts/downstreamAuthorization.ts'
import { organizationAnalystPortalVisibilityAdapter } from './analystPortal.ts'
import { organizationTenantIdentity } from '../identity.ts'

export function organizationAlertCaseWorkflowState(
    proof: OrganizationSharedWatchlistDownstreamProof,
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport,
    analystPortalAdapter = organizationAnalystPortalVisibilityAdapter(proof, downstreamAuthorization)
) {
    const alertQueue = proof.alertBridge.queueVisibilityContract
    const caseWorkflow = proof.caseBridge.caseWorkflowContract

    return {
        schemaVersion: 'organization.alert_case_workflow_state.v1' as const,
        ...organizationTenantIdentity(proof.organizationId, proof.tenantId),
        sourceFamily: 'organization_watchlist' as const,
        member: downstreamAuthorization.member,
        visibility: downstreamAuthorization.visibility,
        alertRecord: {
            route: alertQueue.routes.list,
            requiredQueryFields: alertQueue.requiredQueryFields,
            requiredPersistedFields: [
                'organizationId',
                'tenantId',
                'ownerOrganizationId',
                'sourceFamily',
                'watchlistItemIds',
                'watchlist.ownerOrganizationId',
                'matchedTerm.termFamily',
                'matchedTerm.term',
                'workflowContext.alertGeneratorKeys',
                'workflowContext.visibilityDecision',
                'workflowContext.allowedActions',
            ],
            watchlistItemIds: alertQueue.watchlistScope.watchlistItemIds,
            alertGeneratorKeys: alertQueue.watchlistScope.alertGeneratorKeys,
            dedupeScope: proof.alertBridge.dedupeScope,
            crossTenantCollisionAllowed: false,
        },
        alertListing: {
            schemaVersion: 'organization.alert_listing_contract.v1' as const,
            routes: {
                list: alertQueue.routes.list,
                detail: alertQueue.routes.detail,
                update: alertQueue.routes.update,
                replay: alertQueue.routes.replay,
            },
            requiredFilters: {
                ...organizationTenantIdentity(proof.organizationId, proof.tenantId),
                watchlistItemIds: alertQueue.watchlistScope.watchlistItemIds,
                alertGeneratorKeys: alertQueue.watchlistScope.alertGeneratorKeys,
                lifecycleStatuses: ['active'] as const,
            },
            responseFields: [
                'alertId',
                'organizationId',
                'tenantId',
                'ownerOrganizationId',
                'sourceFamily',
                'watchlistItemIds',
                'matchedTerm.termFamily',
                'workflowContext.alertGeneratorKeys',
                'workflowContext.visibilityDecision',
                'workflowContext.allowedActions',
                'casePath',
                'updatedAt',
            ],
            actionGates: alertQueue.actionGates,
            allowedActions: analystPortalAdapter.allowedActions,
            deniedResponse: {
                schemaVersion: 'organization.alert_listing_denial.v1' as const,
                statusCode: 403,
                nonmemberEnumeration: false,
                redactedFields: [
                    'activeTerms[]',
                    'watchlistScope.alertGeneratorKeys',
                    'otherOrg.alertIds',
                    'case.evidence.rawContent',
                ],
                blockerCodes: alertQueue.blockerCodes,
            },
            proofAssertions: [
                'query_requires_organization_id',
                'watchlist_ids_match_org_export',
                'alert_generator_keys_match_org_export',
                'nonmember_denial_redacts_terms',
                'cross_org_dedupe_disallowed',
            ],
        },
        caseRecord: {
            route: caseWorkflow.routes.list,
            casePathTemplate: caseWorkflow.casePathTemplate,
            requiredQueryFields: caseWorkflow.requiredQueryFields,
            requiredPersistedFields: [
                'organizationId',
                'tenantId',
                'alertId',
                'casePath',
                'watchlistItemIds',
                'allowedActions',
                'visibilityDecision',
            ],
            watchlistItemIds: caseWorkflow.watchlistScope.watchlistItemIds,
            alertGeneratorKeys: caseWorkflow.watchlistScope.alertGeneratorKeys,
            actorActions: caseWorkflow.actorActions,
        },
        caseAssignment: {
            schemaVersion: 'organization.case_assignment_visibility.v1' as const,
            route: caseWorkflow.routes.update,
            ...organizationTenantIdentity(proof.organizationId, proof.tenantId),
            sourceFamily: 'organization_watchlist' as const,
            requiredPayloadFields: [
                'organizationId',
                'caseId',
                'assigneeId',
                'rationale',
                'watchlistItemIds',
            ],
            requiredPersistedFields: [
                'case.organizationId',
                'case.tenantId',
                'case.watchlistItemIds',
                'case.visibilityDecision',
                'case.assigneeId',
                'case.assignmentAudit.requestId',
            ],
            watchlistScope: {
                watchlistItemIds: caseWorkflow.watchlistScope.watchlistItemIds,
                alertGeneratorKeys: caseWorkflow.watchlistScope.alertGeneratorKeys,
                crossTenantCollisionAllowed: false as const,
            },
            allowed: caseWorkflow.actorActions.canAssignCase,
            allowedRoles: ['owner', 'admin', 'editor', 'analyst'] as const,
            actorRole: downstreamAuthorization.member.role,
            denialReason: caseWorkflow.actorActions.canAssignCase
                ? null
                : caseWorkflow.actorActions.denialReason ?? (downstreamAuthorization.visibility.allowed ? 'role_not_allowed' as const : downstreamAuthorization.visibility.reason ?? 'role_not_allowed' as const),
            blockerCodes: caseWorkflow.actorActions.canAssignCase
                ? []
                : Array.from(new Set([
                    ...caseWorkflow.blockerCodes,
                    caseWorkflow.actorActions.denialReason ?? (downstreamAuthorization.visibility.allowed ? 'role_not_allowed' : downstreamAuthorization.visibility.reason ?? 'role_not_allowed'),
                ].filter(Boolean).map(String))).sort(),
            memberLifecycleBlockers: [
                'member_revoked',
                'not_member',
                'invite_expired',
            ],
            noEnumerationFields: [
                'otherOrg.caseIds',
                'otherOrg.watchlistItemIds',
                'case.evidence.rawContent',
                'destination.secret',
            ],
            auditEventAction: 'organization_case_assignment_visibility_checked' as const,
        },
        webhookDestinationOwnership: {
            schemaVersion: 'organization.webhook_destination_ownership.v1' as const,
            route: proof.webhookBridge.route,
            eventType: proof.webhookBridge.deliveryContract.eventType,
            ...organizationTenantIdentity(proof.webhookBridge.deliveryContract.organizationId, proof.webhookBridge.deliveryContract.tenantId),
            policy: proof.webhookBridge.deliveryContract.destinationSelection.policy,
            selectedDestinationSource: proof.webhookBridge.deliveryContract.destinationSelection.selectedDestinationSource,
            requiredDestinationOrgId: proof.webhookBridge.deliveryContract.destinationSelection.requiredDestinationOrgId,
            selectedDestinationOrgField: proof.webhookBridge.deliveryContract.destinationSelection.selectedDestinationOrgField,
            selectedDestinationIdField: proof.webhookBridge.deliveryContract.destinationSelection.selectedDestinationIdField,
            skippedDestinationReasons: proof.webhookBridge.deliveryContract.destinationSelection.skippedDestinationReasons,
            nonmemberDestinationEnumeration: proof.webhookBridge.deliveryContract.destinationSelection.nonmemberDestinationEnumeration,
            idempotency: proof.webhookBridge.deliveryContract.idempotency,
            roleGates: proof.webhookBridge.deliveryContract.roleGates,
            requiredAlertFields: proof.webhookBridge.deliveryContract.requiredAlertFields,
            requiredDeliveryFields: proof.webhookBridge.deliveryContract.requiredDeliveryFields,
            redactedFields: proof.webhookBridge.deliveryContract.redactedFields,
            blockerCodes: proof.webhookBridge.deliveryContract.blockerCodes,
        },
        allowedActions: analystPortalAdapter.allowedActions,
        actionMatrix: analystPortalAdapter.actionMatrix,
        lifecycleBlockers: Array.from(new Set([
            ...proof.alertBridge.blockerCodes,
            ...proof.caseBridge.blockerCodes,
            ...downstreamAuthorization.downstream.alertGeneration.blockerCodes,
        ])),
        guardrails: {
            nonmemberEnumeration: false,
            noLeakFields: [
                'otherOrg.organizationId',
                'otherOrg.watchlistItemIds',
                'otherOrg.alertGeneratorKeys',
                'case.evidence.rawContent',
                'destination.secret',
            ],
            denialAuditEvent: 'organization_watchlist_alert_visibility_denied' as const,
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
        },
    }
}
