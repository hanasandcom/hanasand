import { buildDwmWebhookDeliveryRetryWorkOrdersProjection } from '../deliveryRetryWorkOrders.ts'
import { buildDwmWebhookDestinationDeliveryMatrixProjection } from '../destinationDeliveryMatrix.ts'
import { buildDwmWebhookDestinationLookupProjection } from '../destinationLookupProjection.ts'
import { buildDwmWebhookAuditEventContracts } from '../../webhookAuditContracts.ts'
import { buildDwmWebhookDeliveryOperations } from '../../webhookDeliveryOperations.ts'
import { type DwmWebhookDestinationDeliveryAccessOptions, type DwmWebhookDestinationVisibilityOptions } from './webhook-contract-types.ts'
import { buildDwmWebhookDeliveryRetryRequestContract } from './delivery-retry-request-contract.ts'
import { webhookVisibilityDecision, webhookAccess } from './webhook-visibility-decision.ts'
import { destinationMatrixBlocker } from './retry-queue-blocker.ts'
import { buildDwmWebhookDestinationHealth } from './destination-health.ts'
import { buildDwmWebhookDeliveryRetryQueue } from './delivery-retry-queue.ts'
import { destinationHealthStates } from './webhook-setup-routes.ts'
import { buildDwmWebhookDestinationAdminProof } from './destination-admin-proof.ts'

export function buildDwmWebhookDeliveryRetryWorkOrders({
    destinations,
    deliveries = [],
    auditEvents = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDestinationDeliveryAccessOptions) {
    const retryRequest = buildDwmWebhookDeliveryRetryRequestContract({
        destinations,
        deliveries,
        auditEvents,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    return buildDwmWebhookDeliveryRetryWorkOrdersProjection(retryRequest, liveDeliveryEnabled)
}

export function buildDwmWebhookDestinationDeliveryMatrix({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDestinationVisibilityOptions) {
    const decision = webhookVisibilityDecision(visibility)
    const access = webhookAccess(decision, viewerRole, canManage, ['canManage', 'canTest', 'canRetry'] as const)
    if (!decision.allowed) {
        const blocker = destinationMatrixBlocker('permission_denied', 'Webhook destination delivery matrix is not visible for this organization membership.', null, true)
        return {
            schemaVersion: 'dwm.webhook.destination_delivery_matrix.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            visibility: decision,
            access,
            summary: {
                destinationCount: 0,
                activeDestinationCount: 0,
                deliveryConfiguredCount: 0,
                retryReadyCount: 0,
                blockedCount: 0,
                latestDeliveryAt: null,
            },
            blockers: [blocker],
            destinations: [],
            routes: {
                destinationList: 'GET /api/dwm/webhooks?orgId=<org_id>',
                deliveryList: 'GET /api/dwm/webhook-deliveries?orgId=<org_id>&destinationId=<destination_id>',
                testDestination: 'POST /api/dwm/webhook-destinations/:id/test',
                triggerDelivery: 'POST /api/dwm/webhook-deliveries',
            },
        }
    }

    const healthRows = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const operations = buildDwmWebhookDeliveryOperations({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const retryQueue = buildDwmWebhookDeliveryRetryQueue({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility: null,
    })
    const auditContracts = buildDwmWebhookAuditEventContracts({ destinations, deliveries, auditEvents })
    return buildDwmWebhookDestinationDeliveryMatrixProjection({
        destinations,
        healthRows,
        operations,
        retryQueue,
        auditContracts,
        liveDeliveryEnabled,
        decision,
        access,
        healthStates: destinationHealthStates,
    })
}

export function buildDwmWebhookDestinationLookupContract({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDestinationVisibilityOptions) {
    const matrix = buildDwmWebhookDestinationDeliveryMatrix({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const adminProof = buildDwmWebhookDestinationAdminProof({
        destinations: matrix.destinations.length ? destinations : [],
        deliveries: matrix.destinations.length ? deliveries : [],
        auditEvents: matrix.destinations.length ? auditEvents : [],
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    return buildDwmWebhookDestinationLookupProjection(matrix, adminProof, liveDeliveryEnabled, canManage)
}
