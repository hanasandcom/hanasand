import type { DashboardSourceProofProxyPayload } from './payloadTypes'
import type { AlertProofRow, DeliveryProofRow, AnalystCaseProofRow } from './readinessInputTypes'

export function isDurableDelivered(status: unknown): boolean {
    return status === 'delivered'
}

export function chooseDashboardAlert(alerts: AlertProofRow[], deliveries: DeliveryProofRow[]) {
    const deliveryAlertIds = new Set(deliveries.filter(row => isDurableDelivered(row.status)).map(row => row.alertId).filter(Boolean))
    return alerts.find(row => row.id && deliveryAlertIds.has(row.id)) || alerts.find(row => row.id)
}

export function chooseDeliveryForAlert(alertId: string | undefined, deliveries: DeliveryProofRow[]) {
    if (!alertId) return undefined
    return deliveries.find(row => row.alertId === alertId && isDurableDelivered(row.status))
}

export function chooseCaseForAlert(alertId: string | undefined, cases: AnalystCaseProofRow[]) {
    if (!alertId) return undefined
    return cases.find(row => row.alertId === alertId && !['closed', 'false_positive', 'suppressed'].includes(row.status || ''))
}

export function sourceProxyHealth(input: DashboardSourceProofProxyPayload | undefined) {
    return Boolean(input?.ok && input.endpoints?.sourceInventory?.ok)
}

export function sourceProxyHasFreshWorker(input: DashboardSourceProofProxyPayload | undefined) {
    const worker = input?.sourcePacks?.workerReadiness || input?.sourcePacks?.readiness
    return Boolean(sourceProxyHealth(input) && worker && Number(worker.collectionReadyRows ?? 0) > 0)
}
