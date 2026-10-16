import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'

export function supportInspectionApprovalDecisionPacket(input: {
    approvalDetails: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
    org: string
    user: string
    email: string
    request: string
}) {
    const decisions = input.approvalDetails.map(approval => {
        const requestId = text(approval.requestId)
        const organizationId = text(approval.organizationId || input.org)
        const targetUserId = text(approval.targetUserId || input.user)
        const inviteId = text(approval.inviteId)
        const status = text(approval.status)
        const outcome = text(approval.outcome || (status === 'denied' ? 'denied' : status === 'approved' ? 'success' : 'pending'))
        return {
            requestId,
            status,
            outcome,
            organizationId: organizationId || null,
            targetUserId: targetUserId || null,
            targetEmail: approval.email || input.email || null,
            inviteId: inviteId || null,
            approvalRequired: Boolean(approval.approvalRequired),
            requestedBy: approval.requestedBy || null,
            approvedBy: approval.approvedBy || null,
            approvedAt: approval.approvedAt || null,
            deniedBy: approval.deniedBy || null,
            deniedAt: approval.deniedAt || null,
            auditEventIds: Array.isArray(approval.auditEventIds) ? approval.auditEventIds : [],
            routes: {
                detail: requestId ? `/api/admin/support/access-recovery/${encodeURIComponent(requestId)}` : null,
                approve: requestId ? `/api/admin/support/access-recovery/${encodeURIComponent(requestId)}/approve` : null,
                deny: requestId ? `/api/admin/support/access-recovery/${encodeURIComponent(requestId)}/deny` : null,
            },
            audit: {
                request: requestId ? auditFilterQuery({ request: requestId }) : null,
                outcome: auditFilterQuery({ org: organizationId, request: requestId, outcome }),
                approve: auditFilterQuery({ action: 'support.organization.access_recovery.approve', request: requestId }),
                deny: auditFilterQuery({ action: 'support.organization.access_recovery.deny', request: requestId }),
                deniedReplay: auditFilterQuery({ org: organizationId, request: requestId, outcome: 'denied' }),
            },
        }
    })
    const pending = decisions.filter(decision => decision.status === 'pending')
    const approved = decisions.filter(decision => decision.status === 'approved')
    const denied = decisions.filter(decision => decision.status === 'denied')
    return {
        schemaVersion: 'support.inspection.approval_decision_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        target: {
            organizationId: input.org || null,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
        },
        summary: {
            total: decisions.length,
            pending: pending.length,
            approved: approved.length,
            denied: denied.length,
            approvalRequired: decisions.filter(decision => decision.approvalRequired).length,
        },
        decisions,
        decisionRequirements: {
            supportRole: true,
            approverIdentity: true,
            approverReason: true,
            selfApprovalDenied: true,
            requestScoped: true,
            immutableAuditEvent: true,
            expectedAuditActions: [
                'support.organization.access_recovery.approve',
                'support.organization.access_recovery.deny',
            ],
        },
        replay: {
            current: auditFilterQuery(input.timelineFilter),
            pending: auditFilterQuery({ org: input.org, target: input.user || input.email, action: 'support.organization.access_recovery', outcome: 'success' }),
            approved: auditFilterQuery({ org: input.org, target: input.user || input.email, action: 'support.organization.access_recovery.approve', outcome: 'success' }),
            denied: auditFilterQuery({ org: input.org, target: input.user || input.email, action: 'support.organization.access_recovery.deny', outcome: 'denied' }),
            byRequest: decisions.map(decision => decision.audit.request).filter(Boolean),
        },
        blockers: uniqueTimelineValues([
            decisions.length ? '' : 'missing_access_recovery_approval',
            pending.length ? 'pending_approval_requires_decision' : '',
            denied.length ? 'denied_recovery_approval' : '',
            ...decisions.flatMap(decision => decision.auditEventIds.length ? [] : ['missing_approval_audit_link']),
        ]),
        copyText: [
            `Support approval decisions total=${decisions.length} pending=${pending.length} approved=${approved.length} denied=${denied.length}`,
            `Requests: ${decisions.map(decision => decision.requestId).filter(Boolean).join(', ') || 'none'}`,
            `Denied replay: ${auditFilterQuery({ org: input.org, target: input.user || input.email, action: 'support.organization.access_recovery.deny', outcome: 'denied' })}`,
        ].join('\n'),
    }
}
