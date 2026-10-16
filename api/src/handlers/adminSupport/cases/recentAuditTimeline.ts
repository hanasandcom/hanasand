import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { auditTimelineSummary } from '../audit/auditEntityTimeline.ts'
import { supportAuditFilterContract } from '../audit/auditFilterPackets.ts'
import { supportAuditExportProof, supportAuditCompliancePacket } from '../audit/auditExportPackets.ts'
import { supportAuditWorkflowRollup } from '../audit/auditWorkflowSummary.ts'
import { toSupportAuditTimelineEvent } from '../audit/auditEventProjection.ts'

export function supportRecentAuditTimeline(filters: Record<string, unknown>, rows: Record<string, unknown>[]) {
    const events = rows.map(toSupportAuditTimelineEvent)
    const timeline = events.map(event => ({
        schemaVersion: 'admin.audit.timeline_event.v1',
        id: event.id,
        timestamp: event.createdAt,
        actionType: event.action,
        severity: event.severity,
        outcome: event.outcome,
        actor: event.actor,
        target: event.target,
        organization: {
            id: event.organizationId,
            name: event.organizationName,
        },
        entity: {
            id: event.entityId,
            type: event.entityType,
        },
        requestId: event.requestId,
        reason: event.reason,
        before: event.before,
        after: event.after,
        actionEvidence: event.actionEvidence,
        context: event.context,
        links: event.links,
    }))
    return {
        schemaVersion: 'support.recent_audit_timeline.v1',
        filters,
        eventIds: events.map(event => event.id),
        summary: auditTimelineSummary(timeline),
        filterContract: supportAuditFilterContract(filters, timeline),
        exportProof: supportAuditExportProof(filters, timeline),
        compliancePacket: supportAuditCompliancePacket(filters, timeline),
        workflowRollup: supportAuditWorkflowRollup(filters, timeline),
        events,
        redacted: true,
        links: {
            timeline: auditFilterQuery(filters),
            details: events.map(event => event.links?.detail).filter(Boolean),
        },
        copyText: [
            `Support recent timeline: ${auditFilterQuery(filters)}`,
            `Events: ${events.map(event => event.id).join(', ') || 'none'}`,
            `Outcomes: ${uniqueTimelineValues(events.map(event => event.outcome)).join(', ') || 'none'}`,
        ].join('\n'),
    }
}
