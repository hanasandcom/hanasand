import type { WorkbenchCase } from './types'
import type { WorkbenchDwmCaseListItem } from './pageTypes'

export function dwmCaseToWorkbenchCase(row: WorkbenchDwmCaseListItem): WorkbenchCase {
    const caseId = String(row.caseId || row.id || 'case')
    const alertId = String(row.alertId || '')
    const rowId = alertId || caseId
    const hasAlertRef = Boolean(alertId)
    const severity = normalizeWorkbenchSeverity(row.severity || row.priority)
    const route = String(row.recommendedRoute || 'case_review').replaceAll('_', ' ')
    const webhookStatuses = row.webhookStatuses || []
    const webhookDeliveryIds = row.webhookDeliveryIds || []
    const updatedAt = row.updatedAt || row.latestEvent?.at || row.createdAt || ''
    const watchlistItemIds = row.watchlistItemIds || []
    const deliveryEvidence = webhookDeliveryIds.map((deliveryId, index) => ({
        id: deliveryId,
        alertId: alertId || rowId,
        status: webhookStatuses[index] || webhookStatuses[0] || 'recorded',
        attemptedAt: row.latestEvent?.at || '',
        webhookDestinationId: undefined,
        endpointHash: 'endpoint_hash_not_returned',
        payloadHash: 'payload_hash_not_returned',
    }))
    const timeline = (row.timeline || [])
        .slice(0, 8)
        .map((event, index) => ({
            id: String(event.id || `${caseId}_timeline_${index}`),
            at: String(event.at || updatedAt),
            title: String(event.title || event.eventType || 'Case event').replaceAll('_', ' '),
            body: String(event.summary || event.body || event.eventType || 'Case event recorded.'),
        }))

    return {
        id: rowId,
        kind: 'dwm_alert',
        queue: 'Case review',
        title: row.title || caseId,
        subtitle: row.summary || `${caseId} is ${row.status || 'open'} with ${webhookDeliveryIds.length} webhook delivery ${pluralize('row', webhookDeliveryIds.length)}.`,
        severity,
        status: row.status || 'open',
        priority: severityPriority(severity) + 30 + webhookDeliveryIds.length,
        confidence: webhookDeliveryIds.length ? 86 : 78,
        owner: row.assignedOwner || 'unassigned',
        createdAt: row.createdAt || updatedAt,
        updatedAt,
        company: row.title || row.organizationId || 'DWM case',
        matchedTerm: watchlistItemIds[0] || row.dedupeKey || rowId,
        actor: 'DWM case',
        sourceLabel: webhookStatuses.length ? `${webhookStatuses.join(', ')} delivery` : 'case timeline',
        recommendedAction: row.nextAllowedActions?.find(action => action.enabled)?.label || 'Open the case detail, review the timeline, then record the next analyst action.',
        routeLabel: route,
        persistent: true,
        evidence: [],
        timeline,
        nextTasks: [
            'Open the case detail and inspect evidence/provenance.',
            webhookDeliveryIds.length ? 'Review webhook delivery state before closing.' : 'Send or test webhook delivery when evidence is customer-safe.',
            'Record rationale before suppressing, escalating, or closing.',
        ],
        relatedLinks: [
            { href: caseDashboardHref(row), label: 'Open case' },
            ...(hasAlertRef ? [{ href: `/api/findings/alerts/${encodeURIComponent(alertId)}`, label: 'Open alert detail' }] : []),
        ],
        workflowPath: [
            {
                id: 'alert_ref',
                label: 'Alert',
                status: hasAlertRef ? 'ready' : 'needs_action',
                owner: 'alert',
                source: 'case alert reference',
                detail: hasAlertRef ? `Alert ${alertId}` : 'Alert reference is syncing.',
                entityId: alertId || undefined,
                href: hasAlertRef ? `/api/findings/alerts/${encodeURIComponent(alertId)}` : undefined,
            },
            {
                id: 'case_ref',
                label: 'Case',
                status: 'ready',
                owner: 'case',
                source: 'case file',
                detail: `${caseId} · ${row.status || 'open'} · owner ${row.assignedOwner || 'unassigned'}.`,
                entityId: caseId,
                href: caseDashboardHref(row),
            },
            {
                id: 'delivery_ref',
                label: 'Delivery',
                status: webhookDeliveryIds.length ? webhookStatuses.includes('failed') ? 'blocked' : 'ready' : 'needs_action',
                owner: 'webhook',
                source: 'delivery ledger',
                detail: webhookDeliveryIds.length ? `${webhookDeliveryIds.length} delivery ${pluralize('row', webhookDeliveryIds.length)}: ${webhookStatuses.join(', ') || 'recorded'}.` : 'No webhook delivery is attached yet.',
                entityId: webhookDeliveryIds[0],
            },
        ],
        actions: [
            { id: 'replay_alert', label: 'Replay', method: 'POST', href: `/api/findings/alerts/${encodeURIComponent(rowId)}/replay`, body: { organizationId: row.organizationId, action: 'replay' }, disabledReason: hasAlertRef ? undefined : 'Alert reference is syncing before replay can run.' },
            { id: 'send_alert', label: 'Send', method: 'POST', href: '/api/findings/webhooks/deliver', body: { organizationId: row.organizationId, alertId: rowId, limit: 1 }, disabledReason: hasAlertRef ? undefined : 'Alert reference is syncing before delivery can run.' },
        ],
        caseDetailHref: caseDashboardHref(row),
        deliveryEvidence,
    }
}

export function caseDashboardHref(row: WorkbenchDwmCaseListItem) {
    const caseId = String(row.caseId || row.id || '')
    const params = new URLSearchParams()
    if (row.organizationId) params.set('organizationId', row.organizationId)
    if (row.alertId) params.set('alertId', row.alertId)
    params.set('route', 'ti_workbench')
    const query = params.toString()
    return `/cases/${encodeURIComponent(caseId || 'case')}${query ? `?${query}` : ''}`
}

export function severityPriority(severity: WorkbenchCase['severity']) {
    if (severity === 'critical') return 400
    if (severity === 'high') return 300
    if (severity === 'medium') return 200
    return 100
}

export function normalizeWorkbenchSeverity(value: string | undefined): WorkbenchCase['severity'] {
    if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') return value
    if (value === 'urgent' || value === 'p1') return 'critical'
    if (value === 'review' || value === 'p2') return 'high'
    return 'medium'
}

export function pluralize(word: string, count: number) {
    return count === 1 ? word : `${word}s`
}
