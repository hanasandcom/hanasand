import type { FastifyReply } from 'fastify'
import { inviteSnapshot } from '../cases/organizationEntityReads.ts'
import { supportInviteActionAuditQuery } from './auditQuery.ts'
import { supportInviteActionExecutionReceipt } from './executionReceipt.ts'
import { supportInviteActionExecutorDetail } from './executorDetail.ts'
import type { SupportInviteActionContext } from './types.ts'
import { toInvite, toOrganization } from '#utils/organizations.ts'

export function sendInviteActionReplay(
    context: SupportInviteActionContext,
    res: FastifyReply,
    duplicate: { id: number; request_id: string },
) {
    const before = inviteSnapshot(context.invite)
    const auditEventIds = [Number(duplicate.id)].filter(Number.isFinite)
    const replayContext = {
        organizationId: context.organization.id,
        requestId: duplicate.request_id,
        action: context.action,
        actionType: context.actionType,
        reason: context.reason,
        controls: context.controls,
        invite: context.invite,
        before,
        after: before,
        outcome: 'success' as const,
        blockers: ['duplicate_idempotency_key'],
    }
    return res.send({
        inviteAction: {
            schemaVersion: 'support.invite_action.v1',
            action: context.action,
            requestId: duplicate.request_id,
            actorId: context.actor.id,
            organization: toOrganization(context.organization),
            invite: toInvite(context.invite),
            before,
            after: inviteSnapshot(context.invite),
            reason: context.reason,
            outcome: 'success',
            idempotentReplay: true,
            blockers: ['duplicate_idempotency_key'],
            auditEventIds,
            noSilentMembershipMutation: true,
            controlledExecutor: supportInviteActionExecutorDetail(replayContext),
            executionReceipt: supportInviteActionExecutionReceipt({
                actorId: context.actor.id,
                ...replayContext,
                auditEventIds,
            }),
            audit: {
                actionType: context.actionType,
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: context.action === 'revoke' ? 'warning' : 'notice',
                eventIds: auditEventIds,
                query: supportInviteActionAuditQuery({
                    requestId: duplicate.request_id,
                    organizationId: context.organization.id,
                    inviteId: context.invite.id,
                    correlationId: context.controls.correlationId,
                    idempotencyKey: context.controls.idempotencyKey,
                    reason: context.reason,
                    actionType: context.actionType,
                    outcome: 'success',
                }),
            },
        },
    })
}
