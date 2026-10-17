import crypto from 'crypto'
import type { FastifyRequest } from 'fastify'
import run from '#db'
import { recordSystemEvent } from '#utils/systemEvent.ts'

export type ImpersonationSession = {
    id: string
    actor_id: string
    object_id: string
    target_name: string
    reason: string
    scope: string[]
    organization_id: string | null
}

function hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

export async function getImpersonationSession(token: string, actorId: string): Promise<ImpersonationSession | null> {
    const result = await run(`
        SELECT
            s.id,
            s.actor_id,
            s.object_id,
            s.reason,
            u.name AS target_name,
            audit.context AS audit_context
        FROM impersonation_sessions s
        JOIN users u
          ON u.id = s.object_id
         AND u.active IS TRUE
         AND u.deletion_scheduled_at IS NULL
        LEFT JOIN LATERAL (
            SELECT context
            FROM system_events
            WHERE event_type = 'impersonation.start'
              AND subject_id = s.id::text
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        ) audit ON TRUE
        WHERE s.token_hash = $1
          AND s.actor_id = $2
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
        LIMIT 1
    `, [hashToken(token), actorId])
    const row = result.rows[0] as (Record<string, any> & ImpersonationSession & { audit_context?: unknown }) | undefined
    if (!row) return null
    const context = row.audit_context as Record<string, unknown> | undefined
    return {
        id: row.id,
        actor_id: row.actor_id,
        object_id: row.object_id,
        target_name: row.target_name,
        reason: row.reason || '',
        scope: normalizeScope(context?.scope),
        organization_id: typeof context?.organizationId === 'string' ? context.organizationId : null,
    }
}

function normalizeScope(value: unknown) {
    if (!Array.isArray(value)) return []
    return Array.from(new Set(value.map(item => typeof item === 'string' ? item.trim().toLowerCase() : '').filter(Boolean)))
}

export function isSensitiveImpersonatedRequest(req: FastifyRequest) {
    const method = (req.method || '').toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false

    const path = (req.url || '').split('?')[0] || ''
    if (isImpersonationRoute(path)) return false

    return [
        '/api/auth/sessions', '/api/user/self', '/api/user/restore', '/api/user/',
        '/api/rate-limit', '/api/system/cron', '/api/certificates',
        '/auth/sessions', '/user/self', '/user/restore', '/user/',
        '/rate-limit', '/system/cron', '/certificates',
    ].some(prefix => path.startsWith(prefix))
}

export function isImpersonationScopeAllowed(req: FastifyRequest, session: ImpersonationSession) {
    const method = (req.method || '').toUpperCase()
    const path = (req.url || '').split('?')[0] || ''
    if (isImpersonationRoute(path)) return true
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') return false
    if (session.scope.includes('support_debug')) return true
    if (path.includes('/organization') || path.includes('/organizations') || path.includes('/org/')) {
        return session.scope.includes('read_org')
    }
    return session.scope.includes('read_profile') || session.scope.includes('read_org')
}

function isImpersonationRoute(path: string) {
    return path.startsWith('/api/impersonation') || path.startsWith('/impersonation')
}

export async function auditImpersonationRequest(req: FastifyRequest, actorId: string, targetId: string, sessionId?: string) {
    const method = req.method || ''
    const path = (req.url || '').split('?')[0] || ''
    const userAgent = String(req.headers['user-agent'] || '')
    await run(`
        INSERT INTO impersonation_events (session_id, actor_id, object_id, method, path, ip, user_agent)
        SELECT $1, $2, $3, $4, $5, $6, $7
        WHERE NOT EXISTS (
            SELECT 1
            FROM impersonation_events
            WHERE actor_id = $2
              AND object_id = $3
              AND method = $4
              AND path = $5
              AND created_at > NOW() - INTERVAL '5 minutes'
        )
    `, [sessionId || null, actorId, targetId, method, path, req.ip, userAgent]).catch(error => {
        req.log.warn({ error, actorId, targetId, method, path }, 'Failed to audit impersonation request')
    })
    await recordSystemEvent(req, {
        actionType: 'impersonation.request', actorId, targetType: 'user', targetId,
        entityId: sessionId || targetId, severity: 'notice', outcome: 'success',
        context: { sessionId, method, path },
    })
}

export async function auditImpersonationScopeDenied(req: FastifyRequest, session: ImpersonationSession) {
    const method = req.method || ''
    const path = (req.url || '').split('?')[0] || ''
    await recordSystemEvent(req, {
        actionType: 'impersonation.scope_denied', actorId: session.actor_id,
        targetType: 'user', targetId: session.object_id,
        organizationId: session.organization_id, entityId: session.id,
        severity: 'warning', outcome: 'denied', reason: session.reason,
        context: {
            schemaVersion: 'support.impersonation.scope_denied.v1',
            sessionId: session.id, method, path, scope: session.scope,
            organizationId: session.organization_id,
            blockerCode: 'impersonation_scope_denied', noSilentImpersonation: true,
        },
    }).catch(error => {
        req.log.warn({ error, actorId: session.actor_id, targetId: session.object_id, method, path }, 'Failed to audit denied impersonation request')
    })
}
