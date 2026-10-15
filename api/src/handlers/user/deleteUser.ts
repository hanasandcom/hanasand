import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { revokeAllTokens } from '#utils/auth/session.ts'
import { accountDeletionOrganizationBlocker } from '#utils/auth/accountDeletion.ts'
import { recordSystemEvent, userHasHanasandInternalAccess } from '#utils/systemEvent.ts'

export default async function deleteUser(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: actorId } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasHanasandInternalRouteAccess(req)
    if (!valid || !validRole || !actorId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing id.' })
    }

    try {
        const wasHanasandInternalMember = await userHasHanasandInternalAccess(id)
        const outcome = await withTransaction(async query => {
            await query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [id])
            await query(`
                SELECT organization.id
                FROM organizations organization
                JOIN organization_members membership
                  ON membership.organization_id = organization.id
                 AND membership.user_id = $1
                 AND membership.role = 'owner'
                 AND membership.status = 'active'
                WHERE organization.status = 'active'
                ORDER BY organization.id
                FOR UPDATE OF organization
            `, [id])

            const blocker = await accountDeletionOrganizationBlocker(id, query)
            if (blocker) return { blocker, user: null }

            const userResult = await query(`
                UPDATE users
                SET deletion_requested_at = NOW(),
                    deletion_scheduled_at = NOW() + INTERVAL '30 days',
                    deletion_restore_token_hash = NULL,
                    deletion_email_token_hash = NULL
                WHERE id = $1
                  AND COALESCE(reserved, FALSE) IS FALSE
                RETURNING id, name, avatar, active, deletion_requested_at, deletion_scheduled_at
            `, [id])
            return { blocker: null, user: userResult.rows[0] as User | undefined }
        })
        if (outcome.blocker) {
            return res.status(409).send({
                code: 'organization_ownership_transfer_required',
                error: `Transfer ownership or archive ${outcome.blocker.name} before deleting your account.`,
                organization_id: outcome.blocker.id,
                organization_name: outcome.blocker.name,
                active_api_key: outcome.blocker.activeApiKey,
            })
        }
        const userResult = { rows: outcome.user ? [outcome.user] : [] }
        if (!userResult.rows.length) {
            return res.status(404).send({ error: `There is no user with id ${id}` })
        }

        await revokeAllTokens({ userId: id, revokedBy: actorId })
        await recordSystemEvent(req, {
            actionType: 'user.account.deleted',
            actorId,
            source: 'admin',
            targetType: 'user',
            targetId: id,
            severity: wasHanasandInternalMember ? 'critical' : 'warning',
            context: { deletionMode: 'scheduled', hanasandOrganizationMember: wasHanasandInternalMember, targetName: userResult.rows[0].name, targetId: id },
        })
        if (wasHanasandInternalMember) {
            await recordSystemEvent(req, {
                actionType: 'admin.account.deleted',
                actorId,
                source: 'admin',
                targetType: 'user',
                targetId: id,
                severity: 'critical',
                context: { deletionMode: 'scheduled', targetName: userResult.rows[0].name, targetId: id },
            })
        }
        const user: User = userResult.rows[0]
        return res.send({ message: 'User scheduled for deletion.', pending_deletion: true, user })
    } catch (error) {
        console.error(`Database error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
