import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { cleanContext, supportRequestId, supportText } from '#utils/support/adminSupportInput.ts'
import { audit, auditLink } from './audit.ts'
import { hashToken } from './auth.ts'
import type { StopBody } from './types.ts'

export async function stopImpersonation(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.authenticatedId) {
        return res.status(401).send({ error: actor.error || 'Unauthorized.' })
    }

    const body = req.body as StopBody | undefined
    const stopReason = supportText(body?.reason) || 'Support ended impersonation session.'
    const stopContext = cleanContext(body?.context)
    const token = String(req.headers['x-impersonation-token'] || '')
    if (!token) {
        return res.send({ ok: true })
    }

    const result = await run(`
        UPDATE impersonation_sessions
        SET revoked_at = NOW(),
            revoked_by = $2
        WHERE token_hash = $1
          AND actor_id = $2
          AND revoked_at IS NULL
        RETURNING id, actor_id, object_id, reason, created_at, expires_at, revoked_at
    `, [hashToken(token), actor.authenticatedId])
    const row = result.rows[0] as { id: string, actor_id: string, object_id: string, reason?: string | null, created_at?: string, expires_at?: string, revoked_at?: string } | undefined
    if (row) {
        const auditTrail = await audit(req, row.id, row.actor_id, row.object_id, '/api/impersonation/stop', 'impersonation.stop', stopReason, {
            schemaVersion: 'support.impersonation.stop.v1',
            requestId: supportRequestId(req),
            targetUserId: row.object_id,
            startReason: row.reason || null,
            stopReason,
            supportContext: stopContext || null,
            createdAt: row.created_at || null,
            expiresAt: row.expires_at || null,
            revokedAt: row.revoked_at || null,
            outcome: 'success',
            noSilentImpersonation: true,
        })
        const auditReference = auditLink('impersonation.stop', auditTrail.requestId, auditTrail.eventIds)
        return res.send({
            ok: true,
            requestId: auditTrail.requestId,
            auditEventIds: auditTrail.eventIds,
            impersonationStop: {
                schemaVersion: 'support.impersonation.stop.v1',
                requestId: auditTrail.requestId,
                sessionId: row.id,
                actorId: row.actor_id,
                targetUserId: row.object_id,
                reason: stopReason,
                supportContext: stopContext || null,
                createdAt: row.created_at || null,
                expiresAt: row.expires_at || null,
                revokedAt: row.revoked_at || null,
                outcome: 'success',
                auditEventIds: auditTrail.eventIds,
                audit: auditReference,
            },
            audit: auditReference,
        })
    }
    return res.send({ ok: true })
}
