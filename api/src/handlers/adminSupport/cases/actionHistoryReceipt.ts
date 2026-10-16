import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportAuditFilterContract } from '../audit/auditFilterPackets.ts'
import { supportAuditExportProof } from '../audit/auditExportPackets.ts'
import { supportAuditSupportWorkflowPacket } from '../audit/auditWorkflowSummary.ts'

export function supportOrgUserActionHistoryReceipt(input: {
    kind: 'organization' | 'user'
    actorId: string
    targetId: string
    organizationIds: string[]
    requestId: string
    reason: string
    supportContext: string
    supportSession: string
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    supportActivityRollup: Record<string, any>
    inspectionReceipt: Record<string, any>
    nextRoutes: Record<string, string | null>
}) {
    const targetType = input.kind === 'organization' ? 'organization' : 'user'
    const organizationId = input.kind === 'organization'
        ? input.targetId
        : input.organizationIds[0] || ''
    const actionValues = uniqueTimelineValues(input.timeline.map(event => event.action || event.actionType))
    const outcomeValues = uniqueTimelineValues(input.timeline.map(event => event.outcome))
    const severityValues = uniqueTimelineValues(input.timeline.map(event => event.severity))
    const eventIds = input.timeline.map(event => Number(event.id)).filter(id => Number.isFinite(id))
    const entityIds = uniqueTimelineValues([
        input.targetId,
        ...input.timeline.map(event => event.entity?.id || event.entityId),
    ])
    const requestIds = uniqueTimelineValues([
        input.requestId,
        ...input.timeline.map(event => event.requestId),
    ])
    const actorIds = uniqueTimelineValues([
        input.actorId,
        ...input.timeline.map(event => event.actor?.id || event.actorId),
    ])
    const blockerCodes = uniqueTimelineValues([
        ...(Array.isArray(input.supportActivityRollup.blockerCodes) ? input.supportActivityRollup.blockerCodes : []),
        ...input.timeline.flatMap(event => [
            event.actionEvidence?.blockers,
            event.context?.blockerCode,
            event.context?.blocker,
        ].flat()),
    ])
    const actionOutcomeFilters = actionValues.flatMap(action => [
        auditFilterQuery({ ...input.timelineFilter, action, outcome: 'success' }),
        auditFilterQuery({ ...input.timelineFilter, action, outcome: 'denied' }),
        auditFilterQuery({ ...input.timelineFilter, action, outcome: 'failed' }),
    ])
    return {
        schemaVersion: `support.${input.kind}.action_history_receipt.v1`,
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        reasonRecommended: true,
        contextRecommended: true,
        targetType,
        targetId: input.targetId,
        organizationId: organizationId || null,
        organizationIds: input.organizationIds,
        entityId: input.targetId,
        requestId: input.requestId,
        actorId: input.actorId,
        actorIds,
        reason: input.reason || null,
        reasonPresent: Boolean(input.reason),
        supportContextPresent: Boolean(input.supportContext),
        supportSessionId: input.supportSession || null,
        scope: input.kind === 'organization' ? ['read_org', 'audit:read'] : ['read_profile', 'read_org', 'audit:read'],
        outcome: eventIds.length ? 'success' : 'failed',
        severity: eventIds.length ? 'info' : 'notice',
        eventCount: eventIds.length,
        auditEventIds: eventIds,
        actions: actionValues,
        outcomes: outcomeValues,
        severities: severityValues,
        entityIds,
        requestIds,
        blockerCodes,
        replayFilters: {
            current: auditFilterQuery(input.timelineFilter),
            byAction: actionValues.map(action => ({ action, route: auditFilterQuery({ ...input.timelineFilter, action }) })),
            byActionOutcome: actionOutcomeFilters,
            byOutcome: {
                success: auditFilterQuery({ ...input.timelineFilter, outcome: 'success' }),
                denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
                failed: auditFilterQuery({ ...input.timelineFilter, outcome: 'failed' }),
            },
            byEntity: entityIds.map(entity => auditFilterQuery({ entity, target: input.targetId, entityType: targetType })),
            byRequest: requestIds.map(request => auditFilterQuery({ ...input.timelineFilter, request })),
            bySupportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, target: input.targetId }) : null,
        },
        audit: {
            replay: auditFilterQuery(input.timelineFilter),
            details: eventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            filterContract: supportAuditFilterContract(input.timelineFilter, input.timeline),
            workflowPacket: supportAuditSupportWorkflowPacket(input.timelineFilter, input.timeline),
            exportProof: supportAuditExportProof(input.timelineFilter, input.timeline),
        },
        receipts: {
            inspection: input.inspectionReceipt.schemaVersion || null,
            replay: 'support.inspection.receipt_replay_packet.v1',
            history: `support.${input.kind}.action_history_receipt.v1`,
        },
        receiptSchemas: [
            `support.${input.kind}.action_history_receipt.v1`,
            `support.${input.kind}.inspection_receipt.v1`,
            'support.inspection.receipt_replay_packet.v1',
            'support.audit.support_workflow_packet.v1',
            'support.audit.filter_contract.v1',
        ],
        nextRoutes: {
            ...input.nextRoutes,
            receiptReplay: auditFilterQuery(input.timelineFilter),
            auditDetails: eventIds.length ? '/api/admin/audit-events/:id' : null,
            supportSession: input.supportSession ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSession)}` : null,
        },
        denialCases: [
            'support_role_required',
            'support_auth_required',
            'support_session_expired',
            'support_session_revoked',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'missing_operator_reason',
            'missing_action_history_events',
            'audit_unavailable',
            'redaction_required',
        ],
        blockers: uniqueTimelineValues([
            eventIds.length ? '' : 'missing_action_history_events',
            input.reason ? '' : 'missing_operator_reason',
            input.supportActivityRollup.schemaVersion ? '' : 'missing_support_activity_rollup',
            ...blockerCodes,
        ]),
        copyText: [
            `Support ${input.kind} action history ${input.targetId}`,
            `Request: ${input.requestId}`,
            `Actions: ${actionValues.join(', ') || 'none'}`,
            `Outcomes: ${outcomeValues.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(input.timelineFilter)}`,
        ].join('\n'),
    }
}
