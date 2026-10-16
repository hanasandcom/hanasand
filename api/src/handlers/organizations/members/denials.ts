import type { FastifyReply, FastifyRequest } from 'fastify'
import { organizationLastOwnerGuard, type OrganizationRole } from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'

export function sendOrganizationLastOwnerGuard(
    req: FastifyRequest,
    res: FastifyReply,
    input: Parameters<typeof organizationLastOwnerGuard>[0],
    details?: { requestedRole: OrganizationRole, reason: string },
) {
    const guard = organizationLastOwnerGuard(input)
    logOrganizationEvent(req, guard.serviceLogAction, guard.organizationId, guard.actorId, {
        requestId: guard.requestId,
        targetUserId: guard.targetUserId,
        actorRole: input.actorRole,
        action: guard.action,
        ...(details ? { requestedRole: details.requestedRole } : {}),
        blockerCode: guard.blockerCode,
        ownerCount: guard.ownerCount,
        ...(details ? { reason: details.reason } : {}),
    })

    return res.status(409).send({ error: guard.message, lastOwnerGuard: guard })
}
