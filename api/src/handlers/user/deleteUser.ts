import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { revokeAllTokens } from '#utils/auth/session.ts'
import { accountDeletionOrganizationBlocker, lockAccountDeletionRows } from '#utils/auth/accountDeletion.ts'
import { userHasHanasandInternalAccess } from '#utils/systemEvent.ts'
import { recordScheduledDeletionAudit } from './accountDeletionAudit.ts'

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
            await lockAccountDeletionRows(id, query)
            const blocker = await accountDeletionOrganizationBlocker(id, query)
            if (blocker) return { blocker, user: null, alreadyScheduled: null }

            const userResult = await query(`
                UPDATE users
                SET deletion_requested_at = NOW(),
                    deletion_scheduled_at = NOW() + INTERVAL '30 days',
                    deletion_restore_token_hash = NULL,
                    deletion_email_token_hash = NULL
                WHERE id = $1
                  AND COALESCE(reserved, FALSE) IS FALSE
                  AND deletion_scheduled_at IS NULL
                RETURNING id, name, avatar, active, deletion_requested_at, deletion_scheduled_at
            `, [id])
            const user = userResult.rows[0] as User | undefined
            if (user) return { blocker: null, user, alreadyScheduled: null }

            const existing = await query(`
                SELECT id, name, avatar, active, deletion_requested_at, deletion_scheduled_at
                FROM users
                WHERE id = $1
                  AND COALESCE(reserved, FALSE) IS FALSE
                  AND deletion_scheduled_at IS NOT NULL
            `, [id])
            return {
                blocker: null,
                user: null,
                alreadyScheduled: existing.rows[0] as User | undefined,
            }
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
        if (outcome.alreadyScheduled) {
            return res.send({
                message: 'User is already scheduled for deletion.',
                pending_deletion: true,
                user: outcome.alreadyScheduled,
            })
        }
        const userResult = { rows: outcome.user ? [outcome.user] : [] }
        if (!userResult.rows.length) {
            return res.status(404).send({ error: `There is no user with id ${id}` })
        }

        await revokeAllTokens({ userId: id, revokedBy: actorId })
        const user: User = userResult.rows[0]
        await recordScheduledDeletionAudit(req, {
            actorId,
            targetId: id,
            targetName: user.name,
            source: 'admin',
            wasHanasandInternalMember,
        })
        return res.send({ message: 'User scheduled for deletion.', pending_deletion: true, user })
    } catch (error) {
        console.error(`Database error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
