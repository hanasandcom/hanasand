// Stateful PostgreSQL fake shared by the admin support route tests.
export const state = {
    actor: { valid: true, id: 'support-admin', impersonating: false } as { valid: boolean, id: string, impersonating: boolean },
    internalAccess: true,
    eventRows: [] as Record<string, any>[],
    approvalRows: [] as Record<string, any>[],
    supportDecisionApproval: null as Record<string, any> | null,
    supportOrganization: null as Record<string, any> | null,
    supportUser: null as Record<string, any> | null,
    supportInspectionInvite: undefined as Record<string, any> | null | undefined,
    supportInspectionMember: undefined as Record<string, any> | null | undefined,
    supportInspectionAuditRows: [] as Record<string, any>[],
    supportInviteReads: 0,
    duplicateInviteAction: null as Record<string, any> | null,
    inviteActionWrites: 0,
    acceptedInviteWinsRace: false,
    supportRecoveryInviteStatus: null as string | null,
    supportRecoveryInviteExpiry: '2026-11-01T00:00:00.000Z' as string | null,
    supportRecoveryInviteUpsert: null as Record<string, unknown> | null,
    supportRecoveryInviteResult: null as Record<string, unknown> | null,
    supportRecoveryApprovalWrites: 0,
    supportMemberRole: 'editor',
    supportOwnerCounts: [2],
    supportAvailabilityResults: [] as Record<string, unknown>[][],
    inviteActionInputs: [] as Array<Record<string, unknown>>,
    supportSessionEvents: [] as Record<string, unknown>[],
    queries: [] as Array<{ sql: string, values: unknown[] }>,
    recordedEvents: [] as Array<Record<string, unknown>>,
    nextSupportEventId: 100,
}


function hasSqlFragments(normalizedSql: string, fragments: string[]) {
    return fragments.every(fragment => normalizedSql.includes(fragment))
}

function defaultSupportInviteFixture(status = 'pending') {
    return {
        id: 'invite-1', organization_id: 'org-1', email: 'member@example.com', role: 'reader', status,
        expires_at: '2026-11-01T00:00:00.000Z', accepted_at: null, accepted_by: null, revoked_at: null,
        invited_by: 'owner-1', created_at: '2026-10-01T00:00:00.000Z',
    }
}

