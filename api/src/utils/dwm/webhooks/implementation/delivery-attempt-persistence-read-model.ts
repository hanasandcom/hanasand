import { type DwmWebhookDeliveryEvidenceOptions } from './webhook-contract-types.ts'
import { buildDwmWebhookDeliveryAttemptPersistenceReadModelFromProjection } from './delivery-attempt-persistence-read-model-from-projection.ts'
import { prepareDwmWebhookDeliveryProjectionContext } from './webhook-visibility-decision.ts'
import { clean } from '../../webhookValueUtils.ts'
import type { DwmWebhookDeliveryPublic } from './webhook-contract-types.ts'

export function buildDwmWebhookDeliveryAttemptPersistenceReadModel({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: DwmWebhookDeliveryEvidenceOptions) {
    return buildDwmWebhookDeliveryAttemptPersistenceReadModelFromProjection({
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        context: prepareDwmWebhookDeliveryProjectionContext({ deliveries, auditEvents, filters }),
    })
}


export function indexWebhookDeliveriesByIdempotencyKey(deliveries: DwmWebhookDeliveryPublic[]) {
    const indexed = new Map<string, DwmWebhookDeliveryPublic[]>()
    for (const delivery of deliveries) {
        const idempotencyKey = clean(delivery.idempotencyKey)
        if (!idempotencyKey) continue
        const attempts = indexed.get(idempotencyKey) || []
        attempts.push(delivery)
        indexed.set(idempotencyKey, attempts)
    }
    return indexed
}
