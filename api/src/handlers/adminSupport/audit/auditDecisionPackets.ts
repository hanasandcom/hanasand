import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportAuditEventWorkflowProof } from './auditWorkflowProof.ts'
import { supportAuditActionEvidenceRollup } from './auditEvidenceRollups.ts'

export function supportAuditEventDecisionPacket(input: {
    detail: Record<string, any>
    timelineEvent: Record<string, any>
    relatedTimeline: Array<Record<string, any>>
    filters: Record<string, unknown>
}) {
    const workflowProof = supportAuditEventWorkflowProof({
        detail: input.detail,
        timelineEvent: input.timelineEvent,
        filters: input.filters,
    })
    const actionEvidenceRollup = supportAuditActionEvidenceRollup(input.relatedTimeline.length ? input.relatedTimeline : [input.timelineEvent])
    const actionType = text(input.detail.actionType)
    const outcome = text(input.detail.outcome)
    const reason = text(input.detail.reason)
    const requestId = text(input.detail.requestId || input.filters.request)
    const organizationId = text(input.detail.organizationId || input.filters.org)
    const targetId = text(input.detail.targetId || input.filters.target)
    const entityId = text(input.detail.entityId || input.filters.entity)
    const allowed = outcome === 'success'
    const denied = outcome === 'denied' || outcome === 'failed'
    const blockers = uniqueTimelineValues([
        ...workflowProof.blockers,
        ...actionEvidenceRollup.blockers,
        allowed || denied ? '' : 'unknown_action_outcome',
        requestId ? '' : 'missing_request_id',
        reason ? '' : 'missing_reason_on_source_event',
    ])
    return {
        schemaVersion: 'support.audit.event_decision_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        sourceEvent: {
            id: input.timelineEvent.id || input.detail.id || null,
            actionType,
            outcome,
            severity: input.detail.severity || null,
            requestId: requestId || null,
            organizationId: organizationId || null,
            targetId: targetId || null,
            entityId: entityId || null,
            reasonPresent: Boolean(reason),
        },
        decision: {
            allowed,
            denied,
            status: allowed ? 'allowed' : denied ? 'denied' : 'needs_review',
            operatorReviewRequired: denied || blockers.some(blocker => blocker !== 'redaction_required'),
            blockers,
        },
        requiredOperatorInputs: {
            supportRole: true,
            reason: true,
            context: true,
            scope: true,
            durationMinutesFor: ['impersonation'],
            expiresAtFor: ['invite_assistance', 'access_recovery'],
            idempotencyKeyFor: ['invite_assistance', 'invite_action', 'member_role_recovery'],
        },
        availableActions: workflowProof.availableActions,
        actionRequestTemplates: workflowProof.actionRequestTemplates,
        auditReplay: {
            eventDetail: input.timelineEvent.id ? `/api/admin/audit-events/${encodeURIComponent(String(input.timelineEvent.id))}` : null,
            request: requestId ? auditFilterQuery({ request: requestId }) : null,
            actionOutcome: auditFilterQuery({ action: actionType, outcome }),
            entity: entityId ? auditFilterQuery({ entity: entityId }) : null,
            supportWorkflow: auditFilterQuery(input.filters),
            deniedOnly: auditFilterQuery({ ...input.filters, outcome: 'denied' }),
        },
        evidence: {
            relatedEventIds: input.relatedTimeline.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
            actionEvidenceRollup,
            workflowProof,
        },
        copyText: [
            `Support audit decision ${actionType || 'unknown'} outcome=${outcome || 'unknown'}`,
            `Status: ${allowed ? 'allowed' : denied ? 'denied' : 'needs_review'}`,
            `Request: ${requestId || 'none'}`,
            `Reason present: ${Boolean(reason)}`,
            `Actions: ${workflowProof.availableActions.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(input.filters)}`,
        ].join('\n'),
    }
}
