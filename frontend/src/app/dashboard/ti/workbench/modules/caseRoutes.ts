import type { CaseDetailState, CaseDetailPayload, WorkbenchCase, WorkbenchWorkflowStep, WorkbenchOrgContext, WorkbenchDeliveryEvidence, CaseDelivery, AlertDetailPayload, WorkbenchAction } from '../types'
import { stringValue } from './actionMessages'
import { findingsDeliveryLedgerHref, findingsWatchlistLedgerHref } from '../references'

export function customerNotificationActionState(caseDetail: CaseDetailState | undefined) {
    if (caseDetail?.status !== 'ready') return { disabledReason: 'Open the case details before recording customer notification.' }
    if (caseDetail.detail.customerNotificationContext?.notified) return { disabledReason: 'Customer notification is already recorded.' }
    if (!deliveredCaseDelivery(caseDetail.detail)) return { disabledReason: 'Customer notification requires a delivered webhook row.' }
    if (caseDetail.detail.access?.readOnly) return { disabledReason: 'Read-only case members cannot record customer notifications.' }
    return {}
}

export function deliveredCaseDelivery(detail: CaseDetailPayload) {
    const latest = detail.deliveryContext?.latestDelivery
    if (latest?.status === 'delivered') return latest
    return (detail.deliveries || []).find(delivery => delivery.status === 'delivered')
}

export function caseCustomerNotificationHref(caseDetailHref: string) {
    const [path, query] = caseDetailHref.split('?')
    return `${path.replace(/\/$/, '')}/customer-notification${query ? `?${query}` : ''}`
}

export function caseExportHref(caseDetailHref: string) {
    const [path, query] = caseDetailHref.split('?')
    const params = new URLSearchParams(query || '')
    params.set('shape', 'full')
    params.set('timeline', 'true')
    params.set('evidence', 'true')
    params.set('nextActionPayloads', 'true')
    return `${path.replace(/\/$/, '')}/export?${params.toString()}`
}

export function caseReplayExportState(item: WorkbenchCase, caseDetail: CaseDetailState | undefined): {
    status: WorkbenchWorkflowStep['status']
    href?: string
    detail: string
    blockers: string[]
    workflowEventCount: number
    timelineCount: number
    deliveryCount: number
    nextActionCount: number
} {
    const href = item.caseDetailHref ? caseExportHref(item.caseDetailHref) : undefined
    const detail = caseDetail?.status === 'ready' ? caseDetail.detail : undefined
    const workflowEventCount = detail ? (detail.case?.workflowEvents || []).length + (detail.alertContext?.workflowEvents || []).length : 0
    const timelineCount = detail?.timeline?.length || 0
    const deliveryCount = (detail?.deliveries?.length || 0) + (detail?.deliveryContext?.latestDelivery ? 1 : 0)
    const nextActionCount = detail?.nextAllowedActions?.length || detail?.nextActions?.length || 0
    const blockers = [
        href ? '' : 'missing_case_detail_route',
        detail ? '' : 'case_detail_not_loaded',
        detail && !workflowEventCount && !timelineCount ? 'missing_replay_timeline' : '',
        detail && !nextActionCount ? 'missing_next_action_payloads' : '',
    ].filter(Boolean)
    const status: WorkbenchWorkflowStep['status'] = !href || blockers.includes('missing_replay_timeline')
        ? 'blocked'
        : blockers.length
            ? 'needs_action'
            : 'ready'
    const routeText = href ? `Open ${href}` : 'Case package is syncing the case detail route.'
    const detailText = detail
        ? `${routeText}; ${workflowEventCount} workflow event${workflowEventCount === 1 ? '' : 's'}, ${timelineCount} timeline row${timelineCount === 1 ? '' : 's'}, ${deliveryCount} delivery row${deliveryCount === 1 ? '' : 's'}.`
        : routeText
    return {
        status,
        href,
        detail: detailText,
        blockers,
        workflowEventCount,
        timelineCount,
        deliveryCount,
        nextActionCount,
    }
}

export function watchlistLedgerHref(orgContext: WorkbenchOrgContext | undefined) {
    return findingsWatchlistLedgerHref(ledgerScope(orgContext))
}

export function deliveryLedgerHref(orgContext: WorkbenchOrgContext | undefined, selected?: WorkbenchCase, delivery?: WorkbenchDeliveryEvidence | CaseDelivery) {
    return findingsDeliveryLedgerHref({
        ...ledgerScope(orgContext),
        alertId: selected?.kind === 'dwm_alert' ? selected.id : undefined,
        deliveryId: delivery?.id,
        webhookDestinationId: delivery?.webhookDestinationId,
    })
}

function ledgerScope(orgContext: WorkbenchOrgContext | undefined) {
    return {
        organizationId: orgContext?.organization?.id || orgContext?.scope.organizationId || undefined,
        tenantId: orgContext?.scope.tenantId,
    }
}

export function organizationWebhookDestinationHref(organizationId: string, webhookDestinationId: string) {
    const params = new URLSearchParams()
    params.set('destinationId', webhookDestinationId)
    return `/api/organizations/${encodeURIComponent(organizationId)}/webhooks?${params.toString()}`
}

export function alertSourceProfileHref(detail: AlertDetailPayload | undefined) {
    const evidence = detail?.alert?.evidence || []
    const sourceId = evidence
        .map(item => typeof item.provenance === 'object' ? stringValue(item.provenance?.sourceId) : undefined)
        .find(Boolean)
    return sourceProfileHref(sourceId)
}

export function sourceProfileHref(sourceId: string | undefined) {
    return sourceId ? `/ti/sources/${encodeURIComponent(sourceId)}` : undefined
}

export function latestDeliveryForActionRail(selected: WorkbenchCase, caseDetail: CaseDetailState | undefined, actionDeliveries: WorkbenchDeliveryEvidence[], orgContext: WorkbenchOrgContext | undefined) {
    const detailDeliveries = caseDetail?.status === 'ready' ? caseDetail.detail.deliveries || [] : []
    return [...detailDeliveries, ...actionDeliveries, ...(selected.deliveryEvidence || []), orgContext?.readiness.latestDelivery]
        .filter((delivery): delivery is WorkbenchDeliveryEvidence | CaseDelivery => Boolean(delivery?.id))
        .sort((a, b) => String(b.attemptedAt ?? '').localeCompare(String(a.attemptedAt ?? '')))[0]
}

export function hasSendDeliveryDestination(action: WorkbenchAction | undefined, orgContext: WorkbenchOrgContext | undefined) {
    const activeWebhook = orgContext?.webhookDestinations.find(item => item.status === 'active')
    return Boolean(activeWebhook || stringValue(action?.body?.webhookDestinationId) || stringValue(action?.body?.webhookUrl))
}
