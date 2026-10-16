import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import { auditTimelineSummary } from '../audit/auditEntityTimeline.ts'
import { supportAuditFilterContract } from '../audit/auditFilterPackets.ts'
import { supportAuditExportProof } from '../audit/auditExportPackets.ts'
import { supportAuditWorkflowRollup } from '../audit/auditWorkflowSummary.ts'
import { supportAccessRecoveryDecisionCaseReview } from './accessRecoveryDecisionCaseReview.ts'

export function supportAccessRecoveryApprovalTimeline(filters: Record<string, unknown>, approvals: Array<Record<string, any>>) {
    const auditFilters = accessRecoveryApprovalAuditFilters(filters)
    const timeline = approvals.map((approval) => {
        const actionType = approval.status === 'denied'
            ? 'support.organization.access_recovery.deny'
            : approval.status === 'approved'
                ? 'support.organization.access_recovery.approve'
                : 'support.organization.access_recovery.request'
        const auditEventIds = Array.isArray(approval.auditEventIds) ? approval.auditEventIds : []
        return {
            schemaVersion: 'admin.audit.timeline_event.v1',
            id: Number(auditEventIds[0] || 0),
            timestamp: approval.updatedAt || approval.createdAt,
            actionType,
            severity: approval.approvalRequired ? 'warning' : 'notice',
            outcome: approval.outcome || (approval.status === 'denied' ? 'denied' : 'success'),
            source: 'admin',
            service: 'hanasand-api',
            actor: {
                id: approval.approvedBy || approval.deniedBy || approval.requestedBy,
                name: null,
            },
            target: {
                type: 'invite',
                id: approval.inviteId,
                name: approval.invite?.email || null,
            },
            organization: {
                id: approval.organizationId,
                name: approval.organizationName || null,
            },
            entity: {
                id: approval.requestId,
                type: 'access_recovery_request',
            },
            requestId: approval.requestId,
            reason: approval.decisionReason || approval.requestedReason || '',
            scope: {
                approvalRequired: approval.approvalRequired,
                status: approval.status,
                expiresAt: approval.expiresAt,
            },
            before: null,
            after: {
                status: approval.status,
                outcome: approval.outcome,
                inviteStatus: approval.invite?.status || null,
            },
            context: {
                schemaVersion: 'support.access_recovery.approval_timeline.v1',
                requestId: approval.requestId,
                inviteId: approval.inviteId,
                targetUserId: approval.targetUserId || null,
                auditEventIds,
                redactionRequired: true,
            },
            links: {
                detail: auditEventIds[0] ? `/api/admin/audit-events/${encodeURIComponent(String(auditEventIds[0]))}` : null,
                request: `/api/admin/audit-events?request=${encodeURIComponent(String(approval.requestId))}&source=system&service=hanasand-api`,
                entity: `/api/admin/audit-events?entity=${encodeURIComponent(String(approval.requestId))}&source=system&service=hanasand-api`,
            },
        }
    })
    return {
        schemaVersion: 'support.access_recovery.approval_timeline.v1',
        filters,
        auditFilters,
        eventIds: timeline.map(event => event.id).filter(id => Number.isFinite(id) && id > 0),
        summary: auditTimelineSummary(timeline),
        filterContract: supportAuditFilterContract(auditFilters, timeline),
        exportProof: supportAuditExportProof(auditFilters, timeline),
        workflowRollup: supportAuditWorkflowRollup(auditFilters, timeline),
        decisionCaseReview: supportAccessRecoveryDecisionCaseReview({
            filters: auditFilters,
            approvals,
            timeline,
        }),
        events: timeline,
        redacted: true,
        links: {
            timeline: auditFilterQuery(auditFilters),
            details: timeline.map(event => event.links.detail).filter(Boolean),
        },
        copyText: [
            `Access recovery approval timeline: ${auditFilterQuery(auditFilters)}`,
            `Requests: ${approvals.map(approval => approval.requestId).filter(Boolean).join(', ') || 'none'}`,
            `Audit events: ${timeline.flatMap(event => event.context.auditEventIds || []).join(', ') || 'none'}`,
        ].join('\n'),
    }
}


export function accessRecoveryApprovalAuditFilters(filters: Record<string, unknown>) {
    return {
        org: filters.org || '',
        request: filters.request || '',
        action: 'support.organization.access_recovery',
        outcome: filters.outcome || '',
        source: 'admin',
        service: 'hanasand-api',
        from: filters.from || '',
        to: filters.to || '',
        limit: filters.limit || '',
    }
}
