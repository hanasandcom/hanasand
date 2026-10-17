import type { DwmAlert, DwmSeverity } from '@/utils/dwm/product'
import { customerAlertSummary } from '@/utils/dwm/display'
import type { WorkbenchCase } from './types'
import type { RuntimeDwmAlert } from './runtimeAlert'
import { buildAlertActions, buildAlertTimeline, buildWorkbenchEvidence, deliveryDetail, nextAlertTasks } from './alertModel'
import { pluralize, severityPriority } from './adapterUtils'
import { alertCaseDetailHref, alertCaseReference, findingsDeliveryLedgerHref, findingsWatchlistLedgerHref } from './references'

export function dwmAlertToWorkbenchCase(input: DwmAlert): WorkbenchCase {
    const alert = input as RuntimeDwmAlert
    const severity = normalizeSeverity(alert.severity)
    const route = String(alert.recommendedRoute ?? alert.customerReadiness?.alertReadiness?.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute ?? 'analyst_review')
    const workflowStatus = String(alert.workflowStatus ?? alert.workflowSummary?.status ?? alert.customerReadiness?.workflowReadiness?.status ?? alert.reviewState ?? 'new')
    const owner = alert.assignedOwner ?? alert.workflowSummary?.assignedOwner ?? alert.customerReadiness?.workflowReadiness?.assignedOwner ?? 'unassigned'
    const caseReference = alertCaseReference(alert)
    const { caseId } = caseReference
    const organizationId = alert.organizationId ?? alert.orgWatchlistScope?.organizationId ?? alert.workflowContext?.organizationId
    const selectedCaptureIds = mergeUniqueStrings(
        alert.customerReadiness?.alertReadiness?.selectedCaptureIds ?? [],
        alert.deliveryReadinessContext?.selectedCaptureIds ?? [],
        alert.webhookContext?.selectedCaptureIds ?? [],
        alert.workflowContext?.captureIds ?? [],
        alert.sourceProvenanceSummary?.captureIds ?? [],
        alert.sourceProvenanceSummary?.generationEvidenceWindow?.captureIds ?? [],
    )
    const watchlistIds = mergeUniqueStrings(
        alert.watchlistIds ?? [],
        alert.orgWatchlistScope?.watchlistIds ?? [],
        alert.workflowContext?.watchlistIds ?? [],
        alert.customerReadiness?.alertReadiness?.watchlistIds ?? [],
    )
    const watchlistItemIds = mergeUniqueStrings(
        alert.watchlistItemIds ?? [],
        alert.orgWatchlistScope?.watchlistItemIds ?? [],
        alert.workflowContext?.watchlistItemIds ?? [],
        alert.customerReadiness?.alertReadiness?.watchlistItemIds ?? [],
    )
    const evidence = buildWorkbenchEvidence(alert, selectedCaptureIds)
    const actionBlockers = alert.customerReadiness?.blockerCodes ?? []
    const alertHref = `/api/findings/alerts/${encodeURIComponent(alert.id)}${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`
    const caseDetailHref = alertCaseDetailHref({ ...caseReference, alertId: alert.id, organizationId, tenantId: alert.tenantId })
    const deliveryEvidence = (alert.deliveries ?? []).map(row => ({
        id: String(row.id ?? ''),
        alertId: String(row.alertId ?? alert.id),
        status: String(row.status ?? 'recorded'),
        deliveryKind: row.deliveryKind,
        attemptedAt: String(row.attemptedAt ?? ''),
        webhookDestinationId: row.webhookDestinationId,
        endpointHash: String(row.endpointHash ?? 'endpoint_hash_not_returned'),
        payloadHash: String(row.payloadHash ?? alert.webhookDelivery?.payloadHash ?? 'payload_hash_not_returned'),
        httpStatus: row.httpStatus,
        error: row.error,
    })).filter(row => row.id)

    return {
        id: alert.id,
        kind: 'dwm_alert',
        queue: severity === 'critical' ? 'Incident response' : route.replaceAll('_', ' '),
        title: alert.company,
        subtitle: customerAlertSummary(alert),
        severity,
        status: workflowStatus,
        priority: severityPriority(severity) + alert.confidence + (workflowStatus === 'new' ? 20 : 0),
        confidence: alert.confidence,
        owner,
        createdAt: alert.firstSeenAt,
        updatedAt: alert.updatedAt ?? alert.lastSeenAt ?? alert.firstSeenAt,
        company: alert.company,
        matchedTerm: alert.matchedTerm.value,
        actor: alert.actor || alert.sourceFamily.replaceAll('_', ' '),
        sourceLabel: `${alert.sourceCount || evidence.length} ${pluralize('source', alert.sourceCount || evidence.length)}`,
        recommendedAction: alert.nextBestAction?.label || alert.recommendedAction,
        routeLabel: route.replaceAll('_', ' '),
        persistent: true,
        evidence,
        timeline: buildAlertTimeline(alert, selectedCaptureIds, watchlistIds, watchlistItemIds),
        nextTasks: nextAlertTasks(alert, actionBlockers),
        relatedLinks: [
            { href: alertHref, label: 'Open alert detail' },
            ...(caseDetailHref ? [{ href: caseDetailHref, label: 'Open case' }] : []),
            ...(watchlistIds.length ? [{ href: findingsWatchlistLedgerHref({ organizationId, tenantId: alert.tenantId }), label: 'Watchlists' }] : []),
        ],
        workflowPath: [
            {
                id: 'persisted_alert',
                label: 'Persisted alert',
                status: 'ready',
                owner: 'alert',
                source: 'Saved alert record',
                detail: `${selectedCaptureIds.length || evidence.length} capture-backed evidence item${(selectedCaptureIds.length || evidence.length) === 1 ? '' : 's'} retained.`,
                entityId: alert.id,
                href: alertHref,
            },
            {
                id: 'watchlist_scope',
                label: 'Watchlist scope',
                status: watchlistIds.length ? 'ready' : 'blocked',
                owner: 'org',
                source: 'orgWatchlistScope',
                detail: watchlistIds.length ? `${watchlistIds.length} watchlist ref${watchlistIds.length === 1 ? '' : 's'}; ${watchlistItemIds.length} item ref${watchlistItemIds.length === 1 ? '' : 's'}.` : 'Org/shared watchlist reference is syncing.',
                entityId: watchlistItemIds[0] ?? watchlistIds[0],
                href: watchlistIds.length ? findingsWatchlistLedgerHref({ organizationId, tenantId: alert.tenantId }) : undefined,
            },
            {
                id: 'case_handoff',
                label: 'case delivery',
                status: caseDetailHref ? 'ready' : 'needs_action',
                owner: 'case',
                source: 'caseHandoff',
                detail: caseDetailHref ? `Case detail route ${caseDetailHref}.` : 'Case id and path are syncing.',
                entityId: caseId,
                href: caseDetailHref,
            },
            {
                id: 'delivery',
                label: 'Delivery',
                status: alert.customerReadiness?.deliveryReadiness?.ready || alert.deliveryReadinessContext?.ready ? 'ready' : 'needs_action',
                owner: 'webhook',
                source: 'deliveryReadiness',
                detail: deliveryDetail(alert),
                entityId: alert.customerReadiness?.deliveryReadiness?.selectedWebhookDestinationId ?? alert.deliveryReadinessContext?.selectedWebhookDestinationId,
                href: findingsDeliveryLedgerHref({ organizationId, tenantId: alert.tenantId, alertId: alert.id }),
            },
        ],
        actions: buildAlertActions(alert, organizationId),
        caseDetailHref,
        deliveryEvidence,
        missingDependency: caseDetailHref ? undefined : 'Backed case id is syncing to this alert.',
    }
}

function normalizeSeverity(severity: DwmSeverity): WorkbenchCase['severity'] {
    return severity
}

function mergeUniqueStrings(...groups: Array<string | undefined>[]) {
    const values: Array<string | undefined> = []
    for (const group of groups) values.push(...group)
    return [...new Set(values.map(value => String(value ?? '').trim()).filter(Boolean))]
}
