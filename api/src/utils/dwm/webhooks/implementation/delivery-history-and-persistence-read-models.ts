import { buildDwmWebhookDeliveryPersistenceProofFromHistory } from '../deliveryPersistenceProof.ts'
import { type DwmWebhookDeliveryEvidenceOptions } from './webhook-contract-types.ts'
import { prepareDwmWebhookDeliveryProjectionContext } from './webhook-visibility-decision.ts'
import { buildDwmWebhookDeliveryHistoryWithRetryPersistence } from './delivery-history-with-retry-persistence.ts'

export function buildDwmWebhookDeliveryHistoryAndPersistenceReadModels({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: DwmWebhookDeliveryEvidenceOptions) {
    const now = new Date()
    const context = prepareDwmWebhookDeliveryProjectionContext({ deliveries, auditEvents, filters, now })
    const { history, retryPersistence } = buildDwmWebhookDeliveryHistoryWithRetryPersistence({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        now,
        context,
    })

    return {
        history,
        persistenceProof: buildDwmWebhookDeliveryPersistenceProofFromHistory(history, liveDeliveryEnabled),
        retryPersistence,
    }
}
