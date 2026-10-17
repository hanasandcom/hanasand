import type { ReadinessProofContext } from './context.ts'
import { organizationTenantIdentity } from '../identity.ts'

export function alertCaseProofSections(context: ReadinessProofContext) {
    const { input, blockers, actorCaseActions, canAssignCase, caseAssignmentBlockerCodes, proofOrganizationLifecycleBlockerPrefix } = context
    return {
        worker3Proof: {
            noNetworkRequired: true,
            replayRoute: 'organization_watchlist',
            exportSchema: 'organization.watchlist_alert_terms_export.v1',
            alertGenerationRefField: 'activeTerms[].alertGenerationRef',
            alertGeneratorKeyField: 'activeTerms[].alertGenerationRef.dedupe.key',
            expectedAlertFields: [
                'organizationId',
                'tenantId',
                'watchlistItemIds',
                'workflowContext.alertGenerationRefs',
                'workflowContext.alertGeneratorKeys',
                'casePath',
            ] as string[],
            testCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        alertQueueProof: {
            schemaVersion: 'organization.alert_queue_visibility_proof.v1',
            visibilitySchema: 'dwm.org_alert_queue_visibility.v1',
            routes: {
                list: 'GET /v1/dwm/alerts',
                detail: 'GET /v1/dwm/alerts/:id',
                mutate: 'PATCH /v1/dwm/alerts/:id',
                replay: 'POST /v1/dwm/alerts/:id/replay',
            },
            requiredQueryFields: ['organizationId'],
            expectedVisibilityFields: [
                'alertQueueVisibility.organizationId',
                'alertQueueVisibility.tenantId',
                'alertQueueVisibility.member.role',
                'alertQueueVisibility.allowedActions',
                'alertQueueVisibility.actionGates',
                'alertQueueVisibility.watchlistScope.watchlistItemIds',
                'alertQueueVisibility.watchlistScope.alertGeneratorKeys',
                'alertQueueVisibility.blockers',
            ] as string[],
            allowedActions: input.downstreamAuthorization.allowedActions,
            blockerCodes: blockers,
            nonmemberEnumeration: false,
        },
        caseAssignmentProof: {
            schemaVersion: 'organization.case_assignment_readiness.v1',
            sourceContracts: [
                'organization.case_visibility_consumer.v1',
                'organization.alert_case_bridge_persistence_receipt.v1',
                'organization.shared_watchlist_alert_queue_visibility.v1',
            ],
            route: 'POST /v1/cases/:caseId/assignment',
            ...organizationTenantIdentity(input.downstreamAuthorization.organizationId, input.downstreamAuthorization.tenantId),
            actor: {
                role: input.downstreamAuthorization.member.role,
                canAssignCase,
                allowedActions: actorCaseActions,
            },
            roleGates: {
                assignCase: ['owner', 'admin', 'editor', 'analyst'],
                linkCase: ['owner', 'admin', 'editor', 'analyst'],
                acknowledgeAlert: ['owner', 'admin', 'editor', 'analyst'],
                memberReadOnly: true,
                viewerReadOnly: true,
            },
            requiredCaseFields: [
                'organizationId',
                'tenantId',
                'caseId',
                'assigneeId',
                'watchlistItemIds',
                'alertGeneratorKeys',
                'visibilityDecision',
                'assignmentAudit.requestId',
            ],
            requiredAlertFields: [
                'organizationId',
                'tenantId',
                'watchlistItemIds',
                'workflowContext.alertGeneratorKeys',
                'workflowContext.allowedActions',
            ],
            visibilityInputs: [
                'member.role',
                'member.status',
                'organization.lifecycleStatus',
                'watchlist.status',
                'alertVisibilityPolicy',
            ],
            lifecycleBlockers: [
                ...proofOrganizationLifecycleBlockerPrefix(),
                'watchlist_paused',
                'watchlist_archived',
                'role_not_allowed',
            ],
            blockerCodes: caseAssignmentBlockerCodes,
            nonmemberEnumeration: false,
            crossOrgCaseAssignmentAllowed: false,
            noLeakFields: [
                'otherOrg.caseIds',
                'otherOrg.alertGeneratorKeys',
                'case.evidence.rawContent',
            ],
            proofAssertions: [
                'case_org_matches_alert_org',
                'assignee_membership_is_active',
                'member_cannot_assign_case',
                'nonmember_cannot_enumerate_cases',
            ],
        },
    } as const
}
