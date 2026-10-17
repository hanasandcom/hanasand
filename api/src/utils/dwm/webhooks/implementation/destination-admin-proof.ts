import { type DwmWebhookDestinationVisibilityOptions } from './webhook-contract-types.ts'
import { buildDwmWebhookDestinationAdminProofFromProjection } from './destination-admin-proof-from-projection.ts'
import { prepareDwmWebhookDestinationProjection, buildDwmWebhookDestinationHealthFromProjection } from './dwm-webhook-destination-projection.ts'
import { buildDwmWebhookDestinationLifecycleFromProjection } from './destination-lifecycle-from-projection.ts'

export function buildDwmWebhookDestinationAdminProof(options: DwmWebhookDestinationVisibilityOptions) {
    return buildDwmWebhookDestinationAdminProofFromProjection(options)
}

export function buildDwmWebhookDestinationReadModels({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDestinationVisibilityOptions) {
    const projection = prepareDwmWebhookDestinationProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    const destinationHealth = buildDwmWebhookDestinationHealthFromProjection({ ...projection, liveDeliveryEnabled })
    const destinationLifecycle = buildDwmWebhookDestinationLifecycleFromProjection({
        destinations,
        auditContracts: projection.auditContracts,
        healthRows: destinationHealth,
        viewerRole,
        canManage,
    })
    const destinationAdminProof = buildDwmWebhookDestinationAdminProofFromProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
        projection,
        healthRows: destinationHealth,
        lifecycleRows: destinationLifecycle,
    })

    return {
        destinationContracts: projection.destinationContracts,
        deliveryReadiness: projection.readiness,
        destinationHealth,
        destinationLifecycle,
        destinationAdminProof,
    }
}
