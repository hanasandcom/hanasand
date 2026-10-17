import type { FastifyReply } from 'fastify'
import { inviteSnapshot } from '../cases/subjectMapping.ts'
import { supportInviteActionExecutorDetail } from './executorDetail.ts'
import { supportInviteActionExecutionReceipt } from './executionReceipt.ts'
import type { SupportInviteActionContext } from './types.ts'
import { toInvite, toOrganization } from '#utils/organizations.ts'
import { cleanContext } from '#utils/support/adminSupportInput.ts'
import { loadSystemEventIds, recordSystemEvent } from '#utils/systemEvent.ts'

export async function sendAcceptedSupportInviteActionDenial(
    req: SupportInviteActionContext['req'],
    res: FastifyReply,
    input: Omit<SupportInviteActionContext, 'req'>,
) {
    const blocker = 'accepted_invite_not_mutable_by_support_action'
    const blockers = [blocker]
    const snapshot = inviteSnapshot(input.invite)
    const actionContext = { ...input, organizationId: input.organization.id }

    await recordSystemEvent(req, {
        actionType: input.actionType,
        actorId: input.actor.id,
        targetType: 'invite',
        targetId: input.invite.email,
        organizationId: input.organization.id,
        entityId: input.invite.id,
        requestId: input.requestId,
        severity: 'notice',
        outcome: 'failed',
        reason: input.reason,
        context: {
            schemaVersion: 'support.invite_action.v1',
            action: input.action,
            requestId: input.requestId,
            inviteId: input.invite.id,
            email: input.invite.email,
            role: input.invite.role,
            before: snapshot,
            after: snapshot,
            correlationId: input.controls.correlationId,
            idempotencyKey: input.controls.idempotencyKey,
            supportSessionId: input.controls.supportSessionId || null,
            scope: input.controls.scope,
            handoffExpiresAt: input.controls.handoffExpiresAt,
            executor: supportInviteActionExecutorDetail({
                ...actionContext,
                before: snapshot,
                after: snapshot,
                outcome: 'failed',
                blockers,
            }),
            error: blocker,
            noSilentMembershipMutation: true,
            supportContext: cleanContext(req.body?.context),
        },
    })
    const auditEventIds = await loadSystemEventIds({
        requestId: input.requestId,
        actionType: input.actionType,
        entityId: input.invite.id,
    })
    return res.status(409).send({
        error: 'Accepted invites cannot be revoked or resent by support action; inspect membership state instead.',
        inviteAction: {
            schemaVersion: 'support.invite_action.v1',
            action: input.action,
            requestId: input.requestId,
            actorId: input.actor.id,
            organization: toOrganization(input.organization),
            invite: toInvite(input.invite),
            before: snapshot,
            after: snapshot,
            outcome: 'failed',
            auditEventIds,
            noSilentMembershipMutation: true,
            controlledExecutor: supportInviteActionExecutorDetail({
                ...actionContext,
                before: snapshot,
                after: snapshot,
                outcome: 'failed',
                blockers,
            }),
            executionReceipt: supportInviteActionExecutionReceipt({
                actorId: input.actor.id,
                ...actionContext,
                before: snapshot,
                after: snapshot,
                outcome: 'failed',
                auditEventIds,
                blockers,
            }),
        },
    })
}
