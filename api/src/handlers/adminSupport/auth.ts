import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { actorHasHanasandInternalAccess } from '#utils/systemEvent.ts'
import { supportError } from '#utils/support/adminSupportInput.ts'

export async function requireAdminSupport(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.id || actor.impersonating) {
        res.status(401).send(supportError('support_auth_required', actor.error || 'Unauthorized.'))
        return null
    }
    if (!await actorHasHanasandInternalAccess(actor.id)) {
        res.status(403).send(supportError('support_role_required', 'Only admins can use support operations.'))
        return null
    }
    return { id: actor.id }
}
