import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { systemEventFilters } from './auditFilterDefinitions.ts'
import { supportAuditRedactedSummary, supportAuditActionEvidenceRollup } from './auditEvidenceRollups.ts'
import { supportAuditEntityLinkRollup } from './auditEntityTimeline.ts'

export function supportAuditFilterContract(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const blockers = [
        timeline.length ? '' : 'audit_unavailable',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.audit.filter_contract.v1',
        filters,
        supportedFilters: Array.from(systemEventFilters),
        redacted: true,
        redactedSummary: supportAuditRedactedSummary(timeline),
        entityLinkRollup: supportAuditEntityLinkRollup(timeline),
        actionEvidenceRollup: supportAuditActionEvidenceRollup(timeline),
        filterReadiness: supportAuditFilterReadiness(filters, timeline),
        stableRequestIds: uniqueTimelineValues(timeline.map(event => event.requestId)),
        correlationIds: uniqueTimelineValues(timeline.map(event => event.context?.correlationId || event.requestId)),
        idempotencyKeys: uniqueTimelineValues(timeline.map(event => event.context?.idempotencyKey)),
        blockerCatalog: [
            'missing_support_reason',
            'support_role_required',
            'ambiguous_target',
            'unsupported_audit_filter',
            'invalid_audit_filter',
            'stale_prepare_payload',
            'duplicate_request',
            'audit_unavailable',
            'redaction_required',
        ],
        blockers,
        handoffPreviewLinkage: {
            request: filters.request || null,
            correlation: filters.correlation || null,
            idempotency: filters.idempotency || null,
            query: auditFilterQuery(filters),
        },
    }
}

export function supportAuditFilterReadiness(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const filterText = (key: string) => text(filters[key])
    const appliedFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => text(value)))
    const targetFilters = ['org', 'organizationId', 'actor', 'target', 'entity', 'entityType', 'request', 'correlation', 'idempotency', 'supportSession']
        .filter(key => filterText(key))
    const actionFilters = ['action', 'severity', 'outcome', 'source', 'service', 'workflow']
        .filter(key => filterText(key))
    const textQueryFilters = ['q']
        .filter(key => filterText(key))
    const reasonContextFilters = ['reason', 'scope', 'context', 'blocker']
        .filter(key => filterText(key))
    const from = filterText('from')
    const to = filterText('to')
    const timeRangeValid = (!from || !Number.isNaN(Date.parse(from))) && (!to || !Number.isNaN(Date.parse(to)))
    const targetBounded = Boolean(targetFilters.length || textQueryFilters.length || reasonContextFilters.length)
    const blockers = [
        timeRangeValid ? '' : 'invalid_time_range',
        !targetBounded && (actionFilters.length || from || to) ? 'overbroad_audit_query' : '',
        timeline.length ? '' : 'audit_unavailable',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.audit.filter_readiness.v1',
        appliedFilters,
        targetBounded,
        targetFilters,
        actionFilters,
        textQueryFilters,
        reasonContextFilters,
        timeRange: {
            from: from || null,
            to: to || null,
            valid: timeRangeValid,
        },
        supportedAliases: {
            query: ['q'],
            organization: ['org', 'orgId', 'organizationId'],
            actor: ['actor', 'actorId', 'supportActor', 'supportActorId'],
            target: ['target', 'targetId', 'user', 'userId', 'targetUserId'],
            action: ['action', 'actionType'],
            workflow: ['workflow', 'bridgeWorkflow', 'sourceWorkflow'],
            entity: ['entity', 'entityId', 'entityType'],
            request: ['request', 'requestId', 'correlation', 'correlationId'],
            blocker: ['blocker', 'blockerCode'],
            reason: ['reason', 'supportReason'],
            scope: ['scope', 'supportScope'],
            context: ['context', 'supportContext'],
            supportSession: ['session', 'supportSession', 'supportSessionId'],
        },
        replay: {
            query: auditFilterQuery(filters),
            eventIds: timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
        },
        blockers,
        redacted: true,
        copyText: [
            `Audit filters: ${Object.keys(appliedFilters).join(', ') || 'none'}`,
            `Target bounded: ${targetBounded}`,
            `Text query: ${textQueryFilters.join(', ') || 'none'}`,
            `Time range: ${from || '*'} to ${to || '*'}`,
            `Replay: ${auditFilterQuery(filters)}`,
        ].join('\n'),
    }
}
