import { safeEvidenceExcerpt } from '@/utils/dwm/display'
import type { WorkbenchAction, WorkbenchEvidence, WorkbenchTimelineItem } from './types'
import type { RuntimeDwmAlert } from './runtimeAlert'
import { alertCaseReference } from './references'

export function buildWorkbenchEvidence(alert: RuntimeDwmAlert, selectedCaptureIds: string[]): WorkbenchEvidence[] {
    const evidence: WorkbenchEvidence[] = alert.evidence.map(item => ({
        id: item.id,
        sourceName: item.sourceName,
        sourceFamily: item.sourceFamily.replaceAll('_', ' '),
        captureMode: item.captureMode.replaceAll('_', ' '),
        redactionState: item.redactionState.replaceAll('_', ' '),
        contentHash: item.contentHash,
        excerpt: safeEvidenceExcerpt(item.excerpt),
        observedAt: item.observedAt ?? item.firstSeenAt,
        provenance: typeof item.provenance === 'object'
            ? [item.provenance.sourceId, item.provenance.captureId].filter(Boolean).join(' / ')
            : undefined,
        confidence: alert.confidence,
        metadata: [
            { label: 'Capture', value: typeof item.provenance === 'object' ? item.provenance.captureId : selectedCaptureIds.find(id => id === item.id) || item.id },
            { label: 'Source', value: typeof item.provenance === 'object' ? item.provenance.sourceId : item.sourceName },
            { label: 'Hash', value: item.contentHash },
        ],
    }))
    const excerptRows = alert.sourceProvenanceSummary?.evidenceExcerpts ?? []
    for (const row of excerptRows) {
        const id = String(row.id ?? row.contentHash ?? '')
        if (!id || evidence.some(item => item.id === id)) continue
        evidence.push({
            id,
            sourceName: row.sourceName ?? alert.sourceFamily,
            sourceFamily: String(row.sourceFamily ?? alert.sourceFamily).replaceAll('_', ' '),
            captureMode: 'metadata only',
            redactionState: 'customer safe',
            contentHash: String(row.contentHash ?? id),
            excerpt: safeEvidenceExcerpt(row.excerpt ?? 'Source excerpt retained in provenance summary.'),
            observedAt: row.observedAt,
            confidence: alert.confidence,
        })
    }
    return evidence
}

export function buildAlertTimeline(alert: RuntimeDwmAlert, selectedCaptureIds: string[], watchlistIds: string[], watchlistItemIds: string[]): WorkbenchTimelineItem[] {
    const rows: WorkbenchTimelineItem[] = [
        {
            id: `${alert.id}_created`,
            at: alert.firstSeenAt,
            title: 'Alert created',
            body: `${alert.matchedTerm.value} matched ${selectedCaptureIds.length || alert.evidence.length} capture${(selectedCaptureIds.length || alert.evidence.length) === 1 ? '' : 's'} from ${alert.sourceFamily.replaceAll('_', ' ')}.`,
        },
        {
            id: `${alert.id}_watchlist`,
            at: alert.updatedAt ?? alert.lastSeenAt ?? alert.firstSeenAt,
            title: 'Watchlist scope',
            body: watchlistIds.length ? `${watchlistIds.join(', ')} / ${watchlistItemIds.join(', ') || 'watchlist item syncing'}` : 'Org watchlist scope is syncing.',
        },
        {
            id: `${alert.id}_route`,
            at: alert.updatedAt ?? alert.lastSeenAt ?? alert.firstSeenAt,
            title: 'Recommended route',
            body: String(alert.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute ?? 'analyst_review').replaceAll('_', ' '),
        },
        ...(alert.workflowEvents ?? []).map((event, index) => ({
            id: String(event.id ?? `${alert.id}_workflow_${index}`),
            at: String(event.at ?? alert.updatedAt ?? alert.firstSeenAt),
            title: String(event.eventType ?? event.toWorkflowStatus ?? 'Workflow event').replaceAll('_', ' '),
            body: [event.toWorkflowStatus, event.toOwner ? `owner ${event.toOwner}` : undefined, event.note].filter(Boolean).join(' · '),
        })),
    ]
    return rows.sort((a, b) => a.at.localeCompare(b.at))
}

