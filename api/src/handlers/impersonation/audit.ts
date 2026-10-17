import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { supportRequestId } from '#utils/support/adminSupportInput.ts'
import { loadSystemEventIds, recordSystemEvent } from '#utils/systemEvent.ts'
import { supportImpersonationGuardrailReceipt } from './guardrailReceipt.ts'
import { impersonationError } from './auth.ts'

export async function audit(req: FastifyRequest, sessionId: string | null, actorId: string, targetId: string, actionPath: string, actionType: string, reason?: string, context: Record<string, unknown> = {}) {
    await run(`
        INSERT INTO impersonation_events (session_id, actor_id, object_id, method, path, ip, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
        sessionId,
        actorId,
        targetId,
        req.method || '',
        actionPath,
        req.ip,
        String(req.headers['user-agent'] || ''),
    ]).catch(error => {
        req.log.warn({ error, actorId, targetId, actionPath }, 'Failed to audit impersonation lifecycle event')
    })
    const requestId = supportRequestId(req)
    await recordSystemEvent(req, {
        actionType,
        actorId,
        targetType: 'user',
        targetId,
        entityId: sessionId || targetId,
        severity: actionType.endsWith('.start') ? 'warning' : 'notice',
        outcome: 'success',
        reason,
        requestId,
        context: {
            sessionId,
            path: actionPath,
            ...context,
        },
    })
    const eventIds = await loadSystemEventIds({
        requestId,
        actionType,
        entityId: sessionId || targetId,
    })
    return { requestId, eventIds }
}

async function auditDeniedImpersonationStart(req: FastifyRequest, input: {
    actorId: string
    targetId: string
    organizationId: string
    supportSessionId: string
    reason: string
    blocker: string
    message: string
    scope: string[]
    durationMinutes: number | null
    expiresAt: string | null
}) {
    const requestId = supportRequestId(req)
    await recordSystemEvent(req, {
        actionType: 'impersonation.start',
        actorId: input.actorId,
        targetType: 'user',
        targetId: input.targetId,
        organizationId: input.organizationId || null,
        entityId: input.supportSessionId || input.targetId,
        severity: 'warning',
        outcome: 'denied',
        reason: input.reason,
        requestId,
        context: {
            schemaVersion: 'support.impersonation.denied.v1',
            requestId,
            targetUserId: input.targetId,
            organizationId: input.organizationId || null,
            supportSessionId: input.supportSessionId || null,
            blockerCode: input.blocker,
            message: input.message,
            scope: input.scope,
            durationMinutes: input.durationMinutes,
            expiresAt: input.expiresAt,
            outcome: 'denied',
            noSilentImpersonation: true,
            redactionRequired: true,
        },
    })
    const eventIds = await loadSystemEventIds({
        requestId,
        actionType: 'impersonation.start',
        entityId: input.supportSessionId || input.targetId,
    })
    return { requestId, eventIds, message: input.message }
}

export async function denyImpersonationStart(req: FastifyRequest, res: FastifyReply, input: Parameters<typeof auditDeniedImpersonationStart>[1] & {
    status: number
    includeSupportSessionId?: boolean
}) {
    const auditTrail = await auditDeniedImpersonationStart(req, input)
    return res.status(input.status).send(impersonationError(input.blocker, auditTrail.message, {
        requestId: auditTrail.requestId,
        auditEventIds: auditTrail.eventIds,
        ...(input.includeSupportSessionId ? { supportSessionId: input.supportSessionId || null } : {}),
        guardrailReceipt: supportImpersonationGuardrailReceipt({
            actorId: input.actorId,
            targetId: input.targetId,
            organizationId: input.organizationId,
            supportSessionId: input.supportSessionId,
            requestId: auditTrail.requestId,
            reason: input.reason,
            scope: input.scope,
            durationMinutes: input.durationMinutes,
            expiresAt: input.expiresAt,
            outcome: 'denied',
            blocker: input.blocker,
            message: auditTrail.message,
            auditEventIds: auditTrail.eventIds,
        }),
    }))
}
export function auditLink(actionType: string, requestId: string, eventIds: number[] = []) {
    return {
        actionType,
        requestId,
        eventIds,
        href: `/system/impersonation?request=${encodeURIComponent(requestId)}&action=${encodeURIComponent(actionType)}&source=admin&service=hanasand-api`,
        api: `/api/admin/audit-events?request=${encodeURIComponent(requestId)}&action=${encodeURIComponent(actionType)}&source=admin&service=hanasand-api`,
    }
}
