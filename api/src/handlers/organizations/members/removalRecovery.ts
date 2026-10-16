import { removedMemberBlockedRoutes } from '../downstreamRoutes.ts'
import type { OrganizationRole } from '#utils/organizations.ts'

type Input = { organizationId: string; targetUserId: string; targetRoleBeforeRemoval: OrganizationRole }

export function buildMemberConsumerAccessRecovery({ organizationId, targetUserId, targetRoleBeforeRemoval }: Input) {
    return {
        schemaVersion: 'organization.member_consumer_access_recovery.v1',
        organizationId: organizationId,
        tenantId: organizationId,
        targetUserId: targetUserId,
        targetRoleBeforeRemoval: targetRoleBeforeRemoval,
        currentMemberStatus: 'removed' as const,
        automaticRegrantAllowed: false,
        ownerlessRecoveryMutationAllowed: false,
        directMembershipMutationAllowed: false,
        requiresOwnerAdminReview: true,
        requiresAcceptedInvite: true,
        recoveryActorRoles: ['owner', 'admin'] as const,
        requiredSteps: [
            'owner_or_admin_review',
            'create_new_invite',
            'target_accepts_invite',
            'new_membership_role_applied',
        ],
        blockedUntilAcceptedMembership: [...removedMemberBlockedRoutes],
        recoveryRoutes: {
            createInvite: 'POST /api/organizations/:id/invites',
            acceptInvite: 'POST /api/organizations/invites/:inviteId/accept',
            memberList: 'GET /api/organizations/:id/members',
        },
        recoveryReceipts: [
            'organization.invite_consumer_visibility_receipt.v1',
            'organization.member_role_consumer_visibility_receipt.v1',
        ],
        supportAssistedRecoveryReceipt: {
            schemaVersion: 'organization.member_support_assisted_recovery_receipt.v1',
            supportActionHistoryBridge: 'organization.member_recovery_support_history_bridge.v1',
            allowedOutcome: 'invite_required',
            directMembershipMutationAllowed: false,
            ownerlessRecoveryMutationAllowed: false,
            requiresAcceptedInvite: true,
            requiredAuditFields: ['organizationId', 'targetUserId', 'requestId', 'supportSessionId', 'reason', 'outcome'],
            blockedRoutesUntilAcceptedMembership: [
                'GET /api/organizations/:id/watchlists',
                'GET /api/organizations/:id/watchlists/alert-terms',
                'GET /api/organizations/:id/alert-case-visibility',
                'POST /v1/dwm/webhooks/deliver',
            ],
            nonmemberEnumeration: false,
        },
        blockerCode: 'member_revoked' as const,
        nonmemberEnumeration: false,
    }
}