export function buildAlertActions(alert: RuntimeDwmAlert, organizationId: string | undefined): WorkbenchAction[] {
    const scope = organizationId ? { organizationId } : {}
    const expectedWorkflowEventCount = alert.workflowEvents?.length ?? alert.customerReadiness?.workflowReadiness?.eventCount ?? alert.workflowSummary?.eventCount
    const { caseId, casePath } = alertCaseReference(alert)
    const bodyBase = {
        ...scope,
        ...(expectedWorkflowEventCount !== undefined ? { expectedWorkflowEventCount } : {}),
    }
    const alertHref = `/api/findings/alerts/${encodeURIComponent(alert.id)}`
    const replayBlocked = alert.customerReadiness?.webhookReplayReadiness?.ready === false ? blockerLabel(alert.customerReadiness.webhookReplayReadiness.blockerCodes) : undefined
    const sendBlocked = alert.customerReadiness?.deliveryReadiness?.ready === false ? blockerLabel(alert.customerReadiness.deliveryReadiness.blockerCodes) : undefined
    return [
        ...(!caseId ? [{
            id: 'open_case',
            label: 'Open case',
            method: 'POST' as const,
            href: `${alertHref}/case-handoff`,
            body: {
                ...scope,
                note: 'Open a case from this alert.',
                idempotencyKey: `ti-workbench-open-case:${alert.id}`,
            },
        }] : []),
        { id: 'review_alert', label: 'Review', method: 'PATCH', href: alertHref, body: { ...bodyBase, status: 'triaged' } },
        { id: 'escalate_alert', label: 'Escalate', method: 'PATCH', href: alertHref, body: { ...bodyBase, status: 'investigating' } },
        { id: 'suppress_alert', label: 'Suppress', method: 'PATCH', href: alertHref, body: { ...bodyBase, status: 'suppressed' } },
        { id: 'close_alert', label: alert.workflowStatus === 'closed' ? 'Reopen' : 'Close', method: 'PATCH', href: alertHref, body: { ...bodyBase, status: alert.workflowStatus === 'closed' ? 'reopened' : 'closed' } },
        { id: 'replay_alert', label: 'Replay', method: 'POST', href: `${alertHref}/replay`, body: { ...bodyBase, action: 'replay' }, disabledReason: replayBlocked },
        { id: 'send_alert', label: 'Send', method: 'POST', href: '/api/findings/webhooks/deliver', body: { ...scope, alertId: alert.id, caseId, casePath, webhookDestinationId: alert.customerReadiness?.deliveryReadiness?.selectedWebhookDestinationId ?? alert.deliveryReadinessContext?.selectedWebhookDestinationId, limit: 1 }, disabledReason: sendBlocked },
    ]
}

export function nextAlertTasks(alert: RuntimeDwmAlert, blockers: string[]) {
    if (blockers.length) {
        return [
            `Clear blocker: ${blockers[0].replaceAll('_', ' ')}.`,
            'Review evidence and watchlist scope before customer routing.',
            'Assign an owner and add rationale before suppression or closure.',
        ]
    }
    return [
        alert.nextBestAction?.label || 'Review the persisted evidence and confirm customer impact.',
        'Assign an analyst owner and record the decision rationale.',
        'Open case delivery or send webhook delivery when evidence is customer-safe.',
    ]
}

export function deliveryDetail(alert: RuntimeDwmAlert) {
    const selected = alert.customerReadiness?.deliveryReadiness?.selectedWebhookDestinationId ?? alert.deliveryReadinessContext?.selectedWebhookDestinationId
    const destinations = alert.customerReadiness?.deliveryReadiness?.webhookDestinationIds ?? alert.deliveryReadinessContext?.webhookDestinationIds ?? alert.workflowContext?.webhookDestinationIds ?? []
    if (selected) return `Selected destination ${selected}; ${destinations.length || 1} destination ref${(destinations.length || 1) === 1 ? '' : 's'}.`
    const blockers = alert.customerReadiness?.deliveryReadiness?.blockerCodes ?? alert.deliveryReadinessContext?.blockerCodes ?? []
    return blockers.length ? blockers.map(item => item.replaceAll('_', ' ')).join(', ') : 'Delivery destination is not selected yet.'
}

function blockerLabel(blockers: string[] | undefined) {
    return blockers?.length ? blockers.map(item => item.replaceAll('_', ' ')).join(', ') : undefined
}
