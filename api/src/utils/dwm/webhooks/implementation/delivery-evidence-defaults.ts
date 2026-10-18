import type { DwmWebhookDeliveryEvidenceAccessOptions } from './webhook-contract-types.ts'

export function deliveryEvidenceAccessDefaults(options: DwmWebhookDeliveryEvidenceAccessOptions) {
    return {
        deliveries: options.deliveries,
        auditEvents: options.auditEvents === undefined ? [] : options.auditEvents,
        destinations: options.destinations === undefined ? [] : options.destinations,
        filters: options.filters === undefined ? {} : options.filters,
        liveDeliveryEnabled: options.liveDeliveryEnabled === undefined
            ? process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true'
            : options.liveDeliveryEnabled,
        viewerRole: options.viewerRole === undefined ? null : options.viewerRole,
        canManage: options.canManage === undefined ? false : options.canManage,
        visibility: options.visibility === undefined ? null : options.visibility,
    }
}
