import type { ReadinessProofContext } from './context.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationMembershipBlockedDownstreamRoutes } from '../lifecycleRoutes.ts'

export function cleanupWorkspaceProofSections(context: ReadinessProofContext) {
    const { input, watchlists, acceptedOrInvitedCount, tenMemberWorkspaceBlockers, cleanupRequired } = context
    return {
        lifecycleCleanupProof: {
            schemaVersion: 'organization.lifecycle_cleanup_readiness.v1',
            ...organizationTenantIdentity(input.downstreamAuthorization.organizationId, input.downstreamAuthorization.tenantId),
            cleanupRoutes: {
                revokeInvite: 'POST /api/organizations/:id/invites/:inviteId/actions',
                removeMember: 'DELETE /api/organizations/:id/members/:userId',
                cleanupWatchlists: 'POST /api/organizations/:id/watchlists/cleanup',
                acceptInvite: 'POST /api/organizations/invites/:inviteId/accept',
            },
            idempotentActions: [
                'invite_revoke',
                'invite_resend',
                'watchlist_cleanup',
                'watchlist_archive',
                'watchlist_restore',
            ],
            cleanupEffects: {
                removedMemberRevokesPendingInvites: true,
                removedMemberLosesWatchlistAccess: true,
                removedMemberLosesAlertExportAccess: true,
                removedMemberLosesCaseVisibility: true,
                removedMemberLosesWebhookAccess: true,
                revokedInviteCannotGrantAccess: true,
                expiredInviteCannotGrantAccess: true,
                archivedWatchlistsExcludedFromMatching: true,
                pausedWatchlistsExcludedFromMatching: true,
            },
            blockedUntilAcceptedMembership: [...organizationMembershipBlockedDownstreamRoutes],
            affectedConsumerContracts: [
                'organization.watchlist_alert_generation_consumer.v1',
                'organization.case_visibility_consumer.v1',
                'organization.webhook_destination_access_decision.v1',
                'organization.shared_watchlist_readiness_export.v1',
                'organization.audit_timeline_readiness.v1',
            ],
            requiredAuditActions: [
                'organization_invite_revoked',
                'organization_member_removed',
                'organization_watchlist_cleanup_archived',
                'organization_watchlist_archived',
                'organization_watchlist_restored',
            ],
            lifecycleBlockers: [
                'member_revoked',
                'invite_expired',
                'watchlist_archived',
                'watchlist_paused',
                'cleanup_required',
            ],
            cleanupRequired,
            pendingInviteCount: input.lifecycleReadiness.counts.pendingInviteCount,
            pausedWatchlistCount: watchlists.pausedCount,
            archivedWatchlistCount: watchlists.archivedCount,
            noLeakFields: [
                'activeTerms[]',
                'otherOrg.watchlistItemIds',
                'otherOrg.invites',
                'destination.secret',
            ],
            nonmemberEnumeration: false,
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        tenMemberWorkspaceProof: {
            schemaVersion: 'organization.ten_member_workspace_proof.v1',
            targetMemberCount: 10,
            activeMemberCount: input.lifecycleReadiness.counts.activeMemberCount,
            pendingInviteCount: input.lifecycleReadiness.counts.pendingInviteCount,
            acceptedOrInvitedCount,
            sharedWatchlistCount: input.lifecycleReadiness.counts.sharedWatchlistCount,
            activeWatchlistTermCount: input.alertGenerationBridge.activeWatchlistTerms.length,
            canSupportTenMemberSharedWatchlistRollout: tenMemberWorkspaceBlockers.length === 0,
            readinessRefs: {
                inviteLifecycle: 'organization.invite_lifecycle_readiness_proof.v1',
                sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1',
                alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1',
                alertCasePersistence: 'organization.alert_case_bridge_persistence_receipt.v1',
                webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1',
            },
            routeRefs: {
                bulkInvite: 'POST /api/organizations/:id/invites',
                listMembers: 'GET /api/organizations/:id/members',
                createWatchlist: 'POST /api/organizations/:id/watchlists',
                alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
                alertCaseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
                webhookDeliver: 'POST /v1/dwm/webhooks/deliver',
            },
            lifecycleBlockers: tenMemberWorkspaceBlockers,
            noEnumerationFields: [
                'otherOrg.members',
                'otherOrg.watchlistItemIds',
                'otherOrg.alertGeneratorKeys',
                'destination.secret',
            ],
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
    } as const
}
