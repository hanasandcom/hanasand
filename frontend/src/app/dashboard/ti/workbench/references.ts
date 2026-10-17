import type { RuntimeDwmAlert } from './runtimeAlert'

export type FindingsLedgerScope = {
    organizationId?: string
    tenantId?: string
    alertId?: string
    deliveryId?: string
    webhookDestinationId?: string
}

export function alertCaseReference(alert: RuntimeDwmAlert) {
    return {
        caseId: alert.caseId ?? alert.customerReadiness?.caseHandoff?.caseId
            ?? alert.customerReadiness?.caseHandoff?.caseIdCandidate ?? alert.caseIdCandidate
            ?? alert.workflowContext?.caseIdCandidate,
        casePath: alert.casePath ?? alert.customerReadiness?.caseHandoff?.casePath
            ?? alert.workflowSummary?.casePath ?? alert.workflowContext?.casePath,
    }
}

export function alertCaseDetailHref(input: FindingsLedgerScope & { caseId?: string, casePath?: string, alertId: string }) {
    const caseId = input.caseId ?? caseIdFromPath(input.casePath)
    if (!caseId) return undefined
    const params = new URLSearchParams()
    if (input.organizationId) params.set('organizationId', input.organizationId)
    if (input.tenantId) params.set('tenantId', input.tenantId)
    params.set('alertId', input.alertId)
    params.set('route', 'ti_workbench')
    return `/cases/${encodeURIComponent(caseId)}?${params.toString()}`
}

export function findingsWatchlistLedgerHref(scope: FindingsLedgerScope) {
    return findingsLedgerHref('/api/findings/watchlists', scope, ['organizationId', 'tenantId'])
}

export function findingsDeliveryLedgerHref(scope: FindingsLedgerScope) {
    return findingsLedgerHref('/api/findings/webhooks/deliveries', scope, [
        'organizationId', 'tenantId', 'alertId', 'deliveryId', 'webhookDestinationId',
    ])
}

function findingsLedgerHref(path: string, scope: FindingsLedgerScope, keys: Array<keyof FindingsLedgerScope>) {
    const params = new URLSearchParams()
    for (const key of keys) {
        const value = scope[key]
        if (key === 'alertId' ? value !== undefined : Boolean(value)) params.set(key, value!)
    }
    const query = params.toString()
    return query ? `${path}?${query}` : path
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
