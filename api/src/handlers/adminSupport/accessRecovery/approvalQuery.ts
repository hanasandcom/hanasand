export function supportAccessRecoveryApprovalSelect(includeAuditEvents = false) {
    return `
        SELECT
            approval.*,
            invite.email,
            invite.role,
            invite.status AS invite_status,
            organization.name AS organization_name${includeAuditEvents ? `,
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', event.id,
                    'actionType', event.event_type,
                    'outcome', event.outcome,
                    'severity', event.severity,
                    'createdAt', event.created_at
                ) ORDER BY event.created_at ASC)
                FROM system_events event
                WHERE event.request_id = approval.request_id
                  AND event.event_type ILIKE 'support.organization.access_recovery%'
            ), '[]'::jsonb) AS audit_events` : ''}
        FROM admin_access_recovery_approvals approval
        JOIN organization_invites invite ON invite.id = approval.invite_id
        LEFT JOIN organizations organization ON organization.id = approval.organization_id
    `
}
