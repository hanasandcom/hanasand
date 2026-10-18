import {
    buildDwmWebhookAuditEventContracts,
    buildDwmWebhookDeliveryAttemptPersistenceReadModel,
    buildDwmWebhookDashboardReadinessAdapter,
    buildDwmWebhookDeliveryOperations,
    buildDwmWebhookDeliveryReadiness,
    buildDwmWebhookDeliveryReadinessConsumerProof,
    buildDwmWebhookDeliveryReplayApiContract,
    buildDwmWebhookDeliveryEvidenceAndLedger,
    buildDwmWebhookDeliveryHistoryAndPersistenceReadModels,
    buildDwmWebhookDeliveryHistoryConsumerProof,
    buildDwmWebhookDestinationReadModels,
    filterDwmWebhookDeliveryEvidenceForVisibility,
    listDwmWebhookAuditEvents,
    listDwmWebhookDeliveries,
    listDwmWebhookDestinations,
    type DwmWebhookDeliveryEvidenceFilters,
} from '#utils/dwm/webhooks.ts'
import type { destinationLifecycleAccess, webhookOrganizationVisibilityContext } from './webhookRouteOrganizations.ts'
import { buildDwmWebhookDeliveryEvidenceModels, buildDwmWebhookDeliveryRetryModels } from './webhookDeliveryModels.ts'

type Deliveries = Awaited<ReturnType<typeof listDwmWebhookDeliveries>>
type AuditEvents = Awaited<ReturnType<typeof listDwmWebhookAuditEvents>>
type Destinations = Awaited<ReturnType<typeof listDwmWebhookDestinations>>
type EvidenceAndLedger = ReturnType<typeof buildDwmWebhookDeliveryEvidenceAndLedger>
type VisibleRecords = { deliveries: Deliveries, auditEvents: AuditEvents, destinations: Destinations }

export function buildDwmWebhookDeliveryReadPayload({
    deliveries,
    auditEvents,
    destinations,
    deliveryFilters,
    evidence,
    deliveryLedger,
    visibilityResult,
    visibleRecords,
    lifecycleAccess,
    visibilityContext,
    destinationReadModels,
    deliveryHistoryReadModels,
    includeAudit,
}: {
    deliveries: Deliveries
    auditEvents: AuditEvents
    destinations: Destinations
    deliveryFilters: DwmWebhookDeliveryEvidenceFilters
    evidence: EvidenceAndLedger['evidence']
    deliveryLedger: EvidenceAndLedger['ledger']
    visibilityResult: ReturnType<typeof filterDwmWebhookDeliveryEvidenceForVisibility> | null
    visibleRecords: VisibleRecords
    lifecycleAccess: ReturnType<typeof destinationLifecycleAccess>
    visibilityContext: ReturnType<typeof webhookOrganizationVisibilityContext>
    destinationReadModels: ReturnType<typeof buildDwmWebhookDestinationReadModels>
    deliveryHistoryReadModels: ReturnType<typeof buildDwmWebhookDeliveryHistoryAndPersistenceReadModels>
    includeAudit: boolean
}) {
    const payload: Record<string, unknown> = {
        deliveries,
        deliveryEvidence: visibilityResult ? visibilityResult.deliveryEvidence : evidence,
        deliveryLedger: visibilityResult && !visibilityResult.decision.allowed ? [] : deliveryLedger,
        deliveryOperations: visibilityResult && !visibilityResult.decision.allowed
            ? {
                schemaVersion: 'dwm.webhook.delivery_operations.v1',
                liveDeliveryEnabled: process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
                filters: deliveryFilters,
                total: 0,
                counts: { queued: 0, sent: 0, failed: 0, skipped: 0, dryRun: 0, live: 0, replay: 0, retryable: 0 },
                recentDeliveries: [],
            }
            : buildDwmWebhookDeliveryOperations({ deliveries, auditEvents, destinations, filters: deliveryFilters }),
        deliveryHistory: deliveryHistoryReadModels.history,
        deliveryHistoryConsumer: buildDwmWebhookDeliveryHistoryConsumerProof({ ...visibleRecords, filters: deliveryFilters }),
        deliveryReadinessConsumer: buildDwmWebhookDeliveryReadinessConsumerProof({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryPersistenceProof: deliveryHistoryReadModels.persistenceProof,
        deliveryAttemptPersistence: buildDwmWebhookDeliveryAttemptPersistenceReadModel({ ...visibleRecords, filters: deliveryFilters }),
        ...buildDwmWebhookDeliveryEvidenceModels({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryReplayApi: buildDwmWebhookDeliveryReplayApiContract({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryRetryPersistence: deliveryHistoryReadModels.retryPersistence,
        ...buildDwmWebhookDeliveryRetryModels({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        dashboardReadiness: buildDwmWebhookDashboardReadinessAdapter({ destinations, deliveries, auditEvents, visibility: visibilityContext }),
        deliveryReadiness: buildDwmWebhookDeliveryReadiness({ destinations, deliveries, auditEvents }),
        destinationHealth: destinationReadModels.destinationHealth,
        destinationLifecycle: destinationReadModels.destinationLifecycle,
        destinationAdminProof: destinationReadModels.destinationAdminProof,
        auditEventContracts: buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations }),
        visibility: visibilityResult?.decision ?? {
            allowed: true,
            reason: null,
            alertVisibilityPolicy: 'members',
            allowedRoles: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
        },
    }
    if (includeAudit) payload.auditEvents = auditEvents
    return payload
}
