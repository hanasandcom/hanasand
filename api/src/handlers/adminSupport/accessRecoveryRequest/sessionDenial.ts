import type { FastifyReply } from 'fastify'
import { supportAccessRecoveryExecutionReceipt } from '../cases/accessRecoveryExecutionReceipt.ts'
import { supportError } from '#utils/support/adminSupportInput.ts'
import { loadSystemEventIds, recordSystemEvent } from '#utils/systemEvent.ts'
import type { SupportAccessRecoveryRequestContext } from './types.ts'

export async function sendAccessRecoverySessionDenial(
    context: Omit<SupportAccessRecoveryRequestContext, 'existingMembership' | 'inviteRow' | 'approval'>,
    res: FastifyReply,
    error: { code: string; message: string; status: number },
) {
    const { req, actor, organization, requestId, reason, input, targetUserId, supportSessionId, supportContext } = context
    const actionType = 'support.organization.access_recovery'
    const targetType = targetUserId ? 'user' : 'invite'
    const targetId = targetUserId || input.emails[0]
    const entityId = supportSessionId || targetUserId || input.emails[0]
    await recordSystemEvent(req, {
        actionType,
        actorId: actor.id,
        targetType,
        targetId,
        organizationId: organization.id,
        entityId,
        requestId,
        severity: 'warning',
        outcome: 'denied',
        reason,
        context: {
            schemaVersion: 'support.access_recovery.session_guard.v1',
            requestId,
            supportSessionId: supportSessionId || null,
            targetUserId: targetUserId || null,
            email: input.emails[0],
            role: input.role,
            expiresAt: input.expiresAt,
            blockerCode: error.code,
            requiredScope: 'recovery:invite',
            noSilentMembershipMutation: true,
            mutation: 'none',
            supportContext,
            redactionRequired: true,
        },
    })
    const auditEventIds = await loadSystemEventIds({ requestId, actionType, entityId })
    return res.status(error.status).send(supportError(error.code, error.message, {
        schemaVersion: 'support.access_recovery.session_guard.v1',
        requestId,
        supportSessionId: supportSessionId || null,
        auditEventIds,
        noSilentMembershipMutation: true,
        executionReceipt: supportAccessRecoveryExecutionReceipt({
            actorId: actor.id,
            organizationId: organization.id,
            requestId,
            reason,
            supportSessionId,
            targetUserId,
            email: input.emails[0],
            role: input.role,
            expiresAt: input.expiresAt,
            inviteId: null,
            inviteStatus: null,
            approval: null,
            outcome: 'denied',
            auditEventIds,
            blockers: [error.code],
        }),
    }))
}
