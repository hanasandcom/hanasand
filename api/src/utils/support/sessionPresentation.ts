import { supportSessionLifecycleReceipt } from './sessionLifecycleReceipt.ts'
import type { SupportSessionState } from './sessionTypes.ts'

export { supportSessionAuthorizationProof } from './sessionAuthorizationProof.ts'
export { supportSessionWorkflowRoutes } from './sessionWorkflowRoutes.ts'

export function supportSessionResponse(input: SupportSessionState) {
    const lifecycleReceipt = supportSessionLifecycleReceipt(input)
    return {
        schemaVersion: 'support.scoped_session.v1',
        id: input.supportSessionId,
        status: input.status,
        actorId: input.actorId,
        target: {
            organizationId: input.organizationId || null,
            userId: input.targetUserId || null,
        },
        reason: input.reason,
        allowedActions: input.allowedActions || [],
        scope: input.scope || [],
        durationMinutes: input.durationMinutes || null,
        expiresAt: input.expiresAt,
        revokedBy: input.revokedBy || null,
        revokedAt: input.revokedAt || null,
        requestId: input.requestId,
        outcome: input.status === 'active' ? 'success' : input.status === 'revoked' ? 'success' : 'denied',
        auditEventIds: input.auditEventIds,
        lifecycleReceipt,
        audit: {
            actionType: lifecycleReceipt.actionType,
            source: 'admin',
            service: 'hanasand-api',
            eventIds: input.auditEventIds,
            query: lifecycleReceipt.replay.current,
        },
        copyText: [
            `Support session ${input.status}`,
            `Session: ${input.supportSessionId}`,
            `Org: ${input.organizationId || '*'}`,
            `User: ${input.targetUserId || '*'}`,
            `Expires: ${input.expiresAt}`,
            `Request: ${input.requestId}`,
            `Audit events: ${input.auditEventIds.join(', ') || 'pending index refresh'}`,
            `Reason: ${input.reason}`,
        ].join('\n'),
    }
}
