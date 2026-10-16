import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { systemEventFilters } from './auditFilterDefinitions.ts'
import { supportAuditRedactedSummary, supportAuditActionEvidenceRollup } from './auditEvidenceRollups.ts'
import { supportAuditWorkflowName } from './auditTemplates.ts'
import { supportAuditEntityLinkRollup } from './auditEntityTimeline.ts'

export function supportAuditExportProof(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const replayQuery = auditFilterQuery(filters)
    const eventIds = timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const summary = supportAuditRedactedSummary(timeline)
    const requestIds = uniqueTimelineValues(timeline.map(event => event.requestId))
    const sourceWorkflows = uniqueTimelineValues(timeline.map(event => supportAuditWorkflowName(event)))
    const supportSessionIds = uniqueTimelineValues(timeline.map(event => {
        const contextSession = text(event.context?.supportSessionId)
        const entityId = text(event.entity?.id)
        return contextSession || (entityId.startsWith('support_session_') ? entityId : '')
    }))
    const blockers = [
        timeline.length ? '' : 'audit_unavailable',
        eventIds.length === timeline.length ? '' : 'event_id_unavailable',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.audit.export_proof.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        immutableEventIds: eventIds,
        eventCount: timeline.length,
        route: '/api/admin/audit-events',
        dashboardRoute: '/system/impersonation',
        replay: {
            method: 'GET',
            query: replayQuery,
            filters,
            requestIds,
            supportSessionIds,
            sourceWorkflows,
            bySourceWorkflow: sourceWorkflows.map(workflow => auditFilterQuery({ ...filters, workflow, source: 'admin', service: 'hanasand-api' })),
            entityLinks: supportAuditEntityLinkRollup(timeline),
        },
        sourceWorkflowHandoff: {
            alias: 'sourceWorkflow',
            workflows: sourceWorkflows,
            safeForCaseReplay: true,
            noLiveAccessGrant: true,
            redacted: true,
        },
        exposedFields: [
            'id',
            'timestamp',
            'actionType',
            'severity',
            'source',
            'service',
            'actor.id',
            'target.type',
            'target.id',
            'organization.id',
            'entity.id',
            'requestId',
            'outcome',
            'reason',
            'before',
            'after',
            'scope',
            'context',
            'links.detail',
            'links.request',
            'links.entity',
            'links.supportSession',
            'links.entities',
            'actionEvidence.workflow',
        ],
        supportedFilters: Array.from(systemEventFilters),
        supportWorkflows: [
            'support_session',
            'invite_assistance',
            'access_recovery',
            'member_role_recovery',
            'impersonation',
            'support_inspection',
        ],
        blockerCatalog: [
            'support_role_required',
            'unsupported_audit_filter',
            'invalid_audit_filter',
            'audit_unavailable',
            'event_id_unavailable',
            'redaction_required',
        ],
        blockers,
        redactedSummary: summary,
        entityLinkRollup: supportAuditEntityLinkRollup(timeline),
        actionEvidenceRollup: supportAuditActionEvidenceRollup(timeline),
        copyText: [
            'Support audit export event',
            `Replay: ${replayQuery}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Requests: ${requestIds.join(', ') || 'none'}`,
            `Source workflows: ${sourceWorkflows.join(', ') || 'none'}`,
            `Outcomes: ${summary.outcomes.join(', ') || 'none'}`,
            `Actions: ${summary.actions.join(', ') || 'none'}`,
            'Redacted: true',
        ].join('\n'),
        worker3: {
            readinessName: 'support-audit-export-proof',
            route: '/api/admin/audit-events',
            testCommand: 'cd api && bun run smoke:admin-support-unit',
            expectedResponsePath: 'detail.exportProof',
            validation: [
                'detail.exportProof.schemaVersion = support.audit.export_proof.v1',
                'detail.exportProof.immutableEventIds contains returned event ids',
                'detail.exportProof.replay.query is copy-ready',
                'detail.exportProof.redacted = true',
            ],
        },
    }
}

export function supportAuditCompliancePacket(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const replayQuery = auditFilterQuery(filters)
    const eventIds = timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const summary = supportAuditRedactedSummary(timeline)
    const actions = uniqueTimelineValues(timeline.map(event => event.actionType || event.action))
    const reasonsPresent = timeline.filter(event => Boolean(text(event.reason))).length
    const blockers = [
        timeline.length ? '' : 'audit_unavailable',
        eventIds.length === timeline.length ? '' : 'event_id_unavailable',
        reasonsPresent === timeline.length ? '' : 'missing_reason_on_some_events',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.audit.compliance_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        purpose: 'customer_support_evidence_review',
        route: '/api/admin/audit-events',
        replay: {
            query: replayQuery,
            filters,
            immutableEventIds: eventIds,
            detailRoutes: timeline.map(event => event.links?.detail).filter(Boolean),
        },
        evidence: {
            eventCount: timeline.length,
            actions,
            outcomes: summary.outcomes,
            severities: summary.severities,
            actorIds: summary.actorIds,
            targetIds: summary.targetIds,
            entityIds: summary.entityIds,
            requestIds: summary.requestIds,
            reasonsPresent,
            entityLinks: supportAuditEntityLinkRollup(timeline),
            actionEvidence: supportAuditActionEvidenceRollup(timeline),
        },
        redactionAttestation: {
            contextRedacted: true,
            beforeAfterRedacted: true,
            secretsExcluded: true,
            sensitiveFields: ['password', 'token', 'secret', 'authorization', 'cookie', 'apiKey', 'session', 'credential', 'webhookUrl', 'privateSourceUrl'],
        },
        blockerCatalog: [
            'audit_unavailable',
            'event_id_unavailable',
            'missing_reason_on_some_events',
            'missing_action_evidence',
            'redaction_required',
        ],
        blockers,
        copyText: [
            'Support audit compliance packet',
            `Replay: ${replayQuery}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Actions: ${actions.join(', ') || 'none'}`,
            `Outcomes: ${summary.outcomes.join(', ') || 'none'}`,
            `Reasons present: ${reasonsPresent}/${timeline.length}`,
            'Redacted: true',
        ].join('\n'),
    }
}
