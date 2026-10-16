import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportAuditWorkflowName } from './auditTemplates.ts'
import { supportCaseTimelineEntries } from './auditCaseTimeline.ts'
import { supportCaseReplayAccessReview } from './auditCaseReplayAccess.ts'

export function supportAuditCaseReplayExport(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const events = timeline.filter(Boolean)
    const supportEvents = events.filter(event => {
        const actionType = text(event.actionType || event.action)
        return actionType.startsWith('support.')
            || actionType.startsWith('impersonation.')
            || /invite|access_recovery|member_role_recovery|recovery/.test(actionType)
    })
    const eventIds = supportEvents.map(event => Number(event.id)).filter(id => Number.isFinite(id))
    const actionTypes = uniqueTimelineValues(supportEvents.map(event => event.actionType || event.action))
    const outcomes = uniqueTimelineValues(supportEvents.map(event => event.outcome))
    const severities = uniqueTimelineValues(supportEvents.map(event => event.severity))
    const organizationIds = uniqueTimelineValues(supportEvents.map(event => event.organization?.id || event.organizationId || filters.org))
    const actorIds = uniqueTimelineValues(supportEvents.map(event => event.actor?.id || event.actorId || filters.actor))
    const targetIds = uniqueTimelineValues(supportEvents.map(event => event.target?.id || event.targetId || filters.target))
    const entityIds = uniqueTimelineValues(supportEvents.map(event => event.entity?.id || event.entityId || filters.entity))
    const requestIds = uniqueTimelineValues(supportEvents.map(event => event.requestId || filters.request))
    const supportSessionIds = uniqueTimelineValues(supportEvents.map(event => event.actionEvidence?.supportSessionId || event.context?.supportSessionId || filters.supportSession))
    const sourceWorkflows = uniqueTimelineValues(supportEvents.map(event => supportAuditWorkflowName(event)))
    const reasons = uniqueTimelineValues(supportEvents.map(event => event.reason || event.actionEvidence?.reason || filters.reason))
    const blockerCodes = uniqueTimelineValues(supportEvents.flatMap(event => [
        event.actionEvidence?.blockerCode,
        event.actionEvidence?.blockers,
        event.context?.blockerCode,
        event.context?.blocker,
    ].flat()))
    const caseTimelineEntries = supportCaseTimelineEntries(supportEvents)
    const replayFilter = {
        org: text(filters.org || organizationIds[0]),
        actor: text(filters.actor || actorIds[0]),
        target: text(filters.target || targetIds[0]),
        action: text(filters.action || actionTypes[0]),
        severity: text(filters.severity || severities[0]),
        entity: text(filters.entity || entityIds[0]),
        request: text(filters.request || requestIds[0]),
        outcome: text(filters.outcome || outcomes[0]),
        supportSession: text(filters.supportSession || supportSessionIds[0]),
        workflow: text(filters.workflow || sourceWorkflows[0]),
        reason: text(filters.reason || reasons[0]),
        source: text(filters.source) || 'system',
        service: text(filters.service) || 'hanasand-api',
    }
    const replayQuery = auditFilterQuery(replayFilter)
    const accessReview = supportCaseReplayAccessReview({
        replayFilter,
        supportEvents,
        caseTimelineEntries,
        eventIds,
        actionTypes,
        outcomes,
        organizationIds,
        actorIds,
        targetIds,
        entityIds,
        requestIds,
        supportSessionIds,
        sourceWorkflows,
        reasons,
        blockerCodes,
    })
    return {
        schemaVersion: 'support.audit.case_replay_export.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        source: {
            route: '/api/admin/audit-events',
            detailRouteTemplate: '/api/admin/audit-events/:id',
            filters,
        },
        caseReplay: {
            expectedConsumer: 'case.replay',
            route: '/api/admin/support/receipt-replay',
            timelineEntries: caseTimelineEntries,
            accessReview,
            replay: {
                current: replayQuery,
                byRequest: requestIds.map(request => auditFilterQuery({ request, source: 'admin', service: 'hanasand-api' })),
                byOrganization: organizationIds.map(org => auditFilterQuery({ org, source: 'admin', service: 'hanasand-api' })),
                byTarget: targetIds.map(target => auditFilterQuery({ target, source: 'admin', service: 'hanasand-api' })),
                byEntity: entityIds.map(entity => auditFilterQuery({ entity, source: 'admin', service: 'hanasand-api' })),
                bySupportSession: supportSessionIds.map(supportSession => auditFilterQuery({ supportSession, source: 'admin', service: 'hanasand-api' })),
                bySourceWorkflow: sourceWorkflows.map(workflow => auditFilterQuery({ ...replayFilter, workflow, source: 'admin', service: 'hanasand-api' })),
                denied: auditFilterQuery({ ...replayFilter, outcome: 'denied' }),
            },
            sourceWorkflowHandoff: {
                alias: 'sourceWorkflow',
                workflows: sourceWorkflows,
                safeForCaseReplay: true,
                noLiveAccessGrant: true,
                redacted: true,
            },
        },
        supportActionEvidence: {
            eventIds,
            caseTimelineEntryCount: caseTimelineEntries.length,
            actionTypes,
            outcomes,
            severities,
            organizationIds,
            actorIds,
            targetIds,
            entityIds,
            requestIds,
            supportSessionIds,
            sourceWorkflows,
            reasonsPresent: reasons.length > 0,
            reasonValues: reasons,
            blockerCodes,
        },
        requiredAuditFields: [
            'actor.id',
            'target.id',
            'organization.id',
            'entity.id',
            'actionType',
            'severity',
            'outcome',
            'requestId',
            'reason',
            'timestamp',
            'actionEvidence.supportSessionId',
            'actionEvidence.workflow',
            'caseReplay.timelineEntries.operatorNotes.reason',
            'caseReplay.timelineEntries.recoveryState.denialReasonCodes',
        ],
        nextRoutes: {
            supportInspection: auditFilterQuery({
                org: replayFilter.org,
                target: replayFilter.target,
                request: replayFilter.request,
                entity: replayFilter.entity,
                supportSession: replayFilter.supportSession,
                workflow: replayFilter.workflow,
            }).replace('/api/admin/audit-events', '/api/admin/support/inspect'),
            auditReplay: replayQuery,
            auditDetails: eventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            supportReadiness: '/api/admin/support/readiness',
            receiptReplay: '/api/admin/support/receipt-replay',
        },
        safeHandoff: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noSilentImpersonation: true,
            noCrossOrgLeakage: true,
            reasonRequiredBeforeExecution: true,
            scopedSessionRequiredForImpersonation: true,
            redactionRequired: true,
        },
        readinessConsumers: ['dashboard', 'integration', 'case.replay'],
        denialStates: [
            'support_role_required',
            'missing_support_reason',
            'wrong_org_scope',
            'support_session_expired',
            'support_session_revoked',
            'support_session_scope_denied',
            'denied_recovery_approval',
            'duplicate_invite_or_idempotency_key',
            'audit_unavailable',
            'redaction_required',
        ],
        blockers: [
            supportEvents.length ? '' : 'missing_support_action_events',
            caseTimelineEntries.length ? '' : 'missing_case_timeline_entries',
            replayQuery.includes('?') ? '' : 'missing_replay_filter',
            reasons.length ? '' : 'missing_support_reason',
        ].filter(Boolean),
        copyText: [
            'Support audit case replay export',
            `Replay: ${replayQuery}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Actions: ${actionTypes.join(', ') || 'none'}`,
            `Blockers: ${blockerCodes.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
