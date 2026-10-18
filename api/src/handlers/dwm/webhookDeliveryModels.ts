import {
    buildDwmWebhookDeliveryActionPlan,
    buildDwmWebhookDeliveryAuditTrail,
    buildDwmWebhookDeliveryReceipts,
    buildDwmWebhookDeliveryReplayGuard,
    buildDwmWebhookDeliveryRetryQueue,
    buildDwmWebhookDeliveryRetryRequestContract,
    buildDwmWebhookDeliveryRetryWorkOrders,
    buildDwmWebhookDeliveryTimeline,
    buildDwmWebhookDestinationDeliveryMatrix,
} from '#utils/dwm/webhooks.ts'

type EvidenceModelInput = Parameters<typeof buildDwmWebhookDeliveryReceipts>[0]
type RetryModelInput = Parameters<typeof buildDwmWebhookDeliveryRetryQueue>[0]
    & Pick<Parameters<typeof buildDwmWebhookDeliveryAuditTrail>[0], 'auditEvents'>

export function buildDwmWebhookDeliveryEvidenceModels(input: EvidenceModelInput) {
    return {
        deliveryReceipts: buildDwmWebhookDeliveryReceipts(input),
        deliveryTimeline: buildDwmWebhookDeliveryTimeline(input),
        deliveryActionPlan: buildDwmWebhookDeliveryActionPlan(input),
        deliveryReplayGuard: buildDwmWebhookDeliveryReplayGuard(input),
    }
}

export function buildDwmWebhookDeliveryRetryModels(input: RetryModelInput) {
    return {
        deliveryRetryQueue: buildDwmWebhookDeliveryRetryQueue(input),
        deliveryRetryRequest: buildDwmWebhookDeliveryRetryRequestContract(input),
        deliveryRetryWorkOrders: buildDwmWebhookDeliveryRetryWorkOrders(input),
        destinationDeliveryMatrix: buildDwmWebhookDestinationDeliveryMatrix({
            destinations: input.destinations,
            deliveries: input.deliveries,
            auditEvents: input.auditEvents,
            liveDeliveryEnabled: input.liveDeliveryEnabled,
            viewerRole: input.viewerRole,
            canManage: input.canManage,
            visibility: input.visibility,
        }),
        deliveryAuditTrail: buildDwmWebhookDeliveryAuditTrail(input),
    }
}
