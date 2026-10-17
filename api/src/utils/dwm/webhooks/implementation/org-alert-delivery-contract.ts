import { buildDwmWebhookDispatchPlanForDestinations } from '../dispatchPlanning.ts'
import { buildDwmWebhookDeliveryRequestInput } from '../notificationInput.ts'
import type { DwmAlertNotificationInput } from '../../webhookDestinationTypes.ts'
import { clean } from '../../webhookValueUtils.ts'
import { normalizeAlert, normalizeWatchlist } from '../../webhookAlertNormalization.ts'
import { parseBoolean } from '../../webhookDestinationInput.ts'
import { buildIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { buildDwmWebhookDeliveryLedger } from '../../webhookDeliveryLedger.ts'
import { buildDwmWebhookAuditEventContracts } from '../../webhookAuditContracts.ts'
import { type DwmWebhookDestinationPublic, type DwmWebhookDeliveryPublic, type DwmWebhookAuditPublic } from './webhook-contract-types.ts'
import { buildDwmWebhookDestinationReadModels } from './destination-admin-proof.ts'
import { buildDwmOrgAlertWebhookDeliveryOutcome } from './org-alert-delivery-outcome.ts'
import { buildDwmAlertWebhookReadinessHandoff } from './alert-readiness-handoff.ts'
import { buildDwmWebhookDeliveryTimeline } from './delivery-read-projections.ts'
import { buildDwmWebhookDeliveryActionPlan } from './delivery-action-plan.ts'
import { buildDwmWebhookDeliveryReplayGuard } from './delivery-replay-guard.ts'
import { buildDwmWebhookDeliveryReadinessConsumerProof } from './delivery-history-consumer-proof.ts'
import { buildDwmWebhookCustomerSetupProof } from './customer-setup-proof.ts'
import { buildDwmWebhookAlertDeliveryProof } from './alert-delivery-proof.ts'
import { buildDwmWebhookOrganizationConsumerReceipt } from './organization-consumer-receipt.ts'

export function buildDwmOrgAlertWebhookDeliveryContract({
    ownerId,
    input,
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
}) {
    const normalizedInput = buildDwmWebhookDeliveryRequestInput(input)
    const dryRun = parseBoolean(normalizedInput.dryRun ?? normalizedInput.dry_run, true)
    const liveRequested = parseBoolean(normalizedInput.live, false)
    const dispatch = buildDwmWebhookDispatchPlanForDestinations(ownerId, normalizedInput, destinations)
    const destinationReadModels = buildDwmWebhookDestinationReadModels({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
    })
    const {
        destinationHealth,
        destinationLifecycle,
        destinationAdminProof,
    } = destinationReadModels
    const deliveryLedger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents })
    const auditEventContracts = buildDwmWebhookAuditEventContracts({ destinations, deliveries, auditEvents })
    const deliveryOutcome = buildDwmOrgAlertWebhookDeliveryOutcome({
        ownerId,
        input: normalizedInput,
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    const destinationId = clean(normalizedInput.destinationId ?? normalizedInput.destination_id)
    const normalizedAlert = normalizeAlert(dispatch.alert)
    const watchlist = normalizeWatchlist(dispatch.alert.watchlist)
    const alertDestinationReadiness = buildDwmAlertWebhookReadinessHandoff({
        ownerId,
        input: normalizedInput,
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    const deliveryEvidenceAccess = {
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        filters: {
            orgId: dispatch.orgId,
            destinationId,
            alertId: normalizedAlert.id,
            casePath: normalizedAlert.casePath,
            dedupeKey: normalizedAlert.dedupeKey,
        },
    }
    const deliveryTimeline = buildDwmWebhookDeliveryTimeline(deliveryEvidenceAccess)
    const deliveryActionPlan = buildDwmWebhookDeliveryActionPlan(deliveryEvidenceAccess)
    const deliveryReplayGuard = buildDwmWebhookDeliveryReplayGuard(deliveryEvidenceAccess)
    const deliveryReadinessConsumer = buildDwmWebhookDeliveryReadinessConsumerProof(deliveryEvidenceAccess)
    const customerSetup = buildDwmWebhookCustomerSetupProof({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        readModels: destinationReadModels,
    })
    const alertDeliveryProof = buildDwmWebhookAlertDeliveryProof({
        ownerId,
        orgId: dispatch.orgId,
        eventType: dispatch.eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        selectedDestinations: dispatch.selectedDestinations,
        skippedDestinations: dispatch.skippedDestinations,
        normalizedAlert,
        watchlist,
        customerSetup,
        alertDestinationReadiness,
        deliveryOutcome,
        deliveryTimeline,
        deliveryActionPlan,
        deliveryReplayGuard,
        destinationAdminProof,
        auditEventContracts,
    })
    const organizationConsumerReceipt = buildDwmWebhookOrganizationConsumerReceipt({
        ownerId,
        orgId: dispatch.orgId,
        eventType: dispatch.eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        selectedDestinations: dispatch.selectedDestinations,
        skippedDestinations: dispatch.skippedDestinations,
        normalizedAlert,
        watchlist,
        alertDestinationReadiness,
        deliveryOutcome,
        deliveryReadinessConsumer,
        alertDeliveryProof,
        auditEventContracts,
    })

    return {
        schemaVersion: 'dwm.webhook.org_alert_delivery.v1',
        ownerId,
        orgId: dispatch.orgId,
        eventType: dispatch.eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        destinationSelection: {
            requestedDestinationId: destinationId || null,
            selectedCount: dispatch.selectedDestinations.length,
            skippedCount: dispatch.skippedDestinations.length,
            selectedDestinations: dispatch.selectedDestinations.map(destination => ({
                id: destination.id,
                orgId: destination.org_id,
                label: destination.name,
                type: destination.kind,
                status: destination.status,
                idempotencyKey: buildIdempotencyKey(dispatch.eventType, dispatch.orgId, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id),
            })),
            skippedDestinations: dispatch.skippedDestinations,
        },
        alert: {
            id: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            sourceFamily: normalizedAlert.sourceFamily,
            evidenceCount: normalizedAlert.evidenceCount,
            evidenceSummary: normalizedAlert.evidenceSummary,
            route: normalizedAlert.route,
            dedupeKey: normalizedAlert.dedupeKey,
            casePath: normalizedAlert.casePath,
            caseId: normalizedAlert.caseId,
            alertUrl: normalizedAlert.alertUrl,
            provenance: normalizedAlert.provenance,
            provenanceSummary: normalizedAlert.provenanceSummary,
        },
        watchlist,
        deliveryLedger,
        destinationHealth,
        destinationLifecycle,
        destinationAdminProof,
        customerSetup,
        alertDestinationReadiness,
        alertDeliveryProof,
        deliveryOutcome,
        deliveryTimeline,
        deliveryActionPlan,
        deliveryReplayGuard,
        deliveryReadinessConsumer,
        organizationConsumerReceipt,
        auditEventContracts,
    }
}
