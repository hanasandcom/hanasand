import type { FastifyRequest } from 'fastify'
import { recordSupportExecutorBlock, supportExecutorControls } from '../executorCore.ts'
import type { SupportExecutorControls, SupportExecutorControlsResult } from '../executorCore.ts'
import type { SupportInviteAction, SupportInviteActionBody } from './types.ts'

export function supportInviteActionExecutorControls(
    req: FastifyRequest,
    body: SupportInviteActionBody | undefined,
    requestId: string,
    action: SupportInviteAction,
): SupportExecutorControlsResult {
    const requiredScope = action === 'revoke' ? 'invite:revoke' : 'invite:resend'
    return supportExecutorControls({
        req,
        body,
        requestId,
        idempotencyAction: `invite_${action}`,
        scopeAction: 'invite_assist',
        requiredScope,
        invalidScopeMessage: `Invite ${action} execution requires ${requiredScope} scope.`,
        invalidExpiryMessage: `Support invite ${action} handoff expiry must be a valid timestamp.`,
        expiredHandoffMessage: `Support invite ${action} handoff has expired; prepare a fresh action before executing.`,
    })
}

export async function recordSupportInviteActionExecutorBlock(req: FastifyRequest, input: {
    actorId: string
    organizationId: string
    inviteId: string
    requestId: string
    action: SupportInviteAction
    actionType: string
    reason: string
    blocker: string
    controls: SupportExecutorControls
    supportContext: string
}) {
    return recordSupportExecutorBlock(req, {
        actionType: input.actionType,
        action: input.action,
        actorId: input.actorId,
        targetType: 'invite',
        targetId: input.inviteId,
        entityId: input.inviteId,
        organizationId: input.organizationId,
        requestId: input.requestId,
        reason: input.reason,
        severity: input.action === 'revoke' ? 'warning' : 'notice',
        blocker: input.blocker,
        controls: input.controls,
        supportContext: input.supportContext,
        actionContext: { inviteId: input.inviteId },
    })
}
