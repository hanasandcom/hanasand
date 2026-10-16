import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportAccessRecoveryDecisionCaseReview } from './accessRecoveryDecisionCaseReview.ts'

export function supportAccessRecoveryDecisionReceipt(input: {
    actorId: string
    decision: 'approved' | 'denied'
    approval: Record<string, any>
    reason: string
    supportSessionId: string
    requiredScope: string
    outcome: 'success' | 'denied' | 'failed'
    auditEventIds: number[]
    blockers: string[]
}) {
    const actionType = `support.organization.access_recovery.${input.decision === 'approved' ? 'approve' : 'deny'}`
    const requestId = text(input.approval.requestId)
    const organizationId = text(input.approval.organizationId)
    const inviteId = text(input.approval.inviteId)
    const targetUserId = text(input.approval.targetUserId)
    const targetEmail = text(input.approval.targetEmail || input.approval.invite?.email)
    const targetId = targetUserId || targetEmail || inviteId
    const approvalStatus = text(input.approval.status)
    return {
        schemaVersion: 'support.access_recovery.decision_receipt.v1',
        generatedAt: new Date().toISOString(),
        supportRoleRequired: true,
        approverReasonRequired: true,
        scopeRequired: true,
        supportSessionId: input.supportSessionId || null,
        noSilentMembershipMutation: true,
        mutationMode: input.outcome === 'success' ? 'controlled_invite_status_only' : 'none',
        action: input.decision === 'approved' ? 'access_recovery_approve' : 'access_recovery_deny',
        actionType,
        outcome: input.outcome,
        severity: input.outcome === 'success' ? 'warning' : 'notice',
        actorId: input.actorId,
        organizationId: organizationId || null,
        targetType: targetUserId ? 'user' : 'invite',
        targetId: targetId || null,
        entityId: inviteId || requestId || targetId || null,
        requestId,
        reason: input.reason,
        reasonPresent: Boolean(input.reason),
        requiredScope: input.requiredScope,
        scope: [input.requiredScope],
        expiresAt: input.approval.expiresAt || null,
        approvalStatus,
        approvalRequired: Boolean(input.approval.approvalRequired),
        requestedBy: input.approval.requestedBy || null,
        approvedBy: input.approval.approvedBy || null,
        approvedAt: input.approval.approvedAt || null,
        deniedBy: input.approval.deniedBy || null,
        deniedAt: input.approval.deniedAt || null,
        invite: input.approval.invite ? {
            id: input.approval.invite.id || inviteId || null,
            status: input.approval.invite.status || null,
            role: input.approval.invite.role || null,
            expiresAt: input.approval.invite.expiresAt || input.approval.expiresAt || null,
        } : null,
        auditEventIds: input.auditEventIds,
        replayFilters: {
            current: auditFilterQuery({ request: requestId, action: actionType, source: 'admin', service: 'hanasand-api' }),
            byRequest: auditFilterQuery({ request: requestId, source: 'admin', service: 'hanasand-api' }),
            byEntity: inviteId ? auditFilterQuery({ entity: inviteId, entityType: 'invite', request: requestId }) : null,
            byTarget: targetId ? auditFilterQuery({ target: targetId, action: actionType, request: requestId }) : null,
            byOutcome: auditFilterQuery({ org: organizationId, action: actionType, outcome: input.outcome, request: requestId }),
            bySupportSession: input.supportSessionId ? auditFilterQuery({ supportSession: input.supportSessionId, action: actionType, request: requestId }) : null,
            denied: auditFilterQuery({ org: organizationId, action: 'support.organization.access_recovery.deny', outcome: 'denied', request: requestId }),
        },
        receiptSchemas: [
            'support.access_recovery.decision_receipt.v1',
            'support.access_recovery.approval_decision.v1',
            'support.access_recovery.execution_receipt.v1',
            'support.inspection.approval_decision_packet.v1',
            'support.inspection.receipt_replay_packet.v1',
            'support.access_recovery.decision_case_review.v1',
        ],
        decisionCaseReview: supportAccessRecoveryDecisionCaseReview({
            filters: {
                org: organizationId,
                request: requestId,
                action: actionType,
                outcome: input.outcome,
                source: 'admin',
                service: 'hanasand-api',
            },
            approvals: [input.approval],
            timeline: [],
            decisionReceipt: {
                actionType,
                decision: input.decision,
                outcome: input.outcome,
                actorId: input.actorId,
                targetId,
                organizationId,
                inviteId,
                requestId,
                reason: input.reason,
                supportSessionId: input.supportSessionId,
                auditEventIds: input.auditEventIds,
                blockers: input.blockers,
            },
        }),
        nextRoutes: {
            inspect: requestId ? `/api/admin/support/access-recovery/${encodeURIComponent(requestId)}` : null,
            approve: requestId ? `/api/admin/support/access-recovery/${encodeURIComponent(requestId)}/approve` : null,
            deny: requestId ? `/api/admin/support/access-recovery/${encodeURIComponent(requestId)}/deny` : null,
            organization: organizationId ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}` : null,
            invite: organizationId && inviteId ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(inviteId)}` : null,
            supportSession: input.supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSessionId)}` : null,
            audit: auditFilterQuery({ request: requestId, action: actionType, source: 'admin', service: 'hanasand-api' }),
            details: input.auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
        },
        denialCases: [
            'missing_support_reason',
            'support_role_required',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_scope_denied',
            'approval_not_required',
            'approval_not_pending',
            'self_approval_denied',
            'denied_recovery_approval',
            'missing_decision_audit_events',
        ],
        blockers: uniqueTimelineValues([
            input.reason ? '' : 'missing_support_reason',
            requestId ? '' : 'missing_request_id',
            input.auditEventIds.length ? '' : 'missing_decision_audit_events',
            ...input.blockers,
        ]),
        copyText: [
            `Access recovery decision ${input.decision} request=${requestId || '*'}`,
            `Org: ${organizationId || '*'}`,
            `Target: ${targetId || '*'}`,
            `Outcome: ${input.outcome}`,
            `Approval status: ${approvalStatus || '*'}`,
            `Audit events: ${input.auditEventIds.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery({ request: requestId, action: actionType, source: 'admin', service: 'hanasand-api' })}`,
        ].join('\n'),
    }
}
