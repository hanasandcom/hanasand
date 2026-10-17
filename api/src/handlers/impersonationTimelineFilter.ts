import { supportText } from '#utils/support/adminSupportInput.ts'
import { impersonationEventsQuery } from './impersonationTimelineQuery.ts'

export function impersonationTimelineFilterContract(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    return {
        schemaVersion: 'support.impersonation.timeline_filter_contract.v1',
        filters,
        supportedFilters: ['q', 'actor', 'target', 'action', 'outcome', 'method', 'path', 'session', 'supportSession', 'supportSessionId', 'reason', 'from', 'to', 'limit'],
        filterReadiness: impersonationTimelineFilterReadiness(filters, timeline),
        lifecycleStorage: 'impersonation_events',
        auditStorage: 'system_events',
        eventCount: timeline.length,
        redacted: true,
        unavailableFilters: [
            {
                filter: 'requestId',
                reason: 'Lifecycle rows do not store request ids; use admin audit events for request correlation.',
                route: '/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api',
            },
            {
                filter: 'deniedOutcome',
                reason: 'Denied impersonation attempts are stored as structured admin audit events.',
                route: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
            },
        ],
        replay: {
            lifecycle: impersonationEventsQuery(filters),
            audit: `/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api${filters.session ? `&entity=${encodeURIComponent(String(filters.session))}` : ''}`,
        },
        copyText: [
            'Impersonation timeline filter contract',
            `Lifecycle replay: ${impersonationEventsQuery(filters)}`,
            'Denied attempts: /api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
        ].join('\n'),
    }
}

function impersonationTimelineFilterReadiness(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const filterText = (key: string) => supportText(filters[key])
    const appliedFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => supportText(value)))
    const targetFilters = ['actor', 'target', 'session', 'supportSession', 'reason']
        .filter(key => filterText(key))
    const actionFilters = ['action', 'outcome', 'method', 'path']
        .filter(key => filterText(key))
    const from = filterText('from')
    const to = filterText('to')
    const timeRangeValid = (!from || !Number.isNaN(Date.parse(from))) && (!to || !Number.isNaN(Date.parse(to)))
    const targetBounded = Boolean(targetFilters.length)
    return {
        schemaVersion: 'support.impersonation.timeline_filter_readiness.v1',
        appliedFilters,
        targetBounded,
        targetFilters,
        actionFilters,
        timeRange: {
            from: from || null,
            to: to || null,
            valid: timeRangeValid,
        },
        supportedAliases: {
            actor: ['actor'],
            target: ['target'],
            session: ['session', 'supportSession', 'supportSessionId'],
            reason: ['reason'],
        },
        replay: {
            lifecycle: impersonationEventsQuery(filters),
            audit: `/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api${filterText('session') ? `&entity=${encodeURIComponent(filterText('session'))}` : ''}`,
            denied: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
        },
        blockers: [
            timeRangeValid ? '' : 'invalid_time_range',
            !targetBounded && (actionFilters.length || from || to) ? 'overbroad_impersonation_timeline_filter' : '',
            timeline.length ? '' : 'lifecycle_events_unavailable',
        ].filter(Boolean),
        redacted: true,
    }
}
