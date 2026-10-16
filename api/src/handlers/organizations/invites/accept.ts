import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import { touchOrganization, upsertOrganizationMember } from '#utils/db/identityDataWrites.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { organizationInviteAcceptanceDenial, type OrganizationInviteRow } from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'
import { authenticateOrganizationRequest, loadOrganizationForMember } from '../requestContext.ts'
import { buildOrganizationInviteAcceptanceResponse, type AcceptedInviteRow } from './acceptanceReceipt.ts'

type InviteParams = { inviteId: string }

export async function postOrganizationInviteAccept(req: FastifyRequest<{ Params: InviteParams }>, res: FastifyReply) {
    const userId = await authenticateOrganizationRequest(req, res)
    if (!userId) return

    const result = await withTransaction(async query => {
        const acceptedResult = await query(`
            UPDATE organization_invites
               SET status = 'accepted',
                   revoked_at = NULL,
                   accepted_at = NOW(),
                   accepted_by = $2
             WHERE id = $1
               AND status = 'pending'
               AND expires_at > NOW()
               AND EXISTS (
                   SELECT 1 FROM organizations
                    WHERE organizations.id = organization_invites.organization_id
                      AND COALESCE(organizations.status, 'active') = 'active'
               )
               AND EXISTS (
                   SELECT 1 FROM users
                    WHERE users.id = $2 AND COALESCE(users.active, TRUE) IS TRUE
               )
               AND NOT EXISTS (
                   SELECT 1 FROM organization_members
                    WHERE organization_members.organization_id = organization_invites.organization_id
                      AND organization_members.user_id = $2
                      AND organization_members.status = 'removed'
               )
            RETURNING *
        `, [req.params.inviteId, userId])
        const invite = acceptedResult.rows[0] as OrganizationInviteRow | undefined
        if (!invite) return { rows: [] }
        const member = await upsertOrganizationMember({
            organizationId: invite.organization_id,
            userId,
            role: invite.role,
            invitedBy: invite.invited_by,
        }, query)
        return { rows: [{
            invite_id: invite.id,
            organization_id: invite.organization_id,
            email: invite.email,
            invite_role: invite.role,
            invited_by: invite.invited_by,
            accepted_by: invite.accepted_by,
            invite_status: invite.status,
            invite_created_at: invite.created_at,
            expires_at: invite.expires_at,
            accepted_at: invite.accepted_at,
            user_id: member.user_id,
            member_role: member.role,
            member_status: member.status,
            joined_at: member.joined_at,
            member_created_at: member.created_at,
        }] }
    })

    if (!result.rows.length) {
        const inviteResult = await run(`
            SELECT *
            FROM organization_invites
            WHERE id = $1
            LIMIT 1
        `, [req.params.inviteId])
        const invite = inviteResult.rows[0] as OrganizationInviteRow | undefined
        const organizationStatusResult = invite
            ? await run(`
                SELECT COALESCE(status, 'active') AS status
                FROM organizations
                WHERE id = $1
                LIMIT 1
            `, [invite.organization_id])
            : { rows: [] }
        const memberStatusResult = invite
            ? await run(`
                SELECT status
                FROM organization_members
                WHERE organization_id = $1
                  AND user_id = $2
                LIMIT 1
            `, [invite.organization_id, userId])
            : { rows: [] }
        const userStatusResult = invite
            ? await run(`
                SELECT COALESCE(active, TRUE) AS active
                FROM users
                WHERE id = $1
                LIMIT 1
            `, [userId])
            : { rows: [] }
        const denial = organizationInviteAcceptanceDenial({
            invite,
            organizationStatus: organizationStatusResult.rows[0]?.status,
            memberStatus: memberStatusResult.rows[0]?.status,
            userActive: userStatusResult.rows[0]?.active,
            requestId: req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null,
        })
        if (invite) {
            logOrganizationEvent(req, denial.serviceLogAction, invite.organization_id, userId, {
                inviteId: invite.id,
                inviteStatus: invite.status,
                blockerCode: denial.blockerCode,
                requestId: denial.requestId,
            })
        }
        return res.status(denial.statusCode).send({
            error: invite ? 'Invite cannot be accepted.' : 'Pending invite not found.',
            inviteAcceptanceDenial: denial,
        })
    }

    const row = result.rows[0] as AcceptedInviteRow

    await touchOrganization(row.organization_id)
    const serviceLogAction = 'organization_invite_accepted'
    logOrganizationEvent(req, serviceLogAction, row.organization_id, userId, {
        inviteId: row.invite_id,
        role: row.member_role,
    })
    await recordSystemEvent(req, {
        actionType: 'organization.membership.invite_accepted',
        actorId: userId,
        organizationId: row.organization_id,
        targetType: 'organization_member',
        targetId: userId,
        entityId: row.invite_id,
        context: { inviteId: row.invite_id, role: row.member_role },
    })
    const organization = await loadOrganizationForMember(row.organization_id, userId)
    return res.send(buildOrganizationInviteAcceptanceResponse({ row, userId, serviceLogAction, organization }))

}
