import type { DwmAlert, DwmSeverity } from '@/utils/dwm/product'
import { customerAlertSummary } from '@/utils/dwm/display'
import type { WorkbenchCase } from './types'
import type { RuntimeDwmAlert } from './runtimeAlert'
import { buildAlertActions, buildAlertTimeline, buildWorkbenchEvidence, deliveryDetail, nextAlertTasks } from './alertModel'
import { pluralize, severityPriority } from './adapterUtils'

export function dwmAlertToWorkbenchCase(input: DwmAlert): WorkbenchCase {
    const alert = input as RuntimeDwmAlert
    const severity = normalizeSeverity(alert.severity)
    const route = String(alert.recommendedRoute ?? alert.customerReadiness?.alertReadiness?.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute ?? 'analyst_review')
    const workflowStatus = String(alert.workflowStatus ?? alert.workflowSummary?.status ?? alert.customerReadiness?.workflowReadiness?.status ?? alert.reviewState ?? 'new')
    const owner = alert.assignedOwner ?? alert.workflowSummary?.assignedOwner ?? alert.customerReadiness?.workflowReadiness?.assignedOwner ?? 'unassigned'
    const caseId = alert.caseId ?? alert.customerReadiness?.caseHandoff?.caseId ?? alert.customerReadiness?.caseHandoff?.caseIdCandidate ?? alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate
    const casePath = alert.casePath ?? alert.customerReadiness?.caseHandoff?.casePath ?? alert.workflowSummary?.casePath ?? alert.workflowContext?.casePath
    const organizationId = alert.organizationId ?? alert.orgWatchlistScope?.organizationId ?? alert.workflowContext?.organizationId
    const selectedCaptureIds = uniqueStrings([
        ...(alert.customerReadiness?.alertReadiness?.selectedCaptureIds ?? []),
        ...(alert.deliveryReadinessContext?.selectedCaptureIds ?? []),
        ...(alert.webhookContext?.selectedCaptureIds ?? []),
        ...(alert.workflowContext?.captureIds ?? []),
        ...(alert.sourceProvenanceSummary?.captureIds ?? []),
        ...(alert.sourceProvenanceSummary?.generationEvidenceWindow?.captureIds ?? []),
    ])
    const watchlistIds = uniqueStrings([
        ...(alert.watchlistIds ?? []),
        ...(alert.orgWatchlistScope?.watchlistIds ?? []),
        ...(alert.workflowContext?.watchlistIds ?? []),
        ...(alert.customerReadiness?.alertReadiness?.watchlistIds ?? []),
    ])
    const watchlistItemIds = uniqueStrings([
        ...(alert.watchlistItemIds ?? []),
        ...(alert.orgWatchlistScope?.watchlistItemIds ?? []),
        ...(alert.workflowContext?.watchlistItemIds ?? []),
        ...(alert.customerReadiness?.alertReadiness?.watchlistItemIds ?? []),
    ])
    const evidence = buildWorkbenchEvidence(alert, selectedCaptureIds)
    const actionBlockers = alert.customerReadiness?.blockerCodes ?? []
    const alertHref = `/api/findings/alerts/${encodeURIComponent(alert.id)}${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`
    const caseDetailHref = dashboardCaseHref({ caseId, casePath, alertId: alert.id, organizationId, tenantId: alert.tenantId })
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
            ...(watchlistIds.length ? [{ href: watchlistLedgerHref(organizationId, alert.tenantId), label: 'Watchlists' }] : []),
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
                href: watchlistIds.length ? watchlistLedgerHref(organizationId, alert.tenantId) : undefined,
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
                href: deliveryLedgerHref(organizationId, alert.tenantId, alert.id),
            },
        ],
        actions: buildAlertActions(alert, organizationId),
        caseDetailHref,
        deliveryEvidence,
        missingDependency: caseDetailHref ? undefined : 'Backed case id is syncing to this alert.',
    }
}

function watchlistLedgerHref(organizationId: string | undefined, tenantId: string | undefined) {
    const params = new URLSearchParams()
    if (organizationId) params.set('organizationId', organizationId)
    if (tenantId) params.set('tenantId', tenantId)
    const query = params.toString()
    return `/api/findings/watchlists${query ? `?${query}` : ''}`
}

function deliveryLedgerHref(organizationId: string | undefined, tenantId: string | undefined, alertId: string) {
    const params = new URLSearchParams()
    if (organizationId) params.set('organizationId', organizationId)
    if (tenantId) params.set('tenantId', tenantId)
    params.set('alertId', alertId)
    return `/api/findings/webhooks/deliveries?${params.toString()}`
}

function dashboardCaseHref(input: { caseId?: string, casePath?: string, alertId: string, organizationId?: string, tenantId?: string }) {
    const caseId = input.caseId ?? caseIdFromPath(input.casePath)
    if (!caseId) return undefined
    const params = new URLSearchParams()
    if (input.organizationId) params.set('organizationId', input.organizationId)
    if (input.tenantId) params.set('tenantId', input.tenantId)
    params.set('alertId', input.alertId)
    params.set('route', 'ti_workbench')
    return `/cases/${encodeURIComponent(caseId)}?${params.toString()}`
}

function caseIdFromPath(path?: string) {
    const match = path?.match(/\/cases\/([^/?#]+)/)
    if (!match?.[1]) return undefined
    try {
        return decodeURIComponent(match[1])
    } catch {
        return match[1]
    }
}

function normalizeSeverity(severity: DwmSeverity): WorkbenchCase['severity'] {
    return severity
}

function uniqueStrings(values: Array<string | undefined>) {
    return [...new Set(values.map(value => String(value ?? '').trim()).filter(Boolean))]
}
