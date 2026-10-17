import type { ReadinessProofContext } from './context.ts'
import { organizationTenantIdentity } from '../identity.ts'

export function customerAuditProofSections(context: ReadinessProofContext) {
    const { input, blockers, proofOrganizationLifecycleBlockerPrefix } = context
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
                'support_timeline',
            ],
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        auditTimelineProof: {
            schemaVersion: 'organization.audit_timeline_readiness.v1',
            ...organizationTenantIdentity(input.downstreamAuthorization.organizationId, input.downstreamAuthorization.tenantId),
            source: 'events',
            supportRoute: '/api/admin/support/organizations/:id',
            logQuery: 'GET /api/logs?service=api&message=organization',
            requiredEventActions: [
                'organization_settings_updated',
                'organization_invites_created',
                'organization_invite_accepted',
                'organization_invite_revoked',
                'organization_invite_resent',
                'organization_member_removed',
                'organization_member_role_updated',
                'organization_watchlist_upserted',
                'organization_watchlist_updated',
                'organization_watchlist_archived',
                'organization_watchlist_alert_terms_exported',
                'organization_watchlist_alert_terms_export_denied',
                'organization_lifecycle_mutation_blocked',
            ],
            requiredMetadataFields: [
                'organizationId',
                'actorId',
                'actorRole',
                'requestId',
                'targetUserId',
                'inviteId',
                'watchlistItemId',
                'reason',
                'blockerCode',
            ],
            downstreamCorrelationFields: [
                'organizationId',
                'tenantId',
                'watchlistItemIds',
                'alertGeneratorKeys',
                'casePath',
                'webhookDestinationIds',
            ],
            lifecycleBlockers: [
                ...proofOrganizationLifecycleBlockerPrefix(),
                'invite_expired',
                'watchlist_archived',
                'watchlist_paused',
            ],
            supportReadMode: 'redacted_summary_only',
            noLeakFields: [
                'activeTerms[].term',
                'destination.secret',
                'case.evidence.rawContent',
                'otherOrg.auditEvents',
            ],
            nonmemberEnumeration: false,
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        blockers,
    } as const
}
