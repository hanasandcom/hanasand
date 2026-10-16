import type { AccessRecoveryApprovalRow } from '../supportTypes.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'

export function normalizeAuditEventList(value: unknown) {
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const event = item as Record<string, unknown>
        const id = Number(event.id)
        return [{
            id: Number.isFinite(id) ? id : 0,
            actionType: text(event.actionType),
            outcome: text(event.outcome),
            severity: text(event.severity),
            createdAt: text(event.createdAt),
        }]
    })
}

export function toAccessRecoveryDecision(row: AccessRecoveryApprovalRow) {
    const displayStatus = row.status === 'pending' ? 'pending_approval' : row.status
    const auditEvents = normalizeAuditEventList(row.audit_events)
    return {
        schemaVersion: 'support.access_recovery.approval_decision.v1',
        requestId: row.request_id,
        organizationId: row.organization_id,
        organizationName: row.organization_name || '',
        inviteId: row.invite_id,
        targetUserId: row.target_user_id || null,
        requestedBy: row.requested_by,
        requestedReason: row.requested_reason,
        requestContext: row.request_context,
        approvalRequired: row.approval_required,
        status: displayStatus,
        approvedBy: row.approved_by || null,
        approvedAt: row.approved_at || null,
        deniedBy: row.denied_by || null,
        deniedAt: row.denied_at || null,
        decisionReason: row.decision_reason || null,
        outcome: row.outcome,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        auditEventIds: auditEvents.map(event => event.id),
        auditEvents,
        invite: {
            id: row.invite_id,
            email: row.email || '',
            role: row.role || '',
            status: row.invite_status || '',
            expiresAt: row.expires_at,
        },
        audit: {
            actionType: row.status === 'denied'
                ? 'support.organization.access_recovery.deny'
                : 'support.organization.access_recovery.approve',
            source: 'admin',
            service: 'hanasand-api',
            outcome: row.outcome,
            eventIds: auditEvents.map(event => event.id),
            query: `/api/admin/audit-events?request=${encodeURIComponent(row.request_id)}&source=system&service=hanasand-api`,
        },
        copyText: [
            `Access recovery ${displayStatus} for ${row.email || row.invite_id}`,
            `Org: ${row.organization_name || row.organization_id} (${row.organization_id})`,
            `Invite: ${row.invite_id} (${row.invite_status || 'unknown'})`,
            `Request: ${row.request_id}`,
            `Requested by: ${row.requested_by}`,
            auditEvents.length ? `Audit events: ${auditEvents.map(event => `${event.id}:${event.actionType}/${event.outcome}`).join(', ')}` : '',
            row.approved_by ? `Approved by: ${row.approved_by} at ${row.approved_at}` : '',
            row.denied_by ? `Denied by: ${row.denied_by} at ${row.denied_at}` : '',
            row.decision_reason ? `Decision reason: ${row.decision_reason}` : '',
        ].filter(Boolean).join('\n'),
    }
}
