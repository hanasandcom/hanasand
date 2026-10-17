import { auditFilterQuery, supportInspectionFilters, supportInspectionRequestIds, uniqueTimelineValues, type SupportInspectionPacket, type SupportTimelineFilter } from './inspectionPacketShared.ts'

export function supportInspectionAuditFilterCoverage(input: {
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    organizationIds: string[]
    user: string
    email: string
    request: string
    supportSession: string
}): SupportInspectionPacket {
    const filterEntries = Object.entries(input.timelineFilter)
        .filter(([key, value]) => key !== 'unsupported' && key !== 'limit' && value !== undefined && value !== null && value !== '')
        .map(([key, value]) => ({ key, value: String(value) }))
    const activeKeys = filterEntries.map(entry => entry.key)
    const targetBounded = Boolean(input.timelineFilter.org || input.timelineFilter.user || input.timelineFilter.email || input.timelineFilter.request || input.timelineFilter.entity || input.timelineFilter.supportSession)
    const detailRoutes = input.timeline.map(event => event.links?.detail).filter(Boolean)
    const eventIds = input.timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const actionValues = uniqueTimelineValues(input.timeline.map(event => event.action || event.actionType))
    const outcomeValues = uniqueTimelineValues(input.timeline.map(event => event.outcome))
    const severityValues = uniqueTimelineValues(input.timeline.map(event => event.severity))
    const entityIds = uniqueTimelineValues(input.timeline.map(event => event.entityId || event.entity?.id))
    const requestIds = supportInspectionRequestIds(input.request, input.timeline)
    return {
        schemaVersion: 'support.inspection.audit_filter_coverage.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportedFilters: Array.from(supportInspectionFilters),
        activeFilters: filterEntries,
        activeKeys,
        unsupportedFilters: input.timelineFilter.unsupported,
        targetBounded,
        requiredForBoundedSearch: ['org|user|email|request|entity|supportSession'],
        resultCoverage: {
            eventCount: input.timeline.length,
            eventIds,
            actionValues,
            outcomeValues,
            severityValues,
            entityIds,
            requestIds,
            detailRoutes,
        },
        replay: {
            current: auditFilterQuery(input.timelineFilter),
            denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            success: auditFilterQuery({ ...input.timelineFilter, outcome: 'success' }),
            byRequest: requestIds.map(requestId => auditFilterQuery({ request: requestId })),
            byOrg: input.organizationIds.map(org => auditFilterQuery({ org })),
            byTarget: input.user || input.email ? auditFilterQuery({ target: input.user || input.email }) : null,
            bySupportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession }) : null,
            byEntity: entityIds.map(entity => auditFilterQuery({ entity })),
            byActionOutcome: actionValues.flatMap(action => outcomeValues.map(outcome => auditFilterQuery({ action, outcome }))).slice(0, 25),
        },
        guardrails: {
            supportRoleRequired: true,
            detailRetrievalRequiresSupport: true,
            noOverbroadInspection: true,
            redactionRequired: true,
            unsupportedFiltersAreTyped: true,
        },
        blockers: uniqueTimelineValues([
            targetBounded ? '' : 'overbroad_support_inspection',
            input.timelineFilter.unsupported.length ? 'unsupported_audit_filter' : '',
            input.timeline.length ? '' : 'missing_audit_events',
            detailRoutes.length ? '' : 'missing_detail_routes',
        ]),
        copyText: [
            `Support audit filters active=${activeKeys.join(',') || 'none'} targetBounded=${targetBounded}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(input.timelineFilter)}`,
            `Denied: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}
