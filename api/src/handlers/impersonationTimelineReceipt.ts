import { uniqueTimelineValues as uniqueImpersonationValues } from '#utils/support/inspectionPacketShared.ts'
import { impersonationEventsQuery } from './impersonationTimelineQuery.ts'
import type { ImpersonationLifecycleState } from './impersonationTimelineEvents.ts'

export function impersonationLifecycleReceipt(filters: Record<string, unknown>, timeline: Array<Record<string, any>>, lifecycle: ImpersonationLifecycleState) {
    const { sessionIds, startEvents, stopEvents, stoppedSessionIds, activeSessionIds, missingReasonEventIds, missingDurationEventIds, expiredSessionIds } = lifecycle
    return {
        schemaVersion: 'support.impersonation.lifecycle_receipt.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noSilentImpersonation: true,
        supportRoleRequired: true,
        reasonRequired: true,
        durationRequired: true,
        scopeRequired: true,
        supportSessionRequired: true,
        filters,
        actorIds: uniqueImpersonationValues(timeline.map(event => event.actor?.id)),
        targetIds: uniqueImpersonationValues(timeline.map(event => event.target?.id)),
        sessionIds,
        requestId: null,
        outcome: timeline.length ? 'success' : 'failed',
        severity: activeSessionIds.length || expiredSessionIds.length ? 'warning' : 'notice',
        auditEventIds: timeline.map(event => Number(event.id)).filter(id => Number.isFinite(id)),
        lifecycle: {
            startEventIds: startEvents.map(event => event.id),
            stopEventIds: stopEvents.map(event => event.id),
            activeSessionIds,
            stoppedSessionIds: Array.from(stoppedSessionIds),
            expiredSessionIds,
            missingReasonEventIds,
            missingDurationEventIds,
        },
        replayFilters: {
            current: impersonationEventsQuery(filters),
            starts: impersonationEventsQuery({ ...filters, action: 'impersonation.start' }),
            stops: impersonationEventsQuery({ ...filters, action: 'impersonation.stop' }),
            active: activeSessionIds.map(session => impersonationEventsQuery({ ...filters, session })),
            audit: `/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api${filters.session ? `&entity=${encodeURIComponent(String(filters.session))}` : ''}`,
            denied: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
            bySession: sessionIds.map(session => ({
                session,
                lifecycle: impersonationEventsQuery({ ...filters, session }),
                audit: `/api/admin/audit-events?action=impersonation&entity=${encodeURIComponent(session)}&source=admin&service=hanasand-api`,
            })),
        },
        receiptSchemas: [
            'support.impersonation.lifecycle_receipt.v1',
            'support.impersonation.request.v1',
            'support.impersonation.stop.v1',
            'support.impersonation.decision_packet.v1',
            'support.impersonation.timeline_filter_contract.v1',
        ],
        nextRoutes: {
            lifecycle: impersonationEventsQuery(filters),
            deniedAudit: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
            supportSession: filters.session ? `/api/admin/support/sessions/${encodeURIComponent(String(filters.session))}` : null,
            activeSessions: activeSessionIds.map(session => impersonationEventsQuery({ session })),
        },
        denialCases: [
            'impersonation_support_required',
            'missing_target_user',
            'missing_support_reason',
            'invalid_duration',
            'invalid_scope',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
        ],
        blockers: [
            timeline.length ? '' : 'lifecycle_events_unavailable',
            missingReasonEventIds.length ? 'missing_reason_on_impersonation_event' : '',
            missingDurationEventIds.length ? 'missing_duration_on_impersonation_start' : '',
            expiredSessionIds.length ? 'expired_impersonation_session' : '',
        ].filter(Boolean),
        copyText: [
            'Support impersonation lifecycle receipt',
            `Sessions: ${sessionIds.join(', ') || 'none'}`,
            `Active: ${activeSessionIds.join(', ') || 'none'}`,
            `Expired: ${expiredSessionIds.join(', ') || 'none'}`,
            `Replay: ${impersonationEventsQuery(filters)}`,
        ].join('\n'),
    }
}
