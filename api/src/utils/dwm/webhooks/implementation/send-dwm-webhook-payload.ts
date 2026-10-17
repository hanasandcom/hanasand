import type { DwmAlertWebhookSkippedDeliveryIntent } from '../dispatchPlanning.ts'
import type { DwmAlertEventType, DwmWebhookDeliveryRow, DwmWebhookDestinationRow } from '../../webhookDestinationTypes.ts'
import { decryptWebhookTarget } from '../../webhookDestinationSecrets.ts'
import { sanitizeDwmWebhookDeliveryDiagnostic } from '../../webhookDeliveryUtilities.ts'
import { recordSkippedDwmWebhookDelivery } from './record-skipped-dwm-webhook-delivery.ts'

export async function sendDwmWebhookPayload(
    destination: DwmWebhookDestinationRow,
    payloadBody: string,
    sender: (endpoint: string, body: string, signingSecret?: string) => Promise<{ status: number, body: string }>
): Promise<{
    status: 'delivered' | 'failed'
    responseStatus: number | null
    responseBody: string | null
    error: string | null
}> {
    try {
        const target = decryptWebhookTarget(destination.endpoint_encrypted)
        const response = await sender(target.endpoint, payloadBody, target.signingSecret)
        const status = response.status >= 200 && response.status < 300 ? 'delivered' : 'failed'
        return {
            status,
            responseStatus: response.status,
            responseBody: sanitizeDwmWebhookDeliveryDiagnostic(response.body),
            error: status === 'delivered' ? null : sanitizeDwmWebhookDeliveryDiagnostic(`Webhook returned HTTP ${response.status}.`),
        }
    } catch (sendError) {
        return {
            status: 'failed' as const,
            responseStatus: null,
            responseBody: null,
            error: sanitizeDwmWebhookDeliveryDiagnostic(sendError instanceof Error ? sendError.message : String(sendError)),
        }
    }
}

export async function recordSkippedDuplicateDwmWebhookDelivery({
    ownerId,
    destination,
    eventType,
    alert,
    priorDelivery,
}: {
    ownerId: string
    destination: DwmWebhookDestinationRow
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    priorDelivery: DwmWebhookDeliveryRow
}) {
    return recordSkippedDwmWebhookDelivery({
        ownerId,
        orgId: destination.org_id,
        destinationId: destination.id,
        payloadDestination: destination,
        endpointHint: destination.endpoint_hint,
        endpointHash: destination.endpoint_hash,
        eventType,
        alert,
        dryRun: false,
        error: 'Delivery skipped because this destination already has a delivered attempt for the same idempotency key.',
        reason: 'duplicate_delivered_idempotency_key',
        additionalAuditMetadata: {
            priorDeliveryId: priorDelivery.id,
            priorDeliveredAt: priorDelivery.delivered_at,
        },
    })
}

export async function recordSkippedSelectionDwmWebhookDelivery({
    ownerId,
    destination,
    eventType,
    alert,
    dryRun,
    intent,
}: {
    ownerId: string
    destination: DwmWebhookDestinationRow
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    dryRun: boolean
    intent: DwmAlertWebhookSkippedDeliveryIntent
}) {
    return recordSkippedDwmWebhookDelivery({
        ownerId,
        orgId: destination.org_id,
        destinationId: destination.id,
        payloadDestination: destination,
        endpointHint: destination.endpoint_hint,
        endpointHash: destination.endpoint_hash,
        eventType,
        alert,
        dryRun,
        idempotencyKey: intent.idempotencyKey,
        error: intent.error,
        reason: intent.reason,
    })
}
