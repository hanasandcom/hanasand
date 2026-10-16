import type { FastifyReply } from 'fastify'
import { inviteSnapshot } from '../cases/organizationEntityReads.ts'
import { recordSupportInviteActionExecutorBlock } from './controls.ts'
import { supportInviteActionExecutionReceipt } from './executionReceipt.ts'
import { supportInviteActionExecutorDetail } from './executorDetail.ts'
import type { SupportInviteActionContext } from './types.ts'
import { supportError, cleanContext } from '#utils/support/adminSupportInput.ts'
import { loadSystemEventIds } from '#utils/systemEvent.ts'

export async function sendInviteActionDenial(input: Omit<SupportInviteActionContext, 'invite'> & {
    res: FastifyReply
    invite: SupportInviteActionContext['invite'] | null
    blocker: string
    status: number
    message: string
}) {
    const inviteId = input.invite?.id || input.req.params.inviteId
    const before = input.invite ? inviteSnapshot(input.invite) : null
    const blockers = [input.blocker]
    await recordSupportInviteActionExecutorBlock(input.req, {
        actorId: input.actor.id,
        organizationId: input.organization.id,
        inviteId,
        requestId: input.requestId,
        action: input.action,
        actionType: input.actionType,
        reason: input.reason,
        blocker: input.blocker,
        controls: input.controls,
        supportContext: cleanContext(input.req.body?.context),
    })
    const auditEventIds = await loadSystemEventIds({
        requestId: input.requestId,
        actionType: input.actionType,
        entityId: input.invite?.id || input.req.params.inviteId,
    })
    const receiptContext = {
        organizationId: input.organization.id,
        requestId: input.requestId,
        action: input.action,
        actionType: input.actionType,
        reason: input.reason,
        controls: input.controls,
        invite: input.invite,
        before,
        after: before,
        outcome: 'denied' as const,
        blockers,
    }
    return input.res.status(input.status).send(supportError(input.blocker, input.message, {
        executorBlocker: supportInviteActionExecutorDetail(receiptContext),
        executionReceipt: supportInviteActionExecutionReceipt({
            actorId: input.actor.id,
            ...receiptContext,
            auditEventIds,
        }),
    }))
}
