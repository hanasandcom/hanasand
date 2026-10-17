import { buildDwmWebhookDeliveryPersistenceProofFromHistory } from '../deliveryPersistenceProof.ts'
import { buildDwmWebhookDeliveryHistoryConsumerProjection } from '../deliveryHistoryConsumer.ts'
import { buildDwmWebhookDeliveryReadinessConsumerProjection } from '../deliveryReadinessConsumer.ts'
import { normalizeWebhookEvidenceFilters } from '../../webhookDeliveryEvidence.ts'
import { type DwmWebhookDeliveryEvidenceOptions, type DwmWebhookDeliveryEvidenceAccessOptions } from './webhook-contract-types.ts'
import { prepareDwmWebhookDeliveryProjectionContext, webhookDeliveryVisibilityAccess, buildDwmWebhookDeliveryHistory } from './webhook-visibility-decision.ts'
import { buildDwmWebhookDeliveryHistoryWithRetryPersistence } from './delivery-history-with-retry-persistence.ts'
import { buildDwmWebhookDeliveryAttemptPersistenceReadModelFromProjection } from './delivery-attempt-persistence-read-model-from-projection.ts'
import { retryQueueBlocker } from './retry-queue-blocker.ts'

export function buildDwmWebhookDeliveryHistoryConsumerProof({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: DwmWebhookDeliveryEvidenceOptions) {
    const now = new Date()
    const context = prepareDwmWebhookDeliveryProjectionContext({ deliveries, auditEvents, filters, now })
    const { history } = buildDwmWebhookDeliveryHistoryWithRetryPersistence({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        now,
        context,
    })
    const attempts = buildDwmWebhookDeliveryAttemptPersistenceReadModelFromProjection({
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        context,
    })
    return buildDwmWebhookDeliveryHistoryConsumerProjection(history, attempts, liveDeliveryEnabled)
}

export function buildDwmWebhookDeliveryReadinessConsumerProof({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDeliveryEvidenceAccessOptions) {
    const { decision, access } = webhookDeliveryVisibilityAccess(visibility, viewerRole, canManage)
    const normalizedFilters = normalizeWebhookEvidenceFilters(filters)
    const permissionBlocker = retryQueueBlocker('permission_denied', 'Webhook delivery readiness is not visible for this organization membership.', normalizedFilters.destinationId, true)

    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.delivery_readiness_consumer.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            filters: normalizedFilters,
            routeContract: {
                list: {
                    method: 'GET' as const,
                    route: '/api/dwm/webhook-deliveries',
                    requiredQuery: ['orgId'],
                    optionalQuery: ['destinationId', 'alertId', 'casePath', 'dedupeKey', 'deliveryId'],
                    noNetwork: true,
                },
                retryDryRun: {
                    method: 'POST' as const,
                    route: '/api/dwm/webhook-deliveries',
                    requiredBody: ['orgId', 'destinationId', 'alertId', 'dedupeKey', 'dryRun'],
                    noNetworkDefault: true,
                },
            },
            counts: {
                total: 0,
                success: 0,
                retryableFailure: 0,
                nonRetryableFailure: 0,
                idempotentReplay: 0,
                redactedDryRun: 0,
                crossOrgDenied: 1,
                auditLinked: 0,
            },
            rows: [],
            blockers: [permissionBlocker],
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                responseBodyExposed: false,
                webhookSecretExposed: false,
            },
        }
    }

    const history = buildDwmWebhookDeliveryHistoryConsumerProof({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
    })
    return buildDwmWebhookDeliveryReadinessConsumerProjection(history, decision, access, liveDeliveryEnabled)
}

export function buildDwmWebhookDeliveryPersistenceProof({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: DwmWebhookDeliveryEvidenceOptions) {
    const history = buildDwmWebhookDeliveryHistory({ deliveries, auditEvents, destinations, filters, liveDeliveryEnabled })
    return buildDwmWebhookDeliveryPersistenceProofFromHistory(history, liveDeliveryEnabled)
}
