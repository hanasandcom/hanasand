import type { FastifyReply, FastifyRequest } from 'fastify'
import { organizationLastOwnerGuard, organizationMemberMutationDenial, type OrganizationRole } from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'

type MemberMutationDenialInput = Parameters<typeof organizationMemberMutationDenial>[0]

export function sendOrganizationMemberMutationDenial(
    req: FastifyRequest,
    res: FastifyReply,
    input: MemberMutationDenialInput & { logEvent?: boolean },
) {
    const { logEvent, ...denialInput } = input
    const denial = organizationMemberMutationDenial(denialInput)
    if (logEvent) {
        logOrganizationEvent(req, denial.serviceLogAction, denial.organizationId, denial.actorId, {
            requestId: denial.requestId,
            targetUserId: denial.targetUserId,
            targetRole: denial.targetRole,
            actorRole: denialInput.actorRole,
            action: denial.action,
            denialReason: denial.denialReason,
            ...(denial.action === 'change_member_role' ? {
                requestedRole: denialInput.requestedRole,
                reason: denialInput.reason,
            } : {}),
        })
    }
    return res.status(403).send({ error: denial.message, memberMutationDenial: denial })
}

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
