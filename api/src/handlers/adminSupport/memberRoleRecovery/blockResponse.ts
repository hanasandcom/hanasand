import type { FastifyReply } from 'fastify'
import { membershipSnapshot } from '../cases/subjectMapping.ts'
import { cleanContext, supportError } from '#utils/support/adminSupportInput.ts'
import {
    recordSupportMemberRoleRecoveryExecutorBlock,
} from './controls.ts'
import { supportMemberRoleRecoveryExecutorDetail } from './executorReceipt.ts'
import type { MemberRoleRecoveryContext } from './types.ts'

export async function sendMemberRoleRecoveryBlock(
    res: FastifyReply,
    context: Omit<MemberRoleRecoveryContext, 'member'> & { member: Record<string, unknown> | null },
    blocker: string,
    status: number,
    message: string,
    before: Record<string, unknown> | null = context.member ? membershipSnapshot(context.member) : null,
) {
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

    return res.status(status).send(supportError(blocker, message, {
        executorBlocker: supportMemberRoleRecoveryExecutorDetail({
            actorId: context.actor.id,
            organizationId: context.organization.id,
            userId: context.req.params.userId,
            requestId: context.requestId,
            reason: context.reason,
            requestedRole: context.role,
            controls: context.controls,
            member: context.member,
            before,
            after: before,
            outcome: 'denied',
            blockers: [blocker],
        }),
    }))
}
