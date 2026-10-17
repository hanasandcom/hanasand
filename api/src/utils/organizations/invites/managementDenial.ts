import type { OrganizationRole } from '../../organizationRoles.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationRolesFor } from '../authorization/roleActions.ts'

export function organizationInviteManagementDenial(input: {
    organizationId: string
    actorId: string
    actorRole?: OrganizationRole | null
    action: 'list_invites' | 'create_invite' | 'revoke_invite' | 'resend_invite' | 'manage_invites'
    inviteId?: string | null
    requestId?: string | null
    reason?: string | null
    message: string
}) {
    return {
        schemaVersion: 'organization.invite_management_denial.v1' as const,
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        action: input.action,
        inviteId: input.inviteId ?? null,
        denialReason: 'role_not_allowed' as const,
        message: input.message,
        statusCode: 403,
        allowedRoles: organizationRolesFor('managers'),
        readRoles: organizationRolesFor('managers'),
        memberCanListInvites: false,
        memberCanCreateInvites: false,
        viewerCanListInvites: false,
        viewerCanCreateInvites: false,
        nonmemberEnumeration: false as const,
        safeFields: [
            'schemaVersion',
            'organizationId',
            'tenantId',
            'actorRole',
            'action',
            'inviteId',
            'denialReason',
            'requestId',
        ],
        noLeakFields: [
            'pendingInvites[]',
            'invite.email',
            'acceptanceToken',
            'otherOrg.invites',
        ],
        serviceLogAction: 'organization_invite_management_denied' as const,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}
