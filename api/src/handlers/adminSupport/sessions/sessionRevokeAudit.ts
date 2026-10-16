import type { FastifyRequest } from 'fastify'
import { recordSystemEvent } from '#utils/systemEvent.ts'

export async function recordSupportSessionRevokeAudit(req: FastifyRequest, input: {
    actorId: string
    supportSessionId: string
    requestId: string
    reason: string
    organizationId?: string | null
    targetUserId?: string | null
    outcome: 'success' | 'denied' | 'failed'
    blocker: string | null
}) {
    await recordSystemEvent(req, {
        actionType: 'support.session.revoke',
        actorId: input.actorId,
        targetType: input.targetUserId ? 'user' : 'support_session',
        targetId: input.targetUserId || input.supportSessionId,
        organizationId: input.organizationId || null,
        entityId: input.supportSessionId,
        requestId: input.requestId,
        severity: 'notice',
        outcome: input.outcome,
        reason: input.reason,
        context: {
            schemaVersion: 'support.scoped_session.revoke.v1',
            supportSessionId: input.supportSessionId,
            targetOrganizationId: input.organizationId || null,
            targetUserId: input.targetUserId || null,
            revokedBy: input.actorId,
            revokedAt: new Date().toISOString(),
            blockerCode: input.blocker,
            immutableAudit: true,
            redactionRequired: true,
        },
    })
}
