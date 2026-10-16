import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import {
    organizationInviteManagementDenial,
    roleCanManageOrganization,
    type OrganizationInviteRow,
    type OrganizationRole,
    type OrganizationRow,
    type OrganizationMemberRow,
} from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'

export async function loadInviteRecipientState(organizationId: string, email: string) {
    const result = await run(`
        SELECT
            u.id AS user_id,
            COALESCE(u.active, TRUE) AS user_active,
            om.role AS member_role,
            om.status AS member_status
        FROM users u
        LEFT JOIN organization_members om
          ON om.organization_id = $1
         AND om.user_id = u.id
        WHERE lower(u.id) = lower($2)
           OR lower(u.name) = lower($2)
        LIMIT 1
    `, [organizationId, email])

    return result.rows[0] as {
        user_id: string
        user_active: boolean
        member_role?: OrganizationRole | null
        member_status?: OrganizationMemberRow['status'] | null
    } | undefined
}

export async function loadInviteForEmail(organizationId: string, email: string) {
    const result = await run(`
        SELECT *
        FROM organization_invites
        WHERE organization_id = $1
          AND lower(email) = lower($2)
        LIMIT 1
    `, [organizationId, email])

    return result.rows[0] as OrganizationInviteRow | undefined
}

export async function loadInviteById(organizationId: string, inviteId: string) {
    const result = await run(`
        SELECT *
        FROM organization_invites
        WHERE id = $1
          AND organization_id = $2
        LIMIT 1
    `, [inviteId, organizationId])

    return result.rows[0] as OrganizationInviteRow | undefined
}

export function sendInviteManagementDenial(
    req: FastifyRequest,
    res: FastifyReply,
    organization: OrganizationRow,
    actorId: string,
    input: {
        action: 'list_invites' | 'create_invite' | 'revoke_invite' | 'resend_invite' | 'manage_invites'
        inviteId?: string | null
        requestId?: string | null
        reason?: string | null
        message: string
    }
) {
    const denial = organizationInviteManagementDenial({
        organizationId: organization.id,
        actorId,
        actorRole: organization.role,
        ...input,
    })
    logOrganizationEvent(req, denial.serviceLogAction, organization.id, actorId, {
        requestId: denial.requestId,
        reason: denial.reason,
        action: denial.action,
        inviteId: denial.inviteId,
        actorRole: organization.role,
        denialReason: denial.denialReason,
    })
    return res.status(403).send({ error: input.message, inviteManagementDenial: denial })
}

export function organizationInviteListContract(organization: OrganizationRow, invites: OrganizationInviteRow[]) {
    const actorRole = organization.role ?? 'viewer'
    const pendingInvites = invites.filter(invite => invite.status === 'pending')
    return {
        schemaVersion: 'organization.invite_list_contract.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        actor: {
            role: actorRole,
            canListPendingInvites: roleCanManageOrganization(actorRole),
            canCreateInvites: roleCanManageOrganization(actorRole),
            canRevokeInvites: roleCanManageOrganization(actorRole),
            canResendInvites: roleCanManageOrganization(actorRole),
        },
        counts: {
            pendingInviteCount: pendingInvites.length,
            pendingAdminCount: pendingInvites.filter(invite => invite.role === 'admin').length,
            pendingMemberCount: pendingInvites.filter(invite => invite.role === 'member').length,
            pendingViewerCount: pendingInvites.filter(invite => invite.role === 'viewer').length,
        },
        routes: {
            inviteMembers: 'POST /api/organizations/:id/invites',
            acceptInvite: 'POST /api/organizations/invites/:inviteId/accept',
            inviteActions: 'POST /api/organizations/:id/invites/:inviteId/actions',
        },
        supportedRoles: ['admin', 'editor', 'reader'],
        supportedActions: ['revoke', 'resend'],
        idempotentActions: ['revoke', 'resend'],
        defaultExpiryDays: 14,
        acceptanceTokenField: 'invite.acceptanceToken',
        lifecycleDenials: {
            expiredInvite: 'invite_expired',
            revokedInvite: 'member_revoked',
            acceptedInviteReuse: 'invite_expired',
            nonManager: 'role_not_allowed',
            nonmemberEnumeration: false,
        },
        audit: {
            source: 'events',
            eventActions: [
                'organization_invites_created',
                'organization_invite_accepted',
                'organization_invite_revoked',
                'organization_invite_resent',
            ],
            requiredMetadataFields: [
                'requestId',
                'role',
                'recipientCount',
                'invitedCount',
                'skippedCount',
                'inviteId',
                'action',
                'previousStatus',
                'newStatus',
            ],
        },
        noLeakFields: [
            'otherOrg.invites',
            'acceptedInvite.acceptanceToken',
            'revokedInvite.acceptanceToken',
        ],
    }
}
