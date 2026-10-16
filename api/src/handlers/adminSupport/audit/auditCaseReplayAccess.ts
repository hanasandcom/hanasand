import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'

export function supportCaseReplayAccessReview(input: {
    replayFilter: Record<string, any>
    supportEvents: Array<Record<string, any>>
    caseTimelineEntries: Array<Record<string, any>>
    eventIds: number[]
    actionTypes: string[]
    outcomes: string[]
    organizationIds: string[]
    actorIds: string[]
    targetIds: string[]
    entityIds: string[]
    requestIds: string[]
    supportSessionIds: string[]
    sourceWorkflows: string[]
    reasons: string[]
    blockerCodes: string[]
}) {
    const inviteEntries = input.caseTimelineEntries.filter(entry => entry.recoveryState?.inviteRecovery)
    const accessRecoveryEntries = input.caseTimelineEntries.filter(entry => entry.recoveryState?.accessRecovery)
    const memberRecoveryEntries = input.caseTimelineEntries.filter(entry => entry.recoveryState?.memberRecovery)
    const impersonationEntries = input.caseTimelineEntries.filter(entry => entry.recoveryState?.impersonation)
    const deniedEntries = input.caseTimelineEntries.filter(entry => entry.outcome === 'denied')
    const allowedEntries = input.caseTimelineEntries.filter(entry => entry.recoveryState?.allowed)
    const missingReasonEventIds = input.caseTimelineEntries
        .filter(entry => entry.operatorNotes?.reasonRequired && !entry.operatorNotes?.reason)
        .map(entry => Number(entry.auditEventId))
        .filter(id => Number.isFinite(id))
    const denialReasonCodes = uniqueTimelineValues(input.caseTimelineEntries.flatMap(entry => entry.recoveryState?.denialReasonCodes || []))
    const supportSessionRequired = Boolean(impersonationEntries.length || accessRecoveryEntries.length || memberRecoveryEntries.length)
    const blockers = uniqueTimelineValues([
        input.supportEvents.length ? '' : 'missing_support_action_events',
        input.caseTimelineEntries.length ? '' : 'missing_case_timeline_entries',
        missingReasonEventIds.length ? 'missing_support_reason' : '',
        supportSessionRequired && !input.supportSessionIds.length ? 'missing_support_session_scope' : '',
        deniedEntries.length ? 'review_denied_support_actions' : '',
        input.organizationIds.length > 1 ? 'multi_org_review_required' : '',
        input.sourceWorkflows.length > 1 ? 'multi_workflow_review_required' : '',
        ...input.blockerCodes,
    ])
    return {
        schemaVersion: 'support.case_replay.access_review.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        target: {
            organizationIds: input.organizationIds,
            actorIds: input.actorIds,
            targetIds: input.targetIds,
            entityIds: input.entityIds,
            requestIds: input.requestIds,
            supportSessionIds: input.supportSessionIds,
            sourceWorkflows: input.sourceWorkflows,
        },
        evidence: {
            auditEventIds: input.eventIds,
            actionTypes: input.actionTypes,
            outcomes: input.outcomes,
            reasonValues: input.reasons,
            missingReasonEventIds,
            denialReasonCodes,
            sourceWorkflows: input.sourceWorkflows,
            allowedActionCount: allowedEntries.length,
            deniedActionCount: deniedEntries.length,
        },
        workflowCounts: {
            inviteRecovery: inviteEntries.length,
            accessRecovery: accessRecoveryEntries.length,
            memberRecovery: memberRecoveryEntries.length,
            impersonation: impersonationEntries.length,
        },
        replayFilters: {
            current: auditFilterQuery(input.replayFilter),
            recovery: auditFilterQuery({ ...input.replayFilter, action: input.replayFilter.action || 'support.organization.access_recovery' }),
            invite: auditFilterQuery({ ...input.replayFilter, action: input.replayFilter.action || 'support.organization.invite' }),
            impersonation: auditFilterQuery({ ...input.replayFilter, action: 'impersonation' }),
            denied: auditFilterQuery({ ...input.replayFilter, outcome: 'denied' }),
            byRequest: input.requestIds.map(request => auditFilterQuery({ request, source: 'admin', service: 'hanasand-api' })),
            bySupportSession: input.supportSessionIds.map(supportSession => auditFilterQuery({ supportSession, source: 'admin', service: 'hanasand-api' })),
            bySourceWorkflow: input.sourceWorkflows.map(workflow => auditFilterQuery({ ...input.replayFilter, workflow, source: 'admin', service: 'hanasand-api' })),
        },
        operatorReview: {
            required: blockers.length > 0,
            deniedActionsPresent: deniedEntries.length > 0,
            missingReasonEventIds,
            denialReasonCodes,
            safeToReplayWithoutMutation: true,
        },
        safety: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noSilentImpersonation: true,
            noCrossOrgLeakage: true,
            scopedSessionRequiredForImpersonation: true,
            reasonRequiredBeforeExecution: true,
            redactionRequired: true,
        },
        forbiddenFields: ['token', 'secret', 'authorization', 'cookie', 'webhookUrl', 'privateSourceUrl', 'sessionToken', 'inviteToken'],
        nextRoutes: {
            supportInspection: auditFilterQuery({
                org: input.replayFilter.org,
                target: input.replayFilter.target,
                request: input.replayFilter.request,
                entity: input.replayFilter.entity,
                supportSession: input.replayFilter.supportSession,
            }).replace('/api/admin/audit-events', '/api/admin/support/inspect'),
            auditReplay: auditFilterQuery(input.replayFilter),
            receiptReplay: '/api/admin/support/receipt-replay',
            readiness: '/api/admin/support/readiness',
        },
        blockers,
        copyText: [
            'Support case replay access review',
            `Events: ${input.eventIds.join(', ') || 'none'}`,
            `Allowed/denied: ${allowedEntries.length}/${deniedEntries.length}`,
            `Recovery/impersonation: ${accessRecoveryEntries.length}/${impersonationEntries.length}`,
            `Source workflows: ${input.sourceWorkflows.join(', ') || 'none'}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
