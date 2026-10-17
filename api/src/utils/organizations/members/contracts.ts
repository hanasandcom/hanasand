import type { OrganizationMemberRow } from '../rowTypes.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import { normalizeOrganizationRole } from '../../organizationRoles.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { memberRoleTargetRoles } from '../organizationInputs.ts'

export function toMember(row: OrganizationMemberRow) {
    return {
        organizationId: row.organization_id,
        userId: row.user_id,
        name: row.name,
        avatar: row.avatar,
        role: row.role ? normalizeOrganizationRole(row.role) : undefined,
        status: row.status,
        invitedBy: row.invited_by ?? null,
        joinedAt: row.joined_at,
        createdAt: row.created_at,
    }
}

export function organizationMemberMutationDenial(input: {
    organizationId: string
    actorId: string
    actorRole?: OrganizationRole | null
    targetUserId: string
    targetRole: OrganizationRole
    action: 'remove_member' | 'change_member_role'
    requestedRole?: OrganizationRole | null
    reason?: string | null
    requestId?: string | null
    message: string
}) {
    return {
        schemaVersion: 'organization.member_mutation_denial.v1' as const,
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        targetUserId: input.targetUserId,
        targetRole: input.targetRole,
        action: input.action,
        requestedRole: input.requestedRole ?? null,
        denialReason: 'role_not_allowed' as const,
        message: input.message,
        statusCode: 403,
        allowedRoles: ['owner', 'admin'] as Array<'owner' | 'admin'>,
        allowedTargetRoles: [...memberRoleTargetRoles],
        adminAllowedTargetRoles: ['editor', 'reader'] as Array<'editor' | 'reader'>,
        ownerCanMutateOwners: true,
        adminCanMutateOwners: false,
        nonmemberEnumeration: false as const,
        serviceLogAction: 'organization_member_mutation_denied' as const,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}

export function organizationLastOwnerGuard(input: {
    organizationId: string
    actorId: string
    actorRole?: OrganizationRole | null
    targetUserId: string
    action: 'remove_owner' | 'change_owner_role'
    requestedRole?: OrganizationRole | null
    ownerCount: number
    message: string
    requestId?: string | null
}) {
    return {
        schemaVersion: 'organization.last_owner_guard.v1' as const,
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        targetUserId: input.targetUserId,
        action: input.action,
        requestedRole: input.requestedRole ?? null,
        ownerCount: input.ownerCount,
        blockerCode: 'last_owner_guard' as const,
        message: input.message,
        statusCode: 409,
        transferOwnershipRoute: 'POST /api/organizations/:id/ownership-transfer' as const,
        transferOwnershipRequired: true,
        destructiveMutationBlocked: true,
        noOrphanedOrganization: true,
        serviceLogAction: 'organization_last_owner_guard_blocked' as const,
        requestId: input.requestId ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}
