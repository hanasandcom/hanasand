import { hasSqlFragments, state } from './admin-support-routes-state.ts'

export async function runSupportSessionQueries(sql: string, normalizedSql: string, values: unknown[]) {
    // System event and session reads.
    if (hasSqlFragments(normalizedSql, [
        'SELECT e.id, e.event_type, e.severity, e.source, e.service, e.actor_id',
        'FROM system_events e',
        'LEFT JOIN users actor ON actor.id = e.actor_id',
        'LEFT JOIN users target_user ON target_user.id = e.object_id',
        'LEFT JOIN organizations organization ON organization.id = e.organization_id',
        'WHERE e.id = $1',
        'ORDER BY e.created_at DESC, e.id DESC',
        'LIMIT 50',
    ])) return { rows: state.eventRows }
    if (normalizedSql.includes('SELECT id, event_type, actor_id, object_id, organization_id, subject_id, request_id, reason, outcome, context, created_at FROM system_events WHERE subject_id = $1 AND event_type IN (\'support.session.create\', \'support.session.revoke\') ORDER BY created_at ASC, id ASC')) {
        const sessionId = values[0]
        return { rows: state.supportSessionEvents.filter(event => event.subject_id === sessionId && ['support.session.create', 'support.session.revoke'].includes(String(event.event_type))) }
    }
    if (hasSqlFragments(normalizedSql, [
        'SELECT e.id, e.event_type, e.severity, e.source, e.service, e.actor_id',
        'FROM system_events e',
        'e.context->>\'supportSessionId\' = $1',
        'ORDER BY e.created_at ASC, e.id ASC',
        'LIMIT 250',
    ])) {
        const sessionId = values[0]
        return { rows: state.supportSessionEvents.filter(event => event.subject_id === sessionId || (event.context as Record<string, unknown>)?.supportSessionId === sessionId) }
    }
    return undefined
}
