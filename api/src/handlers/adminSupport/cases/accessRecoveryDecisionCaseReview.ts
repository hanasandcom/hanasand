import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportCaseTimelineEntries } from '../audit/auditCaseTimeline.ts'

export function supportAccessRecoveryDecisionCaseReview(input: {
    filters: Record<string, unknown>
    approvals: Array<Record<string, any>>
    timeline: Array<Record<string, any>>
    decisionReceipt?: Record<string, any>
}) {
    const approvalEventIds = uniqueTimelineValues(input.approvals.flatMap(approval => approval.auditEventIds || []))
    const timelineEntries = supportCaseTimelineEntries(input.timeline)
    const receiptEventIds = Array.isArray(input.decisionReceipt?.auditEventIds) ? input.decisionReceipt.auditEventIds : []
    const auditEventIds = uniqueTimelineValues([...approvalEventIds, ...timelineEntries.map(entry => entry.auditEventId), ...receiptEventIds])
        .map(id => Number(id))
        .filter(id => Number.isFinite(id))
    const requestIds = uniqueTimelineValues([
        input.filters.request,
        input.decisionReceipt?.requestId,
        ...input.approvals.map(approval => approval.requestId),
    ])
    const organizationIds = uniqueTimelineValues([
        input.filters.org,
        input.decisionReceipt?.organizationId,
        ...input.approvals.map(approval => approval.organizationId),
    ])
    const targetIds = uniqueTimelineValues([
        input.decisionReceipt?.targetId,
        ...input.approvals.map(approval => approval.targetUserId || approval.targetEmail || approval.invite?.email || approval.inviteId),
    ])
    const inviteIds = uniqueTimelineValues([
        input.decisionReceipt?.inviteId,
        ...input.approvals.map(approval => approval.inviteId || approval.invite?.id),
    ])
    const actions = uniqueTimelineValues([
        input.filters.action,
        input.decisionReceipt?.actionType,
        ...timelineEntries.map(entry => entry.actionType),
    ])
    const outcomes = uniqueTimelineValues([
        input.filters.outcome,
        input.decisionReceipt?.outcome,
        ...input.approvals.map(approval => approval.outcome),
        ...timelineEntries.map(entry => entry.outcome),
    ])
    const reasons = uniqueTimelineValues([
        input.decisionReceipt?.reason,
        ...input.approvals.map(approval => approval.decisionReason || approval.requestedReason),
        ...timelineEntries.map(entry => entry.operatorNotes?.reason),
    ])
    const blockerCodes = uniqueTimelineValues([
        ...(Array.isArray(input.decisionReceipt?.blockers) ? input.decisionReceipt.blockers : []),
        ...timelineEntries.flatMap(entry => entry.operatorNotes?.blockerCodes || []),
        ...input.approvals.flatMap(approval => {
            if (approval.status === 'denied') return ['denied_recovery_approval']
            if (approval.status === 'pending') return ['pending_approval_requires_decision']
            if (approval.outcome === 'failed') return ['access_recovery_decision_failed']
            return []
        }),
    ])
    const replayFilter = {
        ...input.filters,
        org: String(input.filters.org || organizationIds[0] || ''),
        target: String(input.filters.target || targetIds[0] || ''),
        entity: String(input.filters.entity || inviteIds[0] || ''),
        request: String(input.filters.request || requestIds[0] || ''),
        action: String(input.filters.action || actions[0] || 'support.organization.access_recovery'),
        outcome: String(input.filters.outcome || outcomes[0] || ''),
        source: 'admin',
        service: 'hanasand-api',
    }
    return {
        schemaVersion: 'support.access_recovery.decision_case_review.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        expectedConsumers: ['support', 'case.replay', 'integration'],
        summary: {
            approvalCount: input.approvals.length,
            timelineEntryCount: timelineEntries.length,
            auditEventIds,
            requestIds,
            organizationIds,
            targetIds,
            inviteIds,
            actions,
            outcomes,
            reasonPresent: reasons.length > 0,
            blockerCodes,
            operatorReviewRequired: blockerCodes.length > 0 || outcomes.includes('denied') || outcomes.includes('failed'),
        },
        operatorNotes: {
            reasonValues: reasons,
            reasonRequired: true,
            contextRequired: true,
            denialReasonCodes: uniqueTimelineValues([
                ...blockerCodes,
                ...timelineEntries.flatMap(entry => entry.recoveryState?.denialReasonCodes || []),
            ]),
            reviewFields: ['reason', 'decisionReason', 'requestId', 'supportSessionId', 'auditEventIds', 'blockerCode'],
        },
        timelineEntries,
        replayFilters: {
            current: auditFilterQuery(replayFilter),
            byRequest: requestIds.map(request => auditFilterQuery({ request, source: 'admin', service: 'hanasand-api' })),
            byOrganization: organizationIds.map(org => auditFilterQuery({ org, action: 'support.organization.access_recovery', source: 'admin', service: 'hanasand-api' })),
            byTarget: targetIds.map(target => auditFilterQuery({ target, action: 'support.organization.access_recovery', source: 'admin', service: 'hanasand-api' })),
            byInvite: inviteIds.map(entity => auditFilterQuery({ entity, entityType: 'invite', action: 'support.organization.access_recovery', source: 'admin', service: 'hanasand-api' })),
            denied: auditFilterQuery({ ...replayFilter, outcome: 'denied' }),
            byReasonCode: blockerCodes.map(blocker => auditFilterQuery({ ...replayFilter, blocker, outcome: 'denied' })),
        },
        safeHandoff: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noSilentImpersonation: true,
            noCrossOrgLeakage: true,
            redactionRequired: true,
        },
        nextRoutes: {
            approvalSearch: '/api/admin/support/access-recovery',
            inspectRequests: requestIds.map(request => `/api/admin/support/access-recovery/${encodeURIComponent(String(request))}`),
            auditReplay: auditFilterQuery(replayFilter),
            auditDetails: auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            receiptReplay: '/api/admin/support/receipt-replay',
        },
        denialStates: [
            'missing_support_reason',
            'support_role_required',
            'support_session_revoked',
            'support_session_expired',
            'support_session_scope_denied',
            'approval_not_pending',
            'self_approval_denied',
            'denied_recovery_approval',
            'missing_decision_audit_events',
            'redaction_required',
        ],
        blockers: uniqueTimelineValues([
            auditEventIds.length ? '' : 'missing_decision_audit_events',
            requestIds.length ? '' : 'missing_request_id',
            reasons.length ? '' : 'missing_support_reason',
            ...blockerCodes,
        ]),
        copyText: [
            `Access recovery case review request=${requestIds.join(', ') || '*'}`,
            `Outcomes: ${outcomes.join(', ') || 'none'}`,
            `Audit events: ${auditEventIds.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(replayFilter)}`,
        ].join('\n'),
    }
}
