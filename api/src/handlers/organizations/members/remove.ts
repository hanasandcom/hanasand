import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import { touchOrganization } from '#utils/db/identityDataWrites.ts'
import { activeOrganizationOwnerCount as activeOwnerCount } from '#utils/organizationMemberships.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import {
    toMember,
    toOrganization,
    type OrganizationInviteRow,
    type OrganizationMemberRow,
} from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'
import { sendOrganizationLifecycleBlocker } from '../lifecycle.ts'
import { loadActiveOrganizationMemberMutationRequest, loadLockedOrganizationMemberMutationContext } from '../memberMutationContext.ts'
import { loadOrganizationForMember } from '../requestContext.ts'
import { buildOrganizationMemberRemovalCleanup } from './removalReceipt.ts'
import { removalPermissionError } from './permissions.ts'
import { sendOrganizationLastOwnerGuard, sendOrganizationMemberMutationDenial } from './denials.ts'

type OrganizationMemberParams = { id: string; userId: string }

export async function deleteOrganizationMember(req: FastifyRequest<{ Params: OrganizationMemberParams }>, res: FastifyReply) {
    const mutationContext = await loadActiveOrganizationMemberMutationRequest(req, res, 'remove members')
    if (!mutationContext) return
    const { userId, organization, target } = mutationContext

    const permissionError = removalPermissionError(organization.role, target.role)
    if (permissionError) {
        return sendOrganizationMemberMutationDenial(req, res, {
            organizationId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            targetUserId: req.params.userId,
            targetRole: target.role,
            action: 'remove_member',
            requestId: req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null,
            message: permissionError,
            logEvent: true,
        })
    }

    const mutation = await withTransaction(async query => {
        const lockedContext = await loadLockedOrganizationMemberMutationContext({
            query,
            organizationId: req.params.id,
            actorId: userId,
            targetUserId: req.params.userId,
            action: 'remove members',
        })
        if (lockedContext.error) return lockedContext
        const { organization: lockedOrganization, target: lockedTarget } = lockedContext
        const lockedPermissionError = removalPermissionError(lockedOrganization.role, lockedTarget.role)
        if (lockedPermissionError) return { error: 'organization_role_forbidden' as const, organization: lockedOrganization, target: lockedTarget, permissionError: lockedPermissionError }

        const ownerCount = await activeOwnerCount(req.params.id, query)
        if (lockedTarget.role === 'owner' && ownerCount <= 1) {
            return { error: 'organization_owner_required' as const, organization: lockedOrganization, target: lockedTarget, ownerCount }
        }

        const removed = await query(`
            UPDATE organization_members
            SET status = 'removed', removed_at = NOW()
            WHERE organization_id = $1
              AND user_id = $2
              AND status = 'active'
            RETURNING *
        `, [req.params.id, req.params.userId])
        if (!removed.rows.length) return { error: 'member_not_found' as const, organization: lockedOrganization }

        const revokedInvites = await query(`
            UPDATE organization_invites
            SET status = 'revoked',
                revoked_at = NOW(),
                accepted_at = NULL,
                accepted_by = NULL
            FROM users
            WHERE organization_invites.organization_id = $1
              AND users.id = $2
              AND lower(organization_invites.email) IN (lower(users.id), lower(users.name))
              AND organization_invites.status = 'pending'
            RETURNING organization_invites.*
        `, [req.params.id, req.params.userId])
        await touchOrganization(req.params.id, query)
        return { error: null, organization: lockedOrganization, target: lockedTarget, ownerCount, removed, revokedInvites }
    })

    if (mutation.error === 'organization_not_found' || mutation.error === 'member_not_found') {
        return res.status(404).send({ error: mutation.error === 'organization_not_found' ? 'Organization not found.' : 'Organization member not found.' })
    }
    if (mutation.error === 'organization_inactive') {
        return sendOrganizationLifecycleBlocker(req, res, mutation.lifecycleBlocker, userId, mutation.organization.role)
    }
    if (mutation.error === 'organization_role_forbidden') {
        return sendOrganizationMemberMutationDenial(req, res, {
            organizationId: req.params.id,
            actorId: userId,
            actorRole: mutation.organization.role,
            targetUserId: req.params.userId,
            targetRole: mutation.target.role,
            action: 'remove_member',
            requestId: req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null,
            message: mutation.permissionError,
        })
    }
    if (mutation.error === 'organization_owner_required') {
        return sendOrganizationLastOwnerGuard(req, res, {
            organizationId: req.params.id,
            actorId: userId,
            actorRole: mutation.organization.role,
            targetUserId: req.params.userId,
            action: 'remove_owner',
            ownerCount: mutation.ownerCount,
            message: 'Transfer ownership before removing the last owner.',
            requestId: req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null,
        })
    }

    const { organization: authorizedOrganization, target: authorizedTarget, ownerCount, removed, revokedInvites } = mutation
    logOrganizationEvent(req, 'organization_member_removed', req.params.id, userId, {
        targetUserId: req.params.userId,
        targetRole: authorizedTarget.role,
        actorRole: authorizedOrganization.role,
        ownerCountBefore: ownerCount,
        revokedInviteIds: revokedInvites.rows.map((invite: OrganizationInviteRow) => invite.id),
        revokedInviteCount: revokedInvites.rows.length,
    })
    await recordSystemEvent(req, {
        actionType: 'organization.membership.removed',
        actorId: userId,
        organizationId: req.params.id,
        targetType: 'organization_member',
        targetId: req.params.userId,
        entityId: req.params.id,
        context: {
            targetRole: authorizedTarget.role,
            revokedInviteIds: revokedInvites.rows.map((invite: OrganizationInviteRow) => invite.id),
        },
    })

    const updated = await loadOrganizationForMember(req.params.id, userId)
    return res.send({
        organization: updated ? toOrganization(updated) : null,
        member: toMember(removed.rows[0] as OrganizationMemberRow),
        memberRemovalCleanup: buildOrganizationMemberRemovalCleanup({
            organizationId: req.params.id,
            targetUserId: req.params.userId,
            targetRole: authorizedTarget.role,
            targetRoleBeforeRemoval: target.role,
            revokedInviteIds: revokedInvites.rows.map((invite: OrganizationInviteRow) => invite.id),
            revokedInviteCount: revokedInvites.rows.length,
        }),
    })
}
