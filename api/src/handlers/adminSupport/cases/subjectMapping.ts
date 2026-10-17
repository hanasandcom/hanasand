import type { OrganizationMembershipAvailability } from '#utils/organizationMemberships.ts'
import type { OrganizationInviteRow } from '#utils/organizations.ts'

export function toSupportUser(row: Record<string, unknown>) {
    return {
        id: row.id,
        name: row.name,
        avatar: row.avatar,
        active: row.active,
        reserved: row.reserved,
        deactivatedAt: row.deactivated_at,
        deactivatedBy: row.deactivated_by,
        deletionRequestedAt: row.deletion_requested_at,
        deletionScheduledAt: row.deletion_scheduled_at,
    }
}

export function toSupportMember(row: Record<string, unknown>) {
    return {
        organizationId: row.organization_id,
        userId: row.user_id,
        name: row.name,
        avatar: row.avatar,
        active: row.active,
        deactivatedAt: row.deactivated_at,
        deletionScheduledAt: row.deletion_scheduled_at,
        role: row.role,
        status: row.status,
        invitedBy: row.invited_by,
        joinedAt: row.joined_at,
        createdAt: row.created_at,
    }
}

export function toSupportMemberDetail(row: Record<string, unknown>) {
    return {
        ...toSupportMember(row),
        organizationName: row.organization_name,
        organizationSlug: row.organization_slug,
        removed: row.status === 'removed',
        deactivated: row.active === false || Boolean(row.deactivated_at),
        deletionScheduled: Boolean(row.deletion_scheduled_at),
    }
}

export function membershipSnapshot(row: Record<string, unknown>) {
    return {
        organizationId: row.organization_id,
        userId: row.user_id,
        role: row.role,
        status: row.status,
        active: row.active,
        deactivatedAt: row.deactivated_at || null,
        invitedBy: row.invited_by || null,
        joinedAt: row.joined_at || null,
        createdAt: row.created_at || null,
    }
}

export function inviteSnapshot(row: OrganizationInviteRow) {
    return {
        id: row.id,
        organizationId: row.organization_id,
        email: row.email,
        role: row.role,
        status: row.status,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at || null,
        acceptedBy: row.accepted_by || null,
    }
}

export function toSupportMembership(row: Record<string, unknown>) {
    return {
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        organizationSlug: row.organization_slug,
        role: row.role,
        status: row.status,
        invitedBy: row.invited_by,
        joinedAt: row.joined_at,
        createdAt: row.created_at,
    }
}

export function buildRecoveryEligibility(input: {
    email: string
    user: string
    organizationIds: string[]
    memberships: Record<string, unknown>[]
    users: Record<string, unknown>[]
    availabilityByOrg: Map<string, OrganizationMembershipAvailability>
    invites: Record<string, unknown>[]
}) {
    return input.organizationIds.map((organizationId) => {
        const availability = input.availabilityByOrg.get(organizationId) || {
            organizationId,
            ownerCount: 0,
            activeOwnerCount: 0,
            adminCount: 0,
            activeAdminCount: 0,
            hasAvailableOwner: false,
            hasAvailableAdmin: false,
        }
        const membership = input.memberships.find(row => row.organization_id === organizationId && (!input.user || row.user_id === input.user))
        const user = input.users.find(row => row.id === input.user)
        const invites = input.invites.filter(row => row.organization_id === organizationId)
        const reasons = [
            availability.hasAvailableAdmin ? 'available_admin_present' : 'no_available_admin',
            membership?.status === 'removed' ? 'member_removed' : '',
            user && user.active === false ? 'user_deactivated' : '',
            invites.some(row => row.status === 'pending') ? 'pending_invite_exists' : '',
            input.email || input.user ? '' : 'missing_target_email_or_user',
        ].filter(Boolean)
        return {
            schemaVersion: 'support.access_recovery.eligibility.v1',
            organizationId,
            targetEmail: input.email || null,
            targetUserId: input.user || null,
            canCreateControlledInvite: Boolean(input.email && organizationId),
            noSilentMembershipMutation: true,
            requiresApproval: true,
            recommended: !availability.hasAvailableAdmin || membership?.status === 'removed' || user?.active === false,
            reasons,
            adminAvailability: availability,
        }
    })
}

export function toSupportInvite(row: Record<string, unknown>) {
    return {
        id: row.id,
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        organizationSlug: row.organization_slug,
        email: row.email,
        role: row.role,
        invitedBy: row.invited_by,
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
    }
}
