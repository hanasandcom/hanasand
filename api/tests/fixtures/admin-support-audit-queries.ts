import { hasSqlFragments, state } from './admin-support-routes-state.ts'

export async function runSupportAuditQueries(sql: string, normalizedSql: string, values: unknown[]) {
    // Audit event reads.
    if (normalizedSql.includes('SELECT COUNT(*)::int AS total FROM system_events e') && normalizedSql.includes('LEFT JOIN users actor ON actor.id = e.actor_id') && normalizedSql.includes('LEFT JOIN users target_user ON target_user.id = e.object_id') && normalizedSql.includes('LEFT JOIN organizations organization ON organization.id = e.organization_id') && !normalizedSql.includes('system_event_acknowledgments')) return { rows: [{ total: state.eventRows.length }] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT e.id, e.event_type, e.severity, e.source, e.service, e.actor_id',
        'FROM system_events e',
        'LEFT JOIN system_event_acknowledgments acknowledgement ON acknowledgement.event_id = e.id',
        'LEFT JOIN users acknowledged_actor ON acknowledged_actor.id = acknowledgement.acknowledged_by',
        'WHERE e.id = $1',
        'LIMIT 1',
    ])) return { rows: state.eventRows.filter(event => String(event.id) === String(values[0])) }
    if (hasSqlFragments(normalizedSql, [
        'SELECT e.id, e.event_type, e.severity, e.source, e.service, e.actor_id',
        'FROM system_events e',
        'LEFT JOIN system_event_acknowledgments acknowledgement ON acknowledgement.event_id = e.id',
        'LEFT JOIN users acknowledged_actor ON acknowledged_actor.id = acknowledgement.acknowledged_by',
        'ORDER BY e.created_at DESC, e.id DESC',
        'LIMIT',
        'OFFSET',
    ])) return { rows: state.eventRows }
    if (normalizedSql.includes('SELECT id, event_type, severity, source, service, actor_id, object_type, object_id, subject_id, request_id, outcome, reason, context, created_at FROM system_events WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 25')) return { rows: state.eventRows }
    if (normalizedSql.includes('SELECT id, event_type, severity, source, service, actor_id, object_type, object_id, organization_id, subject_id, request_id, outcome, reason, context, created_at FROM system_events WHERE object_id = $1 OR actor_id = $1 OR subject_id = $1 ORDER BY created_at DESC LIMIT 25')) return { rows: state.eventRows }
    return undefined
}
