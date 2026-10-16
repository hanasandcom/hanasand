import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'crypto'
import { loadSystemEventIds, recordSystemEvent, requireAuditReason } from '#utils/systemEvent.ts'
import { cleanContext, normalizeSupportSessionActions, normalizeSupportSessionDuration, normalizeSupportSessionExpiry, normalizeSupportSessionScope, supportError, supportRequestId, supportText as text } from '#utils/support/adminSupportInput.ts'
import { supportSessionResponse } from '#utils/support/sessionPresentation.ts'
import { requireAdminSupport } from '../auth.ts'
import type { SupportSessionBody } from './sessionTypes.ts'

export async function postSupportSession(req: FastifyRequest<{ Body: SupportSessionBody }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    try {
        reason = requireAuditReason(req.body?.reason, 'Support session reason')
    } catch (error) {
        return res.status(400).send(supportError('missing_support_reason', error instanceof Error ? error.message : 'Support session reason is required.'))
    }

    const organizationId = text(req.body?.organizationId || req.body?.orgId || req.body?.org)
    const targetUserId = text(req.body?.targetUserId || req.body?.userId || req.body?.user)
    if (!organizationId && !targetUserId) {
        return res.status(400).send(supportError('missing_support_target', 'Support session requires a target organization or user.'))
    }

    const actions = normalizeSupportSessionActions(req.body?.allowedActions || req.body?.actions)
    const scope = normalizeSupportSessionScope(req.body?.scope)
    const duration = normalizeSupportSessionDuration(req.body?.durationMinutes ?? req.body?.duration_minutes)
    const expiry = normalizeSupportSessionExpiry(req.body?.expiresAt ?? req.body?.expires_at, duration.value)
    if (actions.error) return res.status(400).send(actions.error)
    if (scope.error) return res.status(400).send(scope.error)
    if (duration.error) return res.status(400).send(duration.error)
    if (expiry.error) return res.status(400).send(expiry.error)

    const requestId = text(req.body?.requestId || req.body?.request_id) || supportRequestId(req)
    const supportSessionId = `support_session_${randomUUID()}`
    const context = {
        schemaVersion: 'support.scoped_session.v1',
        supportSessionId,
        requestId,
        targetOrganizationId: organizationId || null,
        targetUserId: targetUserId || null,
        allowedActions: actions.value,
        scope: scope.value,
        durationMinutes: duration.value,
        expiresAt: expiry.value,
        status: 'active',
        revokedAt: null,
        revokedBy: null,
        supportContext: cleanContext(req.body?.context),
        immutableAudit: true,
        redactionRequired: true,
    }
    await recordSystemEvent(req, {
        actionType: 'support.session.create',
        actorId: actor.id,
        targetType: targetUserId ? 'user' : 'organization',
        targetId: targetUserId || organizationId,
        organizationId: organizationId || null,
        entityId: supportSessionId,
        requestId,
        severity: 'notice',
        outcome: 'success',
        reason,
        context,
    })
    const auditEventIds = await loadSystemEventIds({ requestId, actionType: 'support.session.create', entityId: supportSessionId })

    return res.status(201).send({
        supportSession: supportSessionResponse({
            supportSessionId,
            actorId: actor.id,
            reason,
            requestId,
            organizationId,
            targetUserId,
            allowedActions: actions.value,
            scope: scope.value,
            durationMinutes: duration.value,
            expiresAt: expiry.value,
            status: 'active',
            auditEventIds,
        }),
    })
}
