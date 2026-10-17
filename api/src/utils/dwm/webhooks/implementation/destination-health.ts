import { type DwmWebhookDestinationPublic, type DwmWebhookDeliveryPublic, type DwmWebhookAuditPublic } from './webhook-contract-types.ts'
import { prepareDwmWebhookDestinationProjection, buildDwmWebhookDestinationHealthFromProjection } from './dwm-webhook-destination-projection.ts'

export function buildDwmWebhookDestinationHealth({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const projection = prepareDwmWebhookDestinationProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    return buildDwmWebhookDestinationHealthFromProjection({ ...projection, liveDeliveryEnabled })
}

type DestinationHealth = ReturnType<typeof buildDwmWebhookDestinationHealth>[number]

export function destinationTestHealthSummary(health: DestinationHealth | null) {
    return health
        ? {
            status: health.health,
            ready: health.ready,
            blockers: health.blockers,
            lastTest: health.lastTest,
            latestAuditEventId: health.latestAuditEventId,
        }
        : null
}
