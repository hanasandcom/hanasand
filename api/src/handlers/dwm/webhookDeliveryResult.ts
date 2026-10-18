import type { FastifyReply } from 'fastify'
import {
    buildDwmOrgAlertWebhookDeliveryContract,
    buildDwmWebhookAuditEventContracts,
    buildDwmWebhookDeliveryAttemptContract,
    buildDwmWebhookDeliveryAttemptPersistenceProof,
    buildDwmWebhookDashboardReadinessAdapter,
    buildDwmWebhookDeliveryHistoryAndPersistenceReadModels,
    buildDwmWebhookDeliveryOperations,
    buildDwmWebhookDeliveryReadinessConsumerProof,
    buildDwmWebhookDeliveryRetryContract,
    buildDwmWebhookDestinationReadModels,
    listDwmWebhookAuditEvents,
    listDwmWebhookDeliveries,
    listDwmWebhookDestinations,
    triggerDwmAlertWebhookNotification,
    clean,
    type DwmAlertNotificationInput,
} from '#utils/dwm/webhooks.ts'
import { deliveryResponseOutcome } from './webhookResponses.ts'
import { buildDwmWebhookDeliveryEvidenceModels, buildDwmWebhookDeliveryRetryModels } from './webhookDeliveryModels.ts'

export async function sendDwmWebhookDeliveryResult(res: FastifyReply, userId: string, orgId: string, input: DwmAlertNotificationInput, deliveries: Awaited<ReturnType<typeof triggerDwmAlertWebhookNotification>>) {
    const destinations = await listDwmWebhookDestinations(userId, orgId)
    const ledgerDeliveries = await listDwmWebhookDeliveries(userId, orgId)
    const auditEvents = await listDwmWebhookAuditEvents(userId, orgId)
    const filters = {
        orgId,
        destinationId: clean(input.destinationId) || clean(input.destination_id),
        alertId: clean(input.alertId) || clean(input.alert?.id),
        casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
        dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
    }
    const deliveryAccess = { viewerRole: 'admin' as const, canManage: true }
    const destinationReadModels = buildDwmWebhookDestinationReadModels({
        destinations,
        deliveries: ledgerDeliveries,
        auditEvents,
        ...deliveryAccess,
    })
    const deliveryHistoryReadModels = buildDwmWebhookDeliveryHistoryAndPersistenceReadModels({
        deliveries: ledgerDeliveries,
        auditEvents,
        destinations,
        filters,
    })
    const response = {
        deliveries,
        deliveryReadiness: destinationReadModels.deliveryReadiness,
        destinationHealth: destinationReadModels.destinationHealth,
        destinationLifecycle: destinationReadModels.destinationLifecycle,
        destinationAdminProof: destinationReadModels.destinationAdminProof,
        deliveryOperations: buildDwmWebhookDeliveryOperations({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
        }),
        deliveryHistory: deliveryHistoryReadModels.history,
        deliveryReadinessConsumer: buildDwmWebhookDeliveryReadinessConsumerProof({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
            ...deliveryAccess,
        }),
        deliveryPersistenceProof: deliveryHistoryReadModels.persistenceProof,
        deliveryAttemptContract: buildDwmWebhookDeliveryAttemptContract({
            ownerId: userId,
            input: { ...input, orgId },
            destinations,
            deliveries: ledgerDeliveries,
        }),
        deliveryAttemptPersistence: buildDwmWebhookDeliveryAttemptPersistenceProof({
            ownerId: userId,
            input: { ...input, orgId },
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
        }),
        ...buildDwmWebhookDeliveryEvidenceModels({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
            ...deliveryAccess,
        }),
        deliveryRetry: buildDwmWebhookDeliveryRetryContract({
            ownerId: userId,
            input: { ...input, orgId },
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
            canManage: true,
        }),
        deliveryRetryPersistence: deliveryHistoryReadModels.retryPersistence,
        ...buildDwmWebhookDeliveryRetryModels({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
            ...deliveryAccess,
        }),
        dashboardReadiness: buildDwmWebhookDashboardReadinessAdapter({
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
            visibility: null,
        }),
        orgAlertDelivery: buildDwmOrgAlertWebhookDeliveryContract({
            ownerId: userId,
            input,
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
            ...deliveryAccess,
        }),
        auditEventContracts: buildDwmWebhookAuditEventContracts({ auditEvents, deliveries: ledgerDeliveries, destinations }),
        dryRunDefault: true,
        liveDeliveryEnabled: process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    }
    const outcome = deliveryResponseOutcome(deliveries)
    return res.status(outcome.status).send(outcome.failed ? { ...response, error: outcome.error, code: outcome.code } : response)
}
