import type { DwmAlertWebhookMissingDeliveryIntent } from '../dispatchPlanning.ts'
import type { DwmAlertEventType } from '../../webhookDestinationTypes.ts'
import { hashValue as hashWebhookValue } from '../../webhookTransport.ts'
import { recordSkippedDwmWebhookDelivery } from './record-skipped-dwm-webhook-delivery.ts'

export async function recordMissingDestinationDwmWebhookDelivery({
    ownerId,
    eventType,
    alert,
    dryRun,
    intent,
}: {
    ownerId: string
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    dryRun: boolean
    intent: DwmAlertWebhookMissingDeliveryIntent
}) {
    return recordSkippedDwmWebhookDelivery({
        ownerId,
        orgId: intent.orgId,
        destinationId: null,
        payloadDestination: {
            id: intent.requestedDestinationId || 'missing_destination',
            kind: 'webhook',
            name: 'Missing webhook destination',
            org_id: intent.orgId,
        },
        endpointHint: intent.requestedDestinationId ? 'requested_destination_not_found' : 'no_webhook_destination',
        endpointHash: intent.requestedDestinationId ? hashWebhookValue('endpoint', intent.requestedDestinationId) : 'no_webhook_destination',
        eventType,
        alert,
        dryRun,
        idempotencyKey: intent.idempotencyKey,
        error: intent.error,
        reason: intent.reason,
        additionalAuditMetadata: {
            requestedDestinationId: intent.requestedDestinationId,
        },
    })
}
