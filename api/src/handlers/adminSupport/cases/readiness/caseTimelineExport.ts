import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
export function supportReadinessCaseTimelineExport(input: {
    actorId: string
    org: string
    user: string
    email: string
    request: string
    entity: string
    entityType: string
    supportSession: string
    timelineFilter: SupportTimelineFilter
    entries: Array<Record<string, any>>
}) {
    const entryIds = input.entries.map(entry => Number(entry.auditEventId)).filter(id => Number.isFinite(id))
    const actionTypes = uniqueTimelineValues(input.entries.map(entry => entry.actionType))
    const outcomes = uniqueTimelineValues(input.entries.map(entry => entry.outcome))
    const denialReasonCodes = uniqueTimelineValues(input.entries.flatMap(entry => entry.recoveryState?.denialReasonCodes || []))
    const blockerCodes = uniqueTimelineValues(input.entries.flatMap(entry => entry.operatorNotes?.blockerCodes || []))
    const targetId = input.user || input.email || input.entity
    const replayFilter = {
        ...input.timelineFilter,
        org: input.org,
        target: targetId,
        entity: input.entity,
        entityType: input.entityType,
        request: input.request,
        supportSession: input.supportSession,
        source: 'admin',
        service: 'hanasand-api',
    }
    return {
        schemaVersion: 'support.readiness.case_timeline_export.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        expectedConsumers: ['dashboard', 'integration', 'case.replay'],
        actorId: input.actorId,
        target: {
            organizationId: input.org || null,
            targetUserId: input.user || null,
            email: input.email || null,
            entityId: input.entity || null,
            entityType: input.entityType || null,
            requestId: input.request || null,
            supportSessionId: input.supportSession || null,
        },
        entries: input.entries,
        summary: {
            entryCount: input.entries.length,
            auditEventIds: entryIds,
            actionTypes,
            outcomes,
            denialReasonCodes,
            blockerCodes,
            operatorReviewRequired: input.entries.some(entry => Boolean(entry.operatorNotes?.reviewRequired)),
        },
        replayFilters: {
            current: auditFilterQuery(replayFilter),
            denied: auditFilterQuery({ ...replayFilter, outcome: 'denied' }),
            byAction: actionTypes.map(action => auditFilterQuery({ ...replayFilter, action })),
            byOutcome: outcomes.map(outcome => auditFilterQuery({ ...replayFilter, outcome })),
            byReasonCode: denialReasonCodes.map(blocker => auditFilterQuery({ ...replayFilter, blocker, outcome: 'denied' })),
        },
        nextRoutes: {
            readiness: '/api/admin/support/readiness',
            supportInspection: auditFilterQuery({
                org: input.org,
                target: targetId,
                entity: input.entity,
                request: input.request,
                supportSession: input.supportSession,
            }).replace('/api/admin/audit-events', '/api/admin/support/inspect'),
            auditReplay: auditFilterQuery(replayFilter),
            auditDetails: entryIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            receiptReplay: '/api/admin/support/receipt-replay',
        },
        safeHandoff: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noSilentImpersonation: true,
            noCrossOrgLeakage: true,
            redactionRequired: true,
        },
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
        blockers: uniqueTimelineValues([
            input.entries.length ? '' : 'missing_case_timeline_entries',
            input.org || targetId || input.request || input.supportSession ? '' : 'missing_case_timeline_target',
            ...blockerCodes,
        ]),
        copyText: [
            `Support readiness case timeline org=${input.org || '*'} target=${targetId || '*'} request=${input.request || '*'}`,
            `Entries: ${input.entries.length}`,
            `Denied reasons: ${denialReasonCodes.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(replayFilter)}`,
        ].join('\n'),
    }
}
