import type { FastifyReply, FastifyRequest } from 'fastify'
import crypto from 'crypto'
import run from '#db'
import { supportRequestId, supportSessionIdFromRequest, supportText } from '#utils/support/adminSupportInput.ts'
import { actorHasHanasandInternalAccess, recordSystemEvent, requireAuditReason } from '#utils/systemEvent.ts'
import { requireNonImpersonatingActor, getActiveUser, hashToken, impersonationError } from './auth.ts'
import { audit, denyImpersonationStart, auditLink } from './audit.ts'
import { normalizeDurationMinutes, normalizeImpersonationScope, validateSupportSessionForImpersonation } from './guardrails.ts'
import { supportImpersonationGuardrailReceipt } from './guardrailReceipt.ts'
import type { StartBody } from './types.ts'

export async function startImpersonation(req: FastifyRequest, res: FastifyReply) {
    const actor = await requireNonImpersonatingActor(req, res)
    if (!actor) return
    const body = req.body as StartBody | undefined
    const targetId = supportText(body?.object_id || body?.targetId || body?.target_user_id)
    if (!await actorHasHanasandInternalAccess(actor.id)) {
        await recordSystemEvent(req, {
            actionType: 'impersonation.start',
            actorId: actor.id,
            targetType: 'user',
            targetId: targetId || null,
            severity: 'warning',
            outcome: 'denied',
            context: { error: 'missing_admin_role' },
        })
        return res.status(403).send(impersonationError('impersonation_support_required', 'Only admins can impersonate users.'))
    }

    if (!targetId) {
        return res.status(400).send(impersonationError('missing_target_user', 'Missing target user.'))
    }
    if (targetId === actor.id) {
        return res.status(400).send(impersonationError('invalid_target_user', 'You are already viewing your own account.'))
    }

    const target = await getActiveUser(targetId)
    if (!target) {
        return res.status(404).send(impersonationError('target_user_not_found', 'Impersonated user not found.'))
    }

    let reason: string
    let durationMinutes: number
    let scope: string[]
    const organizationId = supportText(body?.organization_id || body?.organizationId || body?.orgId)
    const supportSessionId = supportSessionIdFromRequest(req, body)
    try {
        reason = requireAuditReason(body?.reason, 'Impersonation reason')
        durationMinutes = normalizeDurationMinutes(body?.duration_minutes ?? body?.durationMinutes)
        scope = normalizeImpersonationScope(body?.scope)
    } catch (error) {
        return denyImpersonationStart(req, res, {
            actorId: actor.id,
            targetId: target.id,
            organizationId,
            supportSessionId,
            reason: supportText(body?.reason),
            blocker: 'invalid_impersonation_request',
            message: error instanceof Error ? error.message : 'Invalid impersonation request.',
            scope: [],
            durationMinutes: null,
            expiresAt: null,
            status: 400,
        })
    }

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)
    const sessionGuard = await validateSupportSessionForImpersonation({
        actorId: actor.id,
        targetUserId: target.id,
        organizationId,
        supportSessionId,
        scope,
        expiresAt: expiresAt.toISOString(),
    })
    if (sessionGuard.error) {
        return denyImpersonationStart(req, res, {
            actorId: actor.id,
            targetId: target.id,
            organizationId,
            supportSessionId,
            reason,
            blocker: sessionGuard.error.code,
            message: sessionGuard.error.message,
            scope,
            durationMinutes,
            expiresAt: expiresAt.toISOString(),
            status: sessionGuard.error.status,
            includeSupportSessionId: true,
        })
    }

    const rawToken = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`
    const session = await run(`
        INSERT INTO impersonation_sessions (token_hash, actor_id, object_id, reason, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at, expires_at
    `, [hashToken(rawToken), actor.id, target.id, reason, expiresAt.toISOString()])
    const row = session.rows[0] as { id: string, created_at: string, expires_at: string }
    const auditTrail = await audit(req, row.id, actor.id, target.id, '/api/impersonation/start', 'impersonation.start', reason, {
        schemaVersion: 'support.impersonation.request.v1',
        requestId: supportRequestId(req),
        targetUserId: target.id,
        organizationId: organizationId || null,
        supportSessionId: supportSessionId || null,
        durationMinutes,
        scope,
        expiresAt: expiresAt.toISOString(),
        approvalRequired: false,
        approvalStatus: 'not_required',
        outcome: 'success',
        noSilentImpersonation: true,
    })
    const auditReference = auditLink('impersonation.start', auditTrail.requestId, auditTrail.eventIds)

    return res.send({
        token: rawToken,
        session: {
            id: row.id,
            actor_id: actor.id,
            target,
            reason,
            duration_minutes: durationMinutes,
            scope,
            support_session_id: supportSessionId || null,
            supportSessionId: supportSessionId || null,
            organization_id: organizationId || null,
            created_at: row.created_at,
            expires_at: row.expires_at,
        },
        requestId: auditTrail.requestId,
        outcome: 'success',
        auditEventIds: auditTrail.eventIds,
        impersonationRequest: {
            schemaVersion: 'support.impersonation.request.v1',
            requestId: auditTrail.requestId,
            actorId: actor.id,
            targetUserId: target.id,
            organizationId: organizationId || null,
            supportSessionId: supportSessionId || null,
            reason,
            scope,
            durationMinutes,
            expiresAt: row.expires_at,
            approvalRequired: false,
            approvalStatus: 'not_required',
            outcome: 'success',
            auditEventIds: auditTrail.eventIds,
            audit: auditReference,
            guardrailReceipt: supportImpersonationGuardrailReceipt({
                actorId: actor.id,
                targetId: target.id,
                organizationId,
                supportSessionId,
                requestId: auditTrail.requestId,
                reason,
                scope,
                durationMinutes,
                expiresAt: row.expires_at,
                outcome: 'success',
                blocker: '',
                message: 'Impersonation start satisfied support scope and duration guardrails.',
                auditEventIds: auditTrail.eventIds,
            }),
        },
        audit: auditReference,
    })
}
