import type { DownstreamProofContext } from './context.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from '../../contracts/downstreamProof.ts'
import { organizationSharedWatchlistAuditEventBridge } from '../auditContract.ts'
import { roleCanWriteWatchlist } from '../../authorization/roleActions.ts'


export function lifecycleOwnershipAuditSections(context: DownstreamProofContext): Pick<OrganizationSharedWatchlistDownstreamProof, 'ownerOrganizationId' | 'actor' | 'inviteLifecycle' | 'watchlistOwnership' | 'audit'> {
    const { organization, member, downstreamAuthorization, watchlistStates, activeIds, pausedIds, archivedIds, auditEventActions } = context
    return {
        ownerOrganizationId: organization.id,
        actor: {
            userId: member.userId,
            role: member.role,
            status: 'active',
            canManageWatchlists: roleCanWriteWatchlist(member.role),
            canExportActiveTerms: downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms,
            allowedActions: downstreamAuthorization.allowedActions,
        },
        inviteLifecycle: {
            pendingInviteCount: Number(organization.pending_invite_count ?? 0),
            acceptedInviteCreatesMembership: true,
            acceptedInviteRevocationBlocked: true,
            expiredInviteBlocker: 'invite_expired',
            revokedInviteBlocker: 'member_revoked',
            removedMemberReinviteBlocked: true,
            deactivatedUserInviteBlocked: true,
            memberRemovalRevokesPendingInvites: true,
            memberRemovalCleanupSchema: 'organization.member_removal_cleanup.v1',
            memberRemovalCleanupField: 'memberRemovalCleanup.revokedInviteIds',
            staleInviteAcceptanceBlocker: 'member_revoked',
        },
        watchlistOwnership: {
            activeIds,
            pausedIds,
            archivedIds,
            activeCount: activeIds.length,
            pausedCount: pausedIds.length,
            archivedCount: archivedIds.length,
            ownerOrganizationId: organization.id,
            isolatedByOrganizationId: true,
            duplicateTermScope: 'organization',
            lifecycleStatuses: watchlistStates.map(term => ({
                watchlistItemId: term.watchlistItemId,
                organizationId: term.organizationId,
                status: term.status,
                createdBy: term.createdBy,
                updatedBy: term.updatedBy,
            })),
        },
        audit: {
            schemaVersion: 'organization.shared_watchlist_audit_contract.v1',
            source: 'events',
            eventActions: auditEventActions,
            requiredMetadataFields: [
                'requestId',
                'watchlistItemId',
                'inviteId',
                'role',
                'reason',
                'action',
                'status',
            ],
            requestIdFields: [
                'metadata.requestId',
                'activeTerms[].alertGenerationRef.lifecycle.requestId',
                'watchlistOwnership.lifecycleStatuses[].watchlistItemId',
            ],
            actorFields: [
                'actor.userId',
                'actor.role',
                'watchlistOwnership.lifecycleStatuses[].createdBy',
                'watchlistOwnership.lifecycleStatuses[].updatedBy',
            ],
            downstreamCorrelationFields: [
                'organizationId',
                'tenantId',
                'watchlistOwnership.activeIds',
                'alertBridge.alertGeneratorKeys',
                'caseBridge.casePathTemplate',
                'webhookBridge.route',
            ],
            idempotentActions: ['invite_resend', 'invite_revoke', 'watchlist_cleanup', 'alert_terms_export'],
            proofLogQuery: 'GET /api/logs?service=api&message=organization_watchlist',
            eventBridge: organizationSharedWatchlistAuditEventBridge(auditEventActions),
        },
    }
}
