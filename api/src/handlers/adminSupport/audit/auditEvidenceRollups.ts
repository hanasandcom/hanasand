import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportAuditEntityLinkRollup } from './auditEntityTimeline.ts'

export function supportAuditActionEvidenceRollup(timeline: Array<Record<string, any>>) {
    const evidence = timeline
        .map(event => event.actionEvidence)
        .filter(item => item && typeof item === 'object') as Array<Record<string, any>>
    const eventIds = timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const missingEvidenceEventIds = timeline
        .filter(event => !event.actionEvidence)
        .map(event => event.id)
        .filter((id): id is number => Number.isFinite(id))
    const evidenceBlockers = uniqueTimelineValues(evidence.flatMap(item => Array.isArray(item.blockers) ? item.blockers : []))
    const reasonMissingEventIds = evidence
        .filter(item => item.controls?.reasonRequired && !item.reasonPresent)
        .map(item => Number(timeline.find(event => event.actionEvidence === item)?.id))
        .filter((id): id is number => Number.isFinite(id))
    const scopeMissingEventIds = evidence
        .filter(item => item.controls?.scopeRequired && !item.scope)
        .map(item => Number(timeline.find(event => event.actionEvidence === item)?.id))
        .filter((id): id is number => Number.isFinite(id))
    const durationMissingEventIds = evidence
        .filter(item => item.controls?.durationOrExpiryRequired && !item.durationMinutes && !item.expiresAt)
        .map(item => Number(timeline.find(event => event.actionEvidence === item)?.id))
        .filter((id): id is number => Number.isFinite(id))
    const workflows = uniqueTimelineValues(evidence.map(item => item.workflow))
    const actionTypes = uniqueTimelineValues(evidence.map(item => item.actionType))
    const outcomes = uniqueTimelineValues(evidence.map(item => item.outcome))
    const supportSessionIds = uniqueTimelineValues(evidence.map(item => item.supportSessionId))
    const idempotencyKeys = uniqueTimelineValues(evidence.map(item => item.idempotencyKey))

    return {
        schemaVersion: 'support.audit.action_evidence_rollup.v1',
        eventCount: timeline.length,
        evidenceCount: evidence.length,
        eventIds,
        workflows,
        actionTypes,
        outcomes,
        supportSessionIds,
        idempotencyKeys,
        reasonRequiredCount: evidence.filter(item => item.controls?.reasonRequired).length,
        reasonPresentCount: evidence.filter(item => item.reasonPresent).length,
        scopeRequiredCount: evidence.filter(item => item.controls?.scopeRequired).length,
        durationOrExpiryRequiredCount: evidence.filter(item => item.controls?.durationOrExpiryRequired).length,
        missingEvidenceEventIds,
        reasonMissingEventIds,
        scopeMissingEventIds,
        durationMissingEventIds,
        blockerCodes: evidenceBlockers,
        guardrailReplay: {
            schemaVersion: 'support.audit.action_guardrail_replay.v1',
            redacted: true,
            noMutation: true,
            reasonRequiredMissing: reasonMissingEventIds.map(id => `/api/admin/audit-events/${id}`),
            scopeRequiredMissing: scopeMissingEventIds.map(id => `/api/admin/audit-events/${id}`),
            durationRequiredMissing: durationMissingEventIds.map(id => `/api/admin/audit-events/${id}`),
            missingEvidence: missingEvidenceEventIds.map(id => `/api/admin/audit-events/${id}`),
            byWorkflow: workflows.map(workflow => auditFilterQuery({ workflow, source: 'admin', service: 'hanasand-api' })),
            byAction: actionTypes.map(action => auditFilterQuery({ action, source: 'admin', service: 'hanasand-api' })),
            byOutcome: outcomes.map(outcome => auditFilterQuery({ outcome, source: 'admin', service: 'hanasand-api' })),
            bySupportSession: supportSessionIds.map(supportSession => auditFilterQuery({ supportSession, source: 'admin', service: 'hanasand-api' })),
            byIdempotency: idempotencyKeys.map(idempotency => auditFilterQuery({ idempotency, source: 'admin', service: 'hanasand-api' })),
            denied: auditFilterQuery({ outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
            safeHandoff: {
                noLiveAccessGrant: true,
                noSilentMutation: true,
                noSilentImpersonation: true,
                noCrossOrgLeakage: true,
                redactionRequired: true,
            },
        },
        blockers: [
            missingEvidenceEventIds.length ? 'missing_action_evidence' : '',
            reasonMissingEventIds.length ? 'missing_reason_on_source_event' : '',
            scopeMissingEventIds.length ? 'missing_scope_on_source_event' : '',
            durationMissingEventIds.length ? 'missing_duration_or_expiry_on_source_event' : '',
            'redaction_required',
        ].filter(Boolean),
        redacted: true,
        copyText: [
            'Support audit action evidence rollup',
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Evidence: ${evidence.length}/${timeline.length}`,
            `Missing reason: ${reasonMissingEventIds.join(', ') || 'none'}`,
            `Missing scope: ${scopeMissingEventIds.join(', ') || 'none'}`,
            `Missing duration/expiry: ${durationMissingEventIds.join(', ') || 'none'}`,
        ].join('\n'),
    }
}

export function supportAuditRedactedSummary(timeline: Array<Record<string, any>>) {
    return {
        eventCount: timeline.length,
        actions: uniqueTimelineValues(timeline.map(event => event.actionType)),
        outcomes: uniqueTimelineValues(timeline.map(event => event.outcome)),
        severities: uniqueTimelineValues(timeline.map(event => event.severity)),
        actorIds: uniqueTimelineValues(timeline.map(event => event.actor?.id)),
        targetIds: uniqueTimelineValues(timeline.map(event => event.target?.id)),
        entityIds: uniqueTimelineValues(timeline.map(event => event.entity?.id)),
        requestIds: uniqueTimelineValues(timeline.map(event => event.requestId)),
        reasonsPresent: timeline.filter(event => Boolean(event.reason)).length,
        actionEvidenceRollup: supportAuditActionEvidenceRollup(timeline),
        entityLinks: supportAuditEntityLinkRollup(timeline),
        contextsRedacted: true,
    }
}

export function supportAuditWorkflowNextActions(blockers: string[], filters: Record<string, unknown>) {
    const actions = []
    if (blockers.includes('missing_audit_events')) {
        actions.push({
            ownerLane: 'support',
            action: 'inspect_support_filters',
            blockerCode: 'missing_audit_events',
            route: '/api/admin/support/inspect',
        })
    }
    if (blockers.includes('missing_action_evidence')) {
        actions.push({
            ownerLane: 'support',
            action: 'open_audit_timeline',
            blockerCode: 'missing_action_evidence',
            route: auditFilterQuery(filters),
        })
    }
    if (blockers.includes('missing_reason_on_source_event')) {
        actions.push({
            ownerLane: 'support',
            action: 'review_operator_rationale',
            blockerCode: 'missing_reason_on_source_event',
            route: auditFilterQuery({ ...filters, reason: '' }),
        })
    }
    if (blockers.includes('missing_scope_on_source_event') || blockers.includes('missing_duration_or_expiry_on_source_event')) {
        actions.push({
            ownerLane: 'support',
            action: 'review_scoped_session',
            blockerCode: blockers.includes('missing_scope_on_source_event') ? 'missing_scope_on_source_event' : 'missing_duration_or_expiry_on_source_event',
            route: auditFilterQuery(filters),
        })
    }
    return actions
}
