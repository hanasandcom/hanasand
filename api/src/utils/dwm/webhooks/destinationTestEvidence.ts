import type { toDwmWebhookDelivery } from '../webhookDestinationModels.ts'
import type { toDwmWebhookDestination } from '../webhookDestinationModels.ts'
import { redactDeliveryEvidenceText } from '../webhookDeliveryUtilities.ts'
import { buildDwmAlertDeliveryPayload } from './alertDeliveryPayload.ts'
import { buildDwmWebhookDeliveryPreview } from './deliveryPreview.ts'
import { buildDwmWebhookDestinationTestPayloadPreview, buildDwmWebhookTestAlert } from './payloadPreviews.ts'

type Delivery = ReturnType<typeof toDwmWebhookDelivery>
type Destination = ReturnType<typeof toDwmWebhookDestination>

export function buildDwmWebhookDestinationTestEvidence(
    destination: Destination | null,
    deliveries: Delivery[],
) {
    const destinationId = destination?.id || null
    const scopedDeliveries = destinationId
        ? deliveries
            .filter(delivery => delivery.destinationId === destinationId && delivery.eventType === 'dwm.alert.test')
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        : []
    const latestTest = scopedDeliveries[0] || null
    const persistedLastTest = destination?.lastTestStatus
        ? {
            requestId: null,
            deliveryId: null,
            status: destination.lastTestStatus === 'delivered' ? 'unknown' : destination.lastTestStatus,
            dryRun: null,
            live: false,
            responseStatus: destination.lastTestHttpStatus,
            error: destination.lastTestError ? redactDeliveryEvidenceText(destination.lastTestError) : null,
            attemptedAt: destination.lastTestedAt,
            payloadHash: null,
            idempotencyKey: null,
            source: 'destination_persistence',
        }
        : null
    const preview = latestTest ? buildDwmWebhookDeliveryPreview(latestTest) : null
    const testPayload = destination
        ? buildDwmAlertDeliveryPayload({
            destination: {
                id: destination.id,
                kind: destination.kind,
                name: destination.name,
                org_id: destination.orgId,
            },
            alert: buildDwmWebhookTestAlert({ org_id: destination.orgId }, ''),
            eventType: 'dwm.alert.test',
            deliveryId: `destination-test-preview:${destination.id}`,
        })
        : null
    const dryRunPayloadPreview = testPayload ? buildDwmWebhookDestinationTestPayloadPreview(testPayload) : null

    return { destinationId, latestTest, persistedLastTest, preview, testPayload, dryRunPayloadPreview }
}
