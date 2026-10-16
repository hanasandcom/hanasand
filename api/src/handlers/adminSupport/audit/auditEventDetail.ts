import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import { supportAuditFilterContract } from './auditFilterPackets.ts'
import { supportAuditExportProof, supportAuditCompliancePacket } from './auditExportPackets.ts'
import { supportAuditBridgeAdapterContract } from './auditBridgePackets.ts'
import { supportAuditEventWorkflowProof } from './auditWorkflowProof.ts'
import { supportAuditEventDecisionPacket } from './auditDecisionPackets.ts'
import { supportAuditEventIntegrationFixture, supportAuditTimelineReplayContract } from './auditReplayContracts.ts'
import { supportAuditCaseReplayExport } from './auditCaseReplayExport.ts'
import { supportAuditSupportWorkflowPacket, supportAuditWorkflowRollup } from './auditWorkflowSummary.ts'
import { auditTimelineSummary } from './auditEntityTimeline.ts'

export function supportAuditEventDetailResponse(event: Record<string, any>, relatedTimeline: Array<Record<string, any>> = [], supportSessionId = '') {
    const detail = event.detail || {}
    const timelineEvent = detail.timelineEvent || {}
    const filters = {
        org: detail.organizationId || '',
        actor: detail.actorId || '',
        target: detail.targetId || '',
        action: detail.actionType || '',
        severity: detail.severity || '',
        entity: detail.entityId || '',
        request: detail.requestId || '',
        outcome: detail.outcome || '',
        supportSession: supportSessionId,
        source: detail.source || '',
        service: detail.service || '',
    }
    return {
        schemaVersion: 'admin.audit.event_detail.v1',
        generatedAt: new Date().toISOString(),
        event: detail,
        timelineEvent,
        redacted: true,
        filterContract: supportAuditFilterContract(filters, [timelineEvent]),
        exportProof: supportAuditExportProof(filters, [timelineEvent]),
        compliancePacket: supportAuditCompliancePacket(filters, [timelineEvent]),
        bridgeAdapter: supportAuditBridgeAdapterContract(filters),
        workflowProof: supportAuditEventWorkflowProof({ detail, timelineEvent, filters }),
        decisionPacket: supportAuditEventDecisionPacket({ detail, timelineEvent, relatedTimeline, filters }),
        integrationFixture: supportAuditEventIntegrationFixture({ detail, timelineEvent, relatedTimeline, filters }),
        timelineReplayContract: supportAuditTimelineReplayContract(filters, relatedTimeline.length ? relatedTimeline : [timelineEvent]),
        caseReplayExport: supportAuditCaseReplayExport(filters, relatedTimeline.length ? relatedTimeline : [timelineEvent]),
        supportWorkflowPacket: supportAuditSupportWorkflowPacket(filters, relatedTimeline.length ? relatedTimeline : [timelineEvent]),
        workflowRollup: supportAuditWorkflowRollup(filters, relatedTimeline.length ? relatedTimeline : [timelineEvent]),
        relatedTimeline: {
            schemaVersion: 'admin.audit.event_related_timeline.v1',
            filters,
            eventIds: relatedTimeline.map(item => item.id),
            summary: auditTimelineSummary(relatedTimeline),
            filterContract: supportAuditFilterContract(filters, relatedTimeline),
            exportProof: supportAuditExportProof(filters, relatedTimeline),
            compliancePacket: supportAuditCompliancePacket(filters, relatedTimeline),
            timelineReplayContract: supportAuditTimelineReplayContract(filters, relatedTimeline),
            caseReplayExport: supportAuditCaseReplayExport(filters, relatedTimeline),
            supportWorkflowPacket: supportAuditSupportWorkflowPacket(filters, relatedTimeline),
            workflowRollup: supportAuditWorkflowRollup(filters, relatedTimeline),
            timeline: relatedTimeline,
            redacted: true,
            links: {
                timeline: auditFilterQuery(filters),
                details: relatedTimeline.map(item => item.links?.detail).filter(Boolean),
            },
            copyText: relatedTimeline
                .map(item => `${item.timestamp} ${item.severity}/${item.outcome} ${item.actionType} actor=${item.actor?.id || ''} entity=${item.entity?.id || ''} request=${item.requestId || ''}`)
                .join('\n'),
        },
        links: {
            self: `/api/admin/audit-events/${encodeURIComponent(String(event.id))}`,
            timeline: auditFilterQuery(filters),
            request: detail.requestId ? `/api/admin/audit-events?request=${encodeURIComponent(String(detail.requestId))}` : null,
            entity: detail.entityId ? `/api/admin/audit-events?entity=${encodeURIComponent(String(detail.entityId))}` : null,
            supportSession: supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(supportSessionId)}` : null,
        },
        copyText: [
            detail.copyText,
            `Detail: /api/admin/audit-events/${event.id}`,
            `Timeline: ${auditFilterQuery(filters)}`,
            'Workflow proof: support.audit.event_workflow_proof.v1',
        ].filter(Boolean).join('\n'),
    }
}
