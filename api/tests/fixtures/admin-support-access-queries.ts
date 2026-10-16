import { hasSqlFragments, state } from './admin-support-routes-state.ts'

export async function runSupportAccessQueries(sql: string, normalizedSql: string) {
    if (normalizedSql.includes('SELECT status FROM organization_invites WHERE id = $1 AND organization_id = $2 LIMIT 1')) {
        return { rows: state.supportRecoveryInviteStatus ? [{ status: state.supportRecoveryInviteStatus }] : [] }
    }
    if (normalizedSql.includes('SELECT id, status, expires_at FROM organization_invites WHERE id = $1 AND organization_id = $2 FOR UPDATE')) {
        return { rows: state.supportRecoveryInviteStatus ? [{ id: 'invite-1', status: state.supportRecoveryInviteStatus, expires_at: state.supportRecoveryInviteExpiry }] : [] }
    }
    // Organization, privacy marker, and user reads.
    if (hasSqlFragments(normalizedSql, [
        'SELECT o.*',
        'FROM organizations o',
        '(o.id ILIKE $1 OR o.name ILIKE $1 OR o.slug ILIKE $1)',
        'ORDER BY o.updated_at DESC',
        'LIMIT $2',
    ])) return { rows: state.supportOrganization ? [state.supportOrganization] : [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT o.*',
        'FROM organizations o',
        'WHERE o.id = $1',
        'LIMIT 1',
    ])) return { rows: state.supportOrganization ? [state.supportOrganization] : [] }
    if (normalizedSql.includes('SELECT audit_safe_metadata ? \'privacyDeletionRunId\' locked FROM organizations WHERE id = $1')) return { rows: [{ locked: false }] }
    if (sql.includes('SELECT id FROM organizations WHERE id = $1 FOR UPDATE')) return { rows: state.supportOrganization ? [{ id: state.supportOrganization.id }] : [] }
    if (sql.includes('UPDATE organizations SET updated_at = NOW() WHERE id = $1')) return { rows: [] }
    if (normalizedSql.includes('SELECT id, name, avatar, email, active, reserved, deactivated_at, deactivated_by, deletion_requested_at, deletion_scheduled_at FROM users WHERE id = $1 LIMIT 1')) return { rows: state.supportUser ? [state.supportUser] : [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT event.id, event.event_type, event.severity, event.source, event.service, event.actor_id',
        'FROM system_events event',
        'LEFT JOIN users actor ON actor.id = event.actor_id',
        'LEFT JOIN users target_user ON target_user.id = event.object_id',
        'LEFT JOIN organizations organization ON organization.id = event.organization_id',
        'event.organization_id ILIKE',
        'ORDER BY event.created_at DESC',
        'LIMIT',
    ])) return { rows: state.eventRows }
    // Support inspection detail reads.
    if (hasSqlFragments(normalizedSql, [
        'SELECT event.id, event.event_type, event.severity, event.source, event.service, event.actor_id',
        'FROM system_events event',
        'LEFT JOIN users actor ON actor.id = event.actor_id',
        'LEFT JOIN users target_user ON target_user.id = event.object_id',
        'LEFT JOIN organizations organization ON organization.id = event.organization_id',
        'WHERE event.organization_id = $1',
        'ORDER BY event.created_at DESC',
        'LIMIT 25',
    ])) return { rows: state.supportInspectionAuditRows }
    // Readiness counts and aggregate availability queries.
    if (normalizedSql.includes('SELECT COUNT(*)::int AS owner_count FROM organization_members membership JOIN users owner ON owner.id = membership.user_id AND owner.active IS TRUE AND owner.deletion_scheduled_at IS NULL WHERE membership.organization_id = $1 AND membership.status = \'active\' AND membership.role = \'owner\'')) return { rows: [{ owner_count: state.supportOwnerCounts.shift() ?? 2 }] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT membership.organization_id',
        'membership.role = \'owner\' AND membership.status = \'active\')::int AS owner_count',
        'AS active_owner_count',
        'membership.role IN (\'owner\', \'admin\') AND membership.status = \'active\')::int AS admin_count',
        'AS active_admin_count',
        'owner.active IS TRUE',
        'owner.deletion_scheduled_at IS NULL',
        'FROM organization_members membership JOIN users owner ON owner.id = membership.user_id WHERE membership.organization_id = ANY($1::text[]) GROUP BY membership.organization_id',
    ])) return { rows: state.supportAvailabilityResults.shift() ?? [] }
    return undefined
}
