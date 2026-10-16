import type { FastifyRequest } from 'fastify'
import { recordSupportExecutorBlock, supportExecutorControls, type SupportExecutorControlsResult } from '../executorCore.ts'
import type { MemberRoleRecoveryBody } from './types.ts'

export function supportMemberRoleRecoveryExecutorControls(
    req: FastifyRequest,
    body: MemberRoleRecoveryBody | undefined,
    requestId: string,
): SupportExecutorControlsResult {
    return supportExecutorControls({
        req,
        body,
        requestId,
        idempotencyAction: 'member_role_recovery',
        scopeAction: 'member_role_recovery',
        requiredScope: 'member:role_recovery',
        invalidScopeMessage: 'Member role recovery execution requires member:role_recovery scope.',
        invalidExpiryMessage: 'Member role recovery handoff expiry must be a valid timestamp.',
        expiredHandoffMessage: 'Member role recovery handoff has expired; prepare a fresh action before executing.',
    })
}

export async function recordSupportMemberRoleRecoveryExecutorBlock(req: FastifyRequest, input: {
    actorId: string
    organizationId: string
    userId: string
    requestId: string
    reason: string
    blocker: string
    requestedRole: string
    controls: ReturnType<typeof supportMemberRoleRecoveryExecutorControls>['value']
    supportContext: string
    before?: Record<string, unknown> | null
}) {
    return recordSupportExecutorBlock(req, {
        actionType: 'support.organization.member_role_recovery',
        action: 'member_role_recovery',
        actorId: input.actorId,
        targetType: 'member',
        targetId: input.userId,
        entityId: input.userId,
        organizationId: input.organizationId,
        requestId: input.requestId,
        reason: input.reason,
        severity: input.requestedRole === 'admin' ? 'warning' : 'notice',
        blocker: input.blocker,
        controls: input.controls,
        supportContext: input.supportContext,
        actionContext: {
            targetUserId: input.userId,
            requestedRole: input.requestedRole,
            before: input.before || null,
        },
    })
}
