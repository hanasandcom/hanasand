import type { FastifyReply } from 'fastify'
import { membershipSnapshot } from '../cases/subjectMapping.ts'
import { cleanContext, supportError } from '#utils/support/adminSupportInput.ts'
import { loadSystemEventIds } from '#utils/systemEvent.ts'
import {
    recordSupportMemberRoleRecoveryExecutorBlock,
} from './controls.ts'
import { supportMemberRoleRecoveryExecutorDetail } from './executorReceipt.ts'
import type { MemberRoleRecoveryContext, MemberRoleRecoveryMutation } from './types.ts'

export async function sendMutationFailure(
    context: MemberRoleRecoveryContext,
    res: FastifyReply,
    mutation: Exclude<MemberRoleRecoveryMutation, { error: null }>,
) {
    if (mutation.error === 'member_not_found') {
        return res.status(404).send({ error: 'Active organization member not found.' })
    }

    const member = 'member' in mutation ? mutation.member : context.member
    const before = membershipSnapshot(member)
    const blocker = mutation.error === 'permission_denied' ? mutation.message : mutation.error
    const status = mutation.error === 'permission_denied' ? 403 : 409
    await recordSupportMemberRoleRecoveryExecutorBlock(context.req, {
        actorId: context.actor.id,
        organizationId: context.organization.id,
        userId: context.req.params.userId,
        requestId: context.requestId,
        reason: context.reason,
        blocker,
        requestedRole: context.role,
        controls: context.controls,
        supportContext: cleanContext(context.req.body?.context),
        before,
    })
    const auditEventIds = await loadSystemEventIds({
        requestId: context.requestId,
        actionType: context.actionType,
        entityId: context.req.params.userId,
    })
    const message = mutation.error === 'permission_denied'
        ? mutation.message
        : 'Member role recovery is no longer permitted in the current organization state.'

    return res.status(status).send(supportError(blocker, message, {
        executorBlocker: supportMemberRoleRecoveryExecutorDetail({
            actorId: context.actor.id,
            organizationId: context.organization.id,
            userId: context.req.params.userId,
            requestId: context.requestId,
            reason: context.reason,
            requestedRole: context.role,
            controls: context.controls,
            member,
            before,
            after: before,
            outcome: 'denied',
            blockers: [blocker],
            auditEventIds,
        }),
    }))
}
