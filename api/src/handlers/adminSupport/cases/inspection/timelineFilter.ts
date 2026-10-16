import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'

export function supportTimelineFilter(input: Omit<SupportTimelineFilter, 'unsupported'>): SupportTimelineFilter {
    return {
        q: input.q || '',
        org: input.org,
        user: input.user,
        email: input.email,
        request: input.request,
        entity: input.entity,
        entityType: input.entityType,
        supportSession: input.supportSession,
        workflow: input.workflow || '',
        action: input.action,
        severity: input.severity,
        outcome: input.outcome,
        source: input.source,
        service: input.service,
        blocker: input.blocker,
        reason: input.reason,
        scope: input.scope || '',
        context: input.context,
        from: input.from,
        to: input.to,
        limit: input.limit,
        unsupported: [],
    }
}
