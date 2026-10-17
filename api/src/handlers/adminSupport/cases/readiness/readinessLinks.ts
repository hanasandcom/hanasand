import { auditFilterQuery, type SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'

export function supportReadinessReplayFilters(input: {
    timelineFilter: SupportTimelineFilter
    supportSession: string
    requestIds: string[]
    entityIds: string[]
    actions: string[]
    outcomes: string[]
    org: string
    user: string
    email: string
}) {
    return {
        current: auditFilterQuery(input.timelineFilter),
        bySupportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, source: 'admin', service: 'hanasand-api' }) : null,
        byRequest: input.requestIds.map(request => auditFilterQuery({ request, source: 'admin', service: 'hanasand-api' })),
        byEntity: input.entityIds.map(entity => auditFilterQuery({ entity, source: 'admin', service: 'hanasand-api' })),
        byActionOutcome: input.actions.flatMap(action => input.outcomes.map(outcome => auditFilterQuery({ action, outcome, source: 'admin', service: 'hanasand-api' }))),
        denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
        recovery: auditFilterQuery({ org: input.org, target: input.user || input.email, action: 'support.organization.access_recovery', source: 'admin', service: 'hanasand-api' }),
        memberRecovery: auditFilterQuery({ org: input.org, target: input.user, action: 'support.organization.member_role_recovery', source: 'admin', service: 'hanasand-api' }),
        impersonation: auditFilterQuery({ org: input.org, target: input.user, action: 'impersonation', source: 'admin', service: 'hanasand-api' }),
    }
}

export function supportReadinessNextRoutes(filter: SupportTimelineFilter, eventIds: number[], supportSession: string) {
    return {
        readiness: '/api/admin/support/readiness',
        inspect: '/api/admin/support/inspect',
        auditReplay: auditFilterQuery(filter),
        auditDetails: eventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
        accessRecoveryQueue: '/api/admin/support/access-recovery',
        supportSession: supportSession ? `/api/admin/support/sessions/${encodeURIComponent(supportSession)}` : null,
    }
}
