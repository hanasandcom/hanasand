import run from '#db'
import { supportText } from './adminSupportInput.ts'

export async function loadSupportSessionState(supportSessionId: string) {
    const result = await run(`
        SELECT id, event_type, actor_id, object_id, organization_id, subject_id, request_id, reason, outcome, context, created_at
        FROM system_events
        WHERE subject_id = $1
          AND event_type IN ('support.session.create', 'support.session.revoke')
        ORDER BY created_at ASC, id ASC
    `, [supportSessionId])
    const create = result.rows.find((row: Record<string, unknown>) => row.event_type === 'support.session.create') as Record<string, any> | undefined
    if (!create) return null
    const revoke = [...result.rows].reverse().find((row: Record<string, unknown>) => row.event_type === 'support.session.revoke' && row.outcome === 'success') as Record<string, any> | undefined
    const context = create.context as Record<string, unknown>
    return {
        supportSessionId,
        actorId: supportText(create.actor_id),
        reason: supportText(create.reason),
        requestId: supportText(create.request_id),
        organizationId: supportText(context.targetOrganizationId || create.organization_id),
        targetUserId: supportText(context.targetUserId || create.object_id),
        allowedActions: Array.isArray(context.allowedActions) ? context.allowedActions.map(action => supportText(action)).filter(Boolean) : [],
        scope: Array.isArray(context.scope) ? context.scope.map(item => supportText(item)).filter(Boolean) : [],
        durationMinutes: Number(context.durationMinutes || 0),
        expiresAt: supportText(context.expiresAt),
        status: revoke ? 'revoked' : Date.parse(supportText(context.expiresAt)) <= Date.now() ? 'expired' : 'active',
        revokedBy: revoke ? supportText(revoke.actor_id) : null,
        revokedAt: revoke ? supportText(revoke.created_at) : null,
        auditEventIds: result.rows.map((row: Record<string, unknown>) => Number(row.id)).filter(id => Number.isFinite(id)),
    }
}