export async function run(sql: string, values: unknown[] = []) {
    state.queries.push({ sql, values })
    const normalizedSql = sql.replace(/\s+/g, ' ').trim()
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
    if (normalizedSql.includes('SELECT id, name, avatar, active, reserved, deactivated_at, deactivated_by, deletion_requested_at, deletion_scheduled_at FROM users WHERE id = $1 LIMIT 1')) return { rows: state.supportUser ? [state.supportUser] : [] }
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
    // Invite and membership reads.
    if (hasSqlFragments(normalizedSql, [
        'SELECT invite.*, organization.name AS organization_name, organization.slug AS organization_slug',
        'FROM organization_invites invite JOIN organizations organization ON organization.id = invite.organization_id',
        'WHERE invite.id = $1 AND invite.organization_id = $2 LIMIT 1',
    ])) {
        if (state.supportInspectionInvite === null) return { rows: [] }
        if (state.supportInspectionInvite !== undefined) return { rows: [state.supportInspectionInvite] }
        return { rows: [defaultSupportInviteFixture()] }
    }
    if (normalizedSql.includes('SELECT * FROM organization_invites WHERE id = $1 AND organization_id = $2 LIMIT 1')) {
        state.supportInviteReads += 1
        if (state.supportInspectionInvite === null) return { rows: [] }
        if (state.supportInspectionInvite) return { rows: [state.supportInspectionInvite] }
        const invite = defaultSupportInviteFixture(
            state.supportInviteReads > 1 && state.acceptedInviteWinsRace ? 'accepted' : 'pending',
        )
        return { rows: [invite] }
    }
    if (hasSqlFragments(normalizedSql, [
        'SELECT',
        'FROM organization_members om',
        'JOIN users ON users.id = om.user_id',
        'JOIN organizations ON organizations.id = om.organization_id',
        'WHERE om.organization_id = $1',
        'om.user_id = $2',
    ])) {
        if (state.supportInspectionMember === null) return { rows: [] }
        if (state.supportInspectionMember) return { rows: [state.supportInspectionMember] }
        return { rows: [{
            organization_id: 'org-1', organization_name: 'Org', organization_slug: 'org', user_id: 'member-1',
            name: 'Member', avatar: null, active: true, role: state.supportMemberRole, status: 'active', invited_by: 'owner-1',
            joined_at: '2026-10-01T00:00:00.000Z', created_at: '2026-10-01T00:00:00.000Z',
        }] }
    }
    if (hasSqlFragments(normalizedSql, [
        'SELECT',
        'FROM organization_members om',
        'JOIN organizations ON organizations.id = om.organization_id',
        'om.organization_id ILIKE',
        'ORDER BY organizations.name ASC, users.name ASC',
        'LIMIT',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT',
        'FROM organization_members om',
        'JOIN users ON users.id = om.user_id',
        'WHERE om.organization_id = $1',
        'ORDER BY',
        'CASE om.role',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT',
        'FROM organization_members om',
        'JOIN organizations ON organizations.id = om.organization_id',
        'WHERE om.user_id = $1',
        'ORDER BY organizations.name ASC',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT organization_invites.*',
        'FROM organization_invites',
        'JOIN organizations ON organizations.id = organization_invites.organization_id',
        'organization_invites.organization_id ILIKE',
        'ORDER BY organization_invites.status ASC, organization_invites.created_at DESC',
        'LIMIT',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT organization_invites.*',
        'FROM organization_invites',
        'JOIN organizations ON organizations.id = organization_invites.organization_id',
        'organization_invites.id ILIKE',
        'ORDER BY organization_invites.status ASC, organization_invites.created_at DESC',
        'LIMIT',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT organization_invites.*',
        'FROM organization_invites',
        'JOIN organizations ON organizations.id = organization_invites.organization_id',
        'lower(organization_invites.email) = lower($1)',
        'organization_invites.status = \'pending\'',
        'ORDER BY organization_invites.created_at DESC',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT *',
        'FROM organization_invites',
        'WHERE organization_id = $1',
        'id = ANY($2::text[])',
        'ORDER BY created_at DESC',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT *',
        'FROM organization_invites',
        'WHERE organization_id = $1',
        'ORDER BY status ASC, created_at DESC',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT *',
        'FROM organization_watchlist_items',
        'WHERE organization_id = $1',
        'archived_at IS NULL',
        'ORDER BY kind ASC, value ASC',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT',
        'FROM dwm_webhook_destinations',
        'WHERE org_id = $1',
        'status <> \'archived\'',
        'ORDER BY status ASC, updated_at DESC',
    ])) return { rows: [] }
    // Readiness counts and aggregate availability queries.
    if (normalizedSql.includes('SELECT COUNT(*)::int AS owner_count FROM organization_members membership JOIN users owner ON owner.id = membership.user_id AND owner.active IS TRUE AND owner.deletion_scheduled_at IS NULL WHERE membership.organization_id = $1 AND membership.status = \'active\' AND membership.role = \'owner\'')) return { rows: [{ owner_count: state.supportOwnerCounts.shift() ?? 2 }] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT om.organization_id, COUNT(*) FILTER (WHERE om.role = \'owner\' AND om.status = \'active\')::int AS owner_count',
        'COUNT(*) FILTER (WHERE om.role = \'owner\' AND om.status = \'active\' AND users.active)::int AS active_owner_count',
        'COUNT(*) FILTER (WHERE om.role IN (\'owner\', \'admin\') AND om.status = \'active\')::int AS admin_count',
        'COUNT(*) FILTER (WHERE om.role IN (\'owner\', \'admin\') AND om.status = \'active\' AND users.active)::int AS active_admin_count',
        'FROM organization_members om JOIN users ON users.id = om.user_id WHERE om.organization_id = ANY($1::text[]) GROUP BY om.organization_id',
    ])) return { rows: state.supportAvailabilityResults.shift() ?? [] }
    // Idempotency checks and write operations.
    if (normalizedSql.includes('SELECT id, request_id, subject_id, context FROM system_events WHERE event_type = $1 AND organization_id = $2 AND ($3::text IS NULL OR subject_id = $3) AND outcome = \'success\' AND context->>\'idempotencyKey\' = $4 ORDER BY created_at ASC, id ASC LIMIT 1')) {
        return { rows: state.duplicateInviteAction ? [state.duplicateInviteAction] : [] }
    }
    if (normalizedSql.includes('SELECT id FROM system_events WHERE request_id = $1 AND event_type = $2 AND subject_id = $3 ORDER BY created_at DESC, id DESC LIMIT 10')) {
        if (String(values[1]).startsWith('support.session.')) {
            return { rows: state.supportSessionEvents.filter(event => event.request_id === values[0] && event.event_type === values[1] && event.subject_id === values[2]).map(event => ({ id: event.id })) }
        }
        return { rows: [{ id: 91 }] }
    }
    if (normalizedSql.includes('SELECT users.id FROM users WHERE users.id = ANY($1::text[]) OR EXISTS ( SELECT 1 FROM organization_members membership WHERE membership.organization_id = $2 AND membership.user_id = users.id AND membership.status = \'active\' AND membership.role IN (\'owner\', \'admin\') ) ORDER BY users.id FOR UPDATE')) return { rows: [] }
    if (normalizedSql.includes('UPDATE organization_members SET role = $3 WHERE organization_id = $1 AND user_id = $2 AND status = \'active\' RETURNING *')) return { rows: [{
        organization_id: 'org-1', user_id: 'member-1', role: 'reader', status: 'active',
    }] }
    if (normalizedSql.includes('UPDATE admin_access_recovery_approvals SET status = $2, approved_by = CASE WHEN $2 = \'approved\' THEN $3 ELSE NULL END, approved_at = CASE WHEN $2 = \'approved\' THEN NOW() ELSE NULL END, denied_by = CASE WHEN $2 = \'denied\' THEN $3 ELSE NULL END, denied_at = CASE WHEN $2 = \'denied\' THEN NOW() ELSE NULL END, decision_reason = $4, outcome = CASE WHEN $2 = \'approved\' THEN \'success\' ELSE \'denied\' END, updated_at = NOW() WHERE request_id = $1 AND status = \'pending\' RETURNING *')) {
        return { rows: state.supportDecisionApproval ? [{ ...state.supportDecisionApproval, status: values[1] }] : [] }
    }
    if (hasSqlFragments(normalizedSql, [
        'SELECT',
        'approval.*',
        'FROM admin_access_recovery_approvals approval',
        'JOIN organization_invites invite ON invite.id = approval.invite_id',
        'LEFT JOIN organizations organization ON organization.id = approval.organization_id',
        'WHERE approval.request_id = $1',
        'LIMIT 1',
    ])) return { rows: state.supportDecisionApproval ? [state.supportDecisionApproval] : [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT',
        'approval.*',
        'FROM admin_access_recovery_approvals approval',
        'JOIN organization_invites invite ON invite.id = approval.invite_id',
        'LEFT JOIN organizations organization ON organization.id = approval.organization_id',
        'COALESCE((',
        ') AS audit_events',
        'ORDER BY approval.updated_at DESC, approval.created_at DESC',
        'LIMIT',
    ])) return { rows: state.approvalRows }
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
    throw new Error(`Unmatched admin-support test SQL query:\n${sql}`)
}

export function resetAdminSupportDatabaseFixture() {
    state.actor = { valid: true, id: 'support-admin', impersonating: false }
    state.internalAccess = true
    state.eventRows = []
    state.approvalRows = []
    state.supportDecisionApproval = null
    state.supportOrganization = null
    state.supportUser = null
    state.supportInspectionInvite = undefined
    state.supportInspectionMember = undefined
    state.supportInspectionAuditRows = []
    state.supportInviteReads = 0
    state.duplicateInviteAction = null
    state.inviteActionWrites = 0
    state.acceptedInviteWinsRace = false
    state.supportRecoveryInviteStatus = null
    state.supportRecoveryInviteExpiry = '2026-11-01T00:00:00.000Z'
    state.supportRecoveryInviteUpsert = null
    state.supportRecoveryInviteResult = null
    state.supportRecoveryApprovalWrites = 0
    state.supportMemberRole = 'editor'
    state.supportOwnerCounts = [2]
    state.supportAvailabilityResults = []
    state.supportSessionEvents = []
    state.nextSupportEventId = 100
    state.inviteActionInputs.length = 0
    state.queries.length = 0
    state.recordedEvents.length = 0
}
