import { clean, cleanList, makeWebhookBlocker, makeWebhookBlockerWithFields, recordOrEmpty } from '../../webhookValueUtils.ts'
import { type DwmWebhookDeliveryOperationBlockerCode } from './webhook-contract-types.ts'
import { type buildDwmWebhookDeliveryHistory } from './webhook-visibility-decision.ts'

export const retryQueueBlocker = makeWebhookBlocker

export const auditTrailBlocker = makeWebhookBlocker

export const testContractBlocker = makeWebhookBlocker

export const destinationMatrixBlocker = makeWebhookBlocker

export const alertReadinessBlocker = makeWebhookBlocker

export const orgAlertOutcomeBlocker = makeWebhookBlocker

export const alertDeliveryProofBlocker = makeWebhookBlocker

export function operationBlocker(
    code: DwmWebhookDeliveryOperationBlockerCode,
    message: string,
    destinationId: string | null = null,
    retryable = false
) {
    return makeWebhookBlockerWithFields(code, message, destinationId, { retryable })
}

export function deliveryProvenanceIds(value: unknown) {
    const record = recordOrEmpty(value)
    return {
        captureIds: cleanList(record.captureIds).slice(0, 5),
        sourceIds: cleanList(record.sourceIds).slice(0, 5),
        primaryCaptureId: clean(record.primaryCaptureId) || null,
    }
}

export function deliveryReceiptContext(entry: ReturnType<typeof buildDwmWebhookDeliveryHistory>['entries'][number]) {
    return {
        org: { id: entry.orgId },
        alert: {
            id: entry.alert.id,
            title: entry.alert.title,
            severity: entry.alert.severity,
            sourceFamily: entry.alert.sourceFamily,
            evidenceCount: entry.alert.evidenceCount,
        },
        watchlist: {
            id: entry.watchlist.id,
            term: entry.watchlist.terms[0] || entry.watchlist.name || null,
            name: entry.watchlist.name,
        },
        provenance: {
            ...entry.alert.provenanceIds,
            summary: entry.alert.provenanceSummary || null,
        },
    }
}
