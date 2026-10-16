import { recordSystemEvent } from '#utils/systemEvent.ts'
import type { AccessRecoveryApprovalRow } from '../supportTypes.ts'
import type { AccessRecoveryDecision, AccessRecoveryDecisionRequest } from './types.ts'

export async function recordAccessRecoveryDecisionAudit(
    req: AccessRecoveryDecisionRequest,
    actorId: string,
    row: AccessRecoveryApprovalRow,
    decision: AccessRecoveryDecision,
    outcome: 'success' | 'denied' | 'failed',
    reason: string,
    extra: Record<string, unknown> = {},
) {
    await recordSystemEvent(req, {
        actionType: `support.organization.access_recovery.${decision === 'approved' ? 'approve' : 'deny'}`,
        actorId,
        targetType: 'invite',
        targetId: row.invite_id,
        organizationId: row.organization_id,
        entityId: row.invite_id,
        requestId: row.request_id,
        severity: outcome === 'success' ? 'warning' : 'notice',
        outcome,
        reason,
        context: {
            schemaVersion: 'support.access_recovery.decision_audit.v1',
            requestId: row.request_id,
            inviteId: row.invite_id,
            inviteStatus: row.invite_status,
            requestedBy: row.requested_by,
            approvalRequired: row.approval_required,
            status: row.status,
            approvedBy: row.approved_by || null,
            approvedAt: row.approved_at || null,
            deniedBy: row.denied_by || null,
            deniedAt: row.denied_at || null,
            outcome,
            ...extra,
        },
    })
}
