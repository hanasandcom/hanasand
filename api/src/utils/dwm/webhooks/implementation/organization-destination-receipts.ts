import type { buildDwmWebhookOrganizationConsumerReceipt } from './organization-consumer-receipt.ts'
import { buildIdempotencyKey } from '../../webhookDeliveryUtilities.ts'

type ReceiptInput = Parameters<typeof buildDwmWebhookOrganizationConsumerReceipt>[0]

export function buildOrganizationDestinationReceipts({
    eventType,
    orgId,
    liveDeliveryEnabled,
    selectedDestinations,
    deliveryReadinessConsumer,
    deliveryOutcome,
    idempotencySeed,
}: Pick<ReceiptInput,
    | 'eventType'
    | 'orgId'
    | 'liveDeliveryEnabled'
    | 'selectedDestinations'
    | 'deliveryReadinessConsumer'
    | 'deliveryOutcome'
> & { idempotencySeed: string }) {
    const readinessRows = new Map(deliveryReadinessConsumer.rows.map(row => [row.destinationId, row]))
    const latestOutcomeRows = new Map(deliveryOutcome.selectedDestinations.map(destination => [destination.destinationId, destination]))
    return selectedDestinations.map((destination) => {
        const idempotencyKey = buildIdempotencyKey(eventType, orgId, destination.id, idempotencySeed)
        const readiness = readinessRows.get(destination.id) || null
        const outcome = latestOutcomeRows.get(destination.id) || null
        return {
            destinationId: destination.id,
            orgId: destination.org_id,
            label: destination.name,
            type: destination.kind,
            status: outcome?.status || destination.status,
            idempotencyKey,
            requestId: outcome?.latestAttempt?.requestId || readiness?.requestId || null,
            deliveryId: outcome?.latestAttempt?.deliveryId || readiness?.deliveryId || null,
            auditEventId: outcome?.latestAttempt?.auditEventId || readiness?.audit?.auditEventId || null,
            retry: {
                retryable: Boolean(outcome?.latestAttempt?.retryable || readiness?.readiness.retryableFailure),
                nextRetryAt: outcome?.latestAttempt?.nextRetryAt || readiness?.retry.nextRetryAt || null,
                attemptCount: outcome?.latestAttempt?.attemptCount || readiness?.retry.attemptCount || 0,
                lastErrorCategory: outcome?.latestAttempt?.errorClass || readiness?.retry.lastErrorCategory || null,
            },
            readiness: {
                success: Boolean(readiness?.readiness.success || outcome?.recorded),
                idempotentReplay: Boolean(readiness?.readiness.idempotentReplay),
                redactedDryRun: Boolean(readiness?.readiness.redactedDryRun || outcome?.latestAttempt?.dryRun),
                auditLinked: Boolean(readiness?.readiness.auditLinked || outcome?.latestAttempt?.auditEventId),
                liveBlocked: !liveDeliveryEnabled && Boolean(outcome?.latestAttempt?.live || readiness?.live),
            },
            redactedDestination: {
                endpointHash: readiness?.destination.endpointHash || null,
                endpointHint: readiness?.destination.endpointHint || null,
                endpointExposed: false,
                webhookSecretExposed: false,
            },
            routes: {
                deliveryDetail: outcome?.operationLinks?.deliveryDetail || readiness?.operationLinks.deliveryDetail || `GET /api/dwm/webhook-deliveries/${outcome?.latestAttempt?.deliveryId || readiness?.deliveryId || ':deliveryId'}`,
                retryDryRun: readiness?.operationLinks.retryDryRun || 'POST /api/dwm/webhook-deliveries',
                destinationTest: outcome?.operationLinks?.destinationTest || `POST /api/dwm/webhook-destinations/${destination.id}/test`,
            },
        }
    }
    )
}
