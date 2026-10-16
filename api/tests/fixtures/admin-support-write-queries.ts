import { hasSqlFragments, state } from './admin-support-routes-state.ts'

export async function runSupportWriteQueries(sql: string, normalizedSql: string, values: unknown[]) {
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
    return undefined
}
