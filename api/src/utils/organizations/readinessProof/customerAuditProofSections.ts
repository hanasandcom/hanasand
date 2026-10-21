import type { ReadinessProofContext } from './context.ts'

export function customerAuditProofSections(context: ReadinessProofContext) {
    const { input, blockers } = context
    return {
        customerWorkflowProof: {
            schemaVersion: 'organization.customer_workflow_proof.v1',
            routeSequence: [
                'POST /api/organizations',
                'POST /api/organizations/:id/invites',
                'POST /api/organizations/invites/:inviteId/accept',
                'GET /api/organizations/:id/members',
                'POST /api/organizations/:id/watchlists',
                'GET /api/organizations/:id/watchlists/alert-terms',
                'GET /api/organizations/:id/alert-case-visibility',
                'POST /api/organizations/:id/watchlists/cleanup',
            ],
            requiredOrgFields: [
                'organizationId',
                'tenantId',
                'member.role',
                'counts.activeMemberCount',
                'counts.activeAdminCount',
            ],
            requiredWatchlistFields: [
                'watchlistItemId',
                'organizationId',
                'kind',
                'term',
                'status',
                'createdBy',
                'updatedBy',
                'alertGenerationRef',
            ],
            requiredAlertFields: [
                'organizationId',
                'tenantId',
                'watchlistItemIds',
                'workflowContext.alertGeneratorKeys',
                'workflowContext.visibilityDecision',
            ],
            roleGates: {
                ownerAdminMutate: true,
                memberReadExport: input.downstreamAuthorization.member.role === 'owner'
                    || input.downstreamAuthorization.member.role === 'admin'
                    || input.downstreamAuthorization.member.role === 'member',
                viewerReadOnly: true,
                nonmemberEnumeration: false,
            },
            lifecycleBlockers: blockers,
            downstreamConsumers: [
                'alert_queue',
                'case_workflow',
                'webhook_delivery',
                'dashboard_readiness',
            ],
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        blockers,
    } as const
}
