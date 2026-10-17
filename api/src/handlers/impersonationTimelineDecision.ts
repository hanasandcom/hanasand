import { impersonationEventsQuery } from './impersonationTimelineQuery.ts'
import type { ImpersonationLifecycleState } from './impersonationTimelineEvents.ts'

export function impersonationTimelineDecisionPacket(filters: Record<string, unknown>, timeline: Array<Record<string, any>>, lifecycle: ImpersonationLifecycleState) {
    const { startEvents, stopEvents, activeSessionIds, missingReasonEventIds, missingDurationEventIds } = lifecycle
    const blockers = [
        timeline.length ? '' : 'lifecycle_events_unavailable',
        missingReasonEventIds.length ? 'missing_reason_on_impersonation_event' : '',
        missingDurationEventIds.length ? 'missing_duration_on_impersonation_start' : '',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.impersonation.decision_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noSilentImpersonation: true,
        supportRoleRequired: true,
        requiredOperatorInputs: {
            reason: true,
            context: true,
            scope: true,
            durationMinutes: true,
            targetUser: true,
            organizationId: true,
            supportSessionId: true,
        },
        lifecycle: {
            eventCount: timeline.length,
            startEventIds: startEvents.map(event => event.id),
            stopEventIds: stopEvents.filter(event => event.actionType === 'impersonation.stop').map(event => event.id),
            activeSessionIds,
            missingReasonEventIds,
            missingDurationEventIds,
        },
        auditReplay: {
            lifecycle: impersonationEventsQuery(filters),
            audit: `/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api${filters.session ? `&entity=${encodeURIComponent(String(filters.session))}` : ''}`,
            denied: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
            supportSession: filters.session ? `/api/admin/support/sessions/${encodeURIComponent(String(filters.session))}` : null,
        },
        nextActions: [
            activeSessionIds.length ? {
                action: 'review_active_impersonation_session',
                route: impersonationEventsQuery({ ...filters, session: activeSessionIds[0] }),
            } : null,
            missingReasonEventIds.length || missingDurationEventIds.length ? {
                action: 'review_system_event_denials',
                route: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
            } : null,
        ].filter(Boolean),
        blockers,
        copyText: [
            'Support impersonation decision packet',
            `Lifecycle replay: ${impersonationEventsQuery(filters)}`,
            `Events: ${timeline.map(event => event.id).join(', ') || 'none'}`,
            `Active sessions: ${activeSessionIds.join(', ') || 'none'}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
