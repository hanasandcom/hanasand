import type { OrganizationInviteAction, OrganizationLifecycleStatus } from '../inputTypes.ts'
import type { OrganizationInviteRow, OrganizationMemberRow } from '../rowTypes.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import { normalizeOrganizationRole } from '../../organizationRoles.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationMembershipBlockedDownstreamRoutes } from '../lifecycleRoutes.ts'

export function organizationInviteAcceptanceReference(inviteId: string) {
    return {
        acceptanceToken: inviteId,
        acceptancePath: `/api/organizations/invites/${encodeURIComponent(inviteId)}/accept`,
    }
}

export function toInvite(row: OrganizationInviteRow) {
    return {
        id: row.id,
        ...organizationTenantIdentity(row.organization_id, row.organization_id),
        ...organizationInviteAcceptanceReference(row.id),
        email: row.email,
        role: row.role ? normalizeOrganizationRole(row.role) : undefined,
        invitedBy: row.invited_by,
        acceptedBy: row.accepted_by ?? null,
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at ?? null,
    }
}

export function organizationInviteAcceptanceDenial(input: {
    invite?: OrganizationInviteRow | null
    organizationStatus?: OrganizationLifecycleStatus | null
    memberStatus?: OrganizationMemberRow['status'] | null
    userActive?: boolean | null
    requestId?: string | null
}) {
    const status = input.invite?.status ?? null
    const organizationStatus = input.organizationStatus ?? 'active'
    const blockerCode = !input.invite
        ? 'invite_not_found'
        : organizationStatus === 'archived'
            ? 'org_archived'
            : organizationStatus === 'deleted'
                ? 'org_deleted'
                : status === 'accepted'
                    ? 'invite_already_accepted'
                    : input.memberStatus === 'removed'
                        ? 'member_revoked'
                        : input.userActive === false
                            ? 'member_deactivated'
                            : status === 'revoked'
                                ? 'member_revoked'
                                : Date.parse(input.invite.expires_at) <= Date.now()
                                    ? 'invite_expired'
                                    : 'invite_not_pending'

    return {
        schemaVersion: 'organization.invite_acceptance_denial.v1' as const,
        ...organizationTenantIdentity(input.invite?.organization_id ?? null, input.invite?.organization_id ?? null),
        inviteId: input.invite?.id ?? null,
        acceptanceToken: input.invite?.id ?? null,
        inviteStatus: status,
        organizationStatus,
        memberStatus: input.memberStatus ?? null,
        userActive: input.userActive ?? null,
        blockerCode,
        statusCode: input.invite ? 409 : 404,
        removedMemberDenied: input.memberStatus === 'removed',
        deactivatedUserDenied: input.userActive === false,
        nonmemberEnumeration: false as const,
        safeFields: [
            'schemaVersion',
            'organizationId',
            'tenantId',
            'inviteId',
            'inviteStatus',
            'organizationStatus',
            'memberStatus',
            'userActive',
            'blockerCode',
            'requestId',
        ],
        noLeakFields: [
            'invite.email',
            'otherOrg.invites',
            'otherOrg.members',
            'acceptanceToken.email',
            'activeTerms[]',
            'watchlistScope.alertGeneratorKeys',
            'destination.secret',
        ],
        blockedRoutes: [...organizationMembershipBlockedDownstreamRoutes],
        blockedConsumerContracts: [
            'organization.shared_watchlist_readiness_export.v1',
            'organization.watchlist_alert_generation_consumer.v1',
            'organization.case_visibility_consumer.v1',
            'organization.webhook_destination_access_decision.v1',
            'organization.webhook_alert_delivery_readiness.v1',
        ],
        readinessRefs: {
            inviteLifecycle: 'organization.invite_lifecycle_readiness_proof.v1' as const,
            sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1' as const,
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1' as const,
            alertCasePersistence: 'organization.alert_case_bridge_persistence_receipt.v1' as const,
            webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1' as const,
        },
        ownerlessRecoveryMutationAllowed: false,
        accessRequiresAcceptedMembership: true,
        serviceLogAction: 'organization_invite_acceptance_denied' as const,
        requestId: input.requestId ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}

export function organizationInviteActionDenial(input: {
    organizationId: string
    actorId: string
    actorRole?: OrganizationRole | null
    invite: OrganizationInviteRow
    action: OrganizationInviteAction
    requestId?: string | null
    reason?: string | null
    message: string
}) {
    return {
        schemaVersion: 'organization.invite_action_denial.v1' as const,
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        inviteId: input.invite.id,
        acceptanceToken: input.invite.id,
        inviteStatus: input.invite.status,
        inviteRole: input.invite.role,
        action: input.action,
        blockerCode: input.invite.status === 'accepted' ? 'invite_already_accepted' as const : 'invite_not_actionable' as const,
        message: input.message,
        statusCode: 409,
        memberManagementRoute: 'GET /api/organizations/:id/members' as const,
        replacementActions: ['update_member_role', 'remove_member'] as const,
        nonmemberEnumeration: false as const,
        safeFields: [
            'schemaVersion',
            'organizationId',
            'tenantId',
            'inviteId',
            'inviteStatus',
            'inviteRole',
            'action',
            'blockerCode',
            'memberManagementRoute',
            'requestId',
        ],
        noLeakFields: [
            'invite.email',
            'otherOrg.invites',
            'otherOrg.members',
            'acceptanceToken.email',
        ],
        serviceLogAction: 'organization_invite_action_denied' as const,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}
