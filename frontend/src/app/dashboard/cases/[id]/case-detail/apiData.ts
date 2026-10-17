import type { CaseDetail } from './contracts'
import type { DeliveryRow, ReceiverReceipt, WebhookDestination } from './evidenceTypes'
import { orderDeliveries } from '@/app/dashboard/deliveryOrdering'

export function orderCaseDeliveries(rows: DeliveryRow[]) {
    return orderDeliveries(rows)
}

export function deliveryRowsFromApi(payload: Record<string, unknown>): DeliveryRow[] {
    const rows = Array.isArray(payload.deliveryLedger) ? payload.deliveryLedger : []
    return rows
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
        .map(row => {
            const response = row.response && typeof row.response === 'object' && !Array.isArray(row.response) ? row.response as Record<string, unknown> : {}
            const destination = row.redactedDestination && typeof row.redactedDestination === 'object' && !Array.isArray(row.redactedDestination) ? row.redactedDestination as Record<string, unknown> : {}
            return {
                id: String(row.deliveryId || row.requestId || ''),
                requestId: String(row.requestId || row.deliveryId || ''),
                auditEventId: stringValue(row.auditEventId),
                alertId: stringValue(row.alertId),
                organizationId: stringValue(row.orgId),
                webhookDestinationId: stringValue(row.destinationId),
                status: stringValue(row.rawStatus) || stringValue(row.status),
                attemptedAt: stringValue(row.attemptedAt),
                endpointHash: stringValue(destination.endpointHash),
                endpointHint: stringValue(destination.endpointHint) || stringValue(row.redactedEndpointLabel),
                payloadHash: stringValue(row.payloadHash),
                dedupeKey: stringValue(row.dedupeKey),
                idempotencyKey: stringValue(row.idempotencyKey),
                dryRun: row.dryRun === true,
                httpStatus: typeof row.responseStatus === 'number' ? row.responseStatus : typeof response.httpStatus === 'number' ? response.httpStatus : undefined,
                error: stringValue(row.error),
                errorClass: stringValue(row.errorClass),
                attemptCount: typeof row.attemptCount === 'number' ? row.attemptCount : null,
                nextRetryAt: stringValue(row.nextRetryAt) || null,
                retryable: row.retryable === true,
                reportValidation: stringValue(row.reportValidation),
                reportExportChecksum: stringValue(row.reportExportChecksum),
                reportCaseId: stringValue(row.reportCaseId),
                thirdPartyReport: row.thirdPartyReport === true,
            }
        })
        .filter(row => Boolean(row.id))
}

export function receiverReceiptRowsFromApi(payload: Record<string, unknown>): ReceiverReceipt[] {
    const rows = Array.isArray(payload.receipts) ? payload.receipts : []
    return rows
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
        .map(row => ({
            id: stringValue(row.id),
            destinationId: stringValue(row.destinationId),
            deliveryId: stringValue(row.deliveryId),
            idempotencyKey: stringValue(row.idempotencyKey),
            payloadHash: stringValue(row.payloadHash),
            reportCaseId: stringValue(row.reportCaseId),
            reportExportChecksum: stringValue(row.reportExportChecksum),
            receivedAt: stringValue(row.receivedAt),
            persistedAt: stringValue(row.persistedAt),
        }))
        .filter(row => Boolean(row.id))
}

export function destinationRowsFromApi(payload: Record<string, unknown>): WebhookDestination[] {
    const rows = Array.isArray(payload.destinations) ? payload.destinations : []
    return rows
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
        .map(row => ({
            id: String(row.id || ''),
            name: stringValue(row.name),
            kind: stringValue(row.kind),
            endpointHint: stringValue(row.endpointHint),
            status: stringValue(row.status),
        }))
        .filter(row => Boolean(row.id) && row.status === 'active')
}

export function deliveryContextFromApi(deliveries: DeliveryRow[]): NonNullable<CaseDetail['deliveryContext']> {
    const failed = deliveries.filter(delivery => delivery.status === 'failed')
    return {
        deliveryCount: deliveries.length,
        latestDelivery: deliveries[0],
        delivered: deliveries.some(delivery => delivery.status === 'delivered'),
        retryable: failed.some(delivery => delivery.retryable === true),
        failed,
    }
}

function stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
