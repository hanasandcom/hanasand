import { toImpersonationTimelineEvent, impersonationLifecycleState, impersonationTimelineSummary } from './impersonationTimelineEvents.ts'
import { supportImpersonationGuardrailAuditReplay } from './impersonationTimelineGuardrailReplay.ts'
import { impersonationTimelineFilterContract } from './impersonationTimelineFilter.ts'
import { impersonationTimelineDecisionPacket } from './impersonationTimelineDecision.ts'
import { impersonationCaseReviewPacket } from './impersonationTimelineCaseReview.ts'
import { impersonationLifecycleReceipt } from './impersonationTimelineReceipt.ts'

export type PreparedImpersonationTimeline = {
    timeline: Array<Record<string, any>>
    lifecycleState: ReturnType<typeof impersonationLifecycleState>
}

export function prepareImpersonationTimeline(rows: Array<Record<string, any>>): PreparedImpersonationTimeline {
    const timeline = rows.map(toImpersonationTimelineEvent)
    const lifecycleState = impersonationLifecycleState(timeline)
    return { timeline, lifecycleState }
}

export function projectImpersonationTimeline(input: {
    filters: Record<string, unknown>
    prepared: PreparedImpersonationTimeline
    guardrailRows: Array<Record<string, any>>
    sessionFilter: string
}) {
    const { filters, prepared, guardrailRows, sessionFilter } = input
    const { timeline, lifecycleState } = prepared
    return {
        schemaVersion: 'support.impersonation.timeline.v1',
        filters,
        eventIds: timeline.map(event => event.id),
        summary: impersonationTimelineSummary(timeline),
        filterContract: impersonationTimelineFilterContract(filters, timeline),
        decisionPacket: impersonationTimelineDecisionPacket(filters, timeline, lifecycleState),
        lifecycleReceipt: impersonationLifecycleReceipt(filters, timeline, lifecycleState),
        guardrailReplay: supportImpersonationGuardrailAuditReplay(filters, guardrailRows),
        caseReview: impersonationCaseReviewPacket(filters, timeline, guardrailRows, lifecycleState),
        events: timeline,
        redacted: true,
        links: {
            audit: `/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api${sessionFilter ? `&entity=${encodeURIComponent(sessionFilter)}` : ''}`,
            details: timeline.map(event => event.links.detail),
        },
        copyText: timeline.map(event => event.copyText).join('\n'),
    }
}
