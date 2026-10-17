import { buildDwmWebhookDeliveryTimelineFromReceipts } from '../deliveryTimeline.ts'
import { type DwmWebhookDeliveryEvidenceAccessOptions } from './webhook-contract-types.ts'
import { buildDwmWebhookDeliveryReceipts } from './delivery-receipts.ts'
import { buildDwmWebhookDeliveryProjectionBundle } from '../../webhookDeliveryOperations.ts'
import { buildDwmWebhookDeliveryRetryPersistenceFromProjection } from '../../webhookDeliveryRetryPersistence.ts'
import { type DwmWebhookDeliveryPublic, type DwmWebhookAuditPublic, type DwmWebhookDestinationPublic, type DwmWebhookDeliveryEvidenceFilters } from './webhook-contract-types.ts'

export function buildDwmWebhookDeliveryTimeline({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDeliveryEvidenceAccessOptions) {
    const receipts = buildDwmWebhookDeliveryReceipts({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    return buildDwmWebhookDeliveryTimelineFromReceipts(receipts, liveDeliveryEnabled)
}


export function buildDwmWebhookDeliveryRetryPersistence({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    now = new Date(),
}: {
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    destinations?: DwmWebhookDestinationPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
    now?: Date
}) {
    const { ledger, auditContracts } = buildDwmWebhookDeliveryProjectionBundle({ deliveries, auditEvents, destinations, filters, now })
    return buildDwmWebhookDeliveryRetryPersistenceFromProjection({ destinations, filters, liveDeliveryEnabled, ledger, auditContracts })
}
