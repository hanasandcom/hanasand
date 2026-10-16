import type { FastifyReply, FastifyRequest } from 'fastify'
import { loadSystemEventIds, requireAuditReason } from '#utils/systemEvent.ts'
import { supportError, supportRequestId, supportText as text } from '#utils/support/adminSupportInput.ts'
import { loadSupportSessionState } from '#utils/support/supportSessionState.ts'
import { supportSessionResponse } from '#utils/support/sessionPresentation.ts'
import { requireAdminSupport } from '../auth.ts'
import { recordSupportSessionRevokeAudit } from './sessionRevokeAudit.ts'
import type { SupportSessionBody, SupportSessionParams } from './sessionTypes.ts'

export async function postSupportSessionRevoke(req: FastifyRequest<{ Params: SupportSessionParams, Body: SupportSessionBody }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    try {
        reason = requireAuditReason(req.body?.reason, 'Support session revoke reason')
    } catch (error) {
        return res.status(400).send(supportError('missing_support_reason', error instanceof Error ? error.message : 'Support session revoke reason is required.'))
    }

    const supportSessionId = text(req.params.sessionId)
    const state = await loadSupportSessionState(supportSessionId)
    const requestId = text(req.body?.requestId || req.body?.request_id) || supportRequestId(req)
    if (!state) {
        await recordSupportSessionRevokeAudit(req, {
            actorId: actor.id,
            supportSessionId,
            requestId,
            reason,
            outcome: 'failed',
            blocker: 'support_session_not_found',
        })
        return res.status(404).send(supportError('support_session_not_found', 'Support session not found.', { supportSessionId }))
    }
    if (state.status === 'revoked') {
        await recordSupportSessionRevokeAudit(req, {
            actorId: actor.id,
            supportSessionId,
            requestId,
            reason,
            organizationId: state.organizationId,
            targetUserId: state.targetUserId,
            outcome: 'failed',
            blocker: 'support_session_revoked',
        })
        return res.status(409).send(supportError('support_session_revoked', 'Support session is already revoked.', {
            supportSession: supportSessionResponse(state),
        }))
    }
    if (state.status === 'expired') {
        await recordSupportSessionRevokeAudit(req, {
            actorId: actor.id,
            supportSessionId,
            requestId,
            reason,
            organizationId: state.organizationId,
            targetUserId: state.targetUserId,
            outcome: 'denied',
            blocker: 'support_session_expired',
        })
        return res.status(409).send(supportError('support_session_expired', 'Support session has expired; create a new scoped session.', {
            supportSession: supportSessionResponse(state),
        }))
    }

    await recordSupportSessionRevokeAudit(req, {
        actorId: actor.id,
        supportSessionId,
        requestId,
        reason,
        organizationId: state.organizationId,
        targetUserId: state.targetUserId,
        outcome: 'success',
        blocker: null,
    })
    const auditEventIds = await loadSystemEventIds({ requestId, actionType: 'support.session.revoke', entityId: supportSessionId })
    return res.send({
        supportSession: supportSessionResponse({
            ...state,
            actorId: state.actorId,
            reason: state.reason,
            requestId,
            status: 'revoked',
            revokedBy: actor.id,
            revokedAt: new Date().toISOString(),
            auditEventIds,
        }),
    })
}
