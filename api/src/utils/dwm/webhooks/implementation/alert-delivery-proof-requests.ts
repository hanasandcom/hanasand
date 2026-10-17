import type { buildDwmWebhookAlertDeliveryProof } from './alert-delivery-proof.ts'
import { clean } from '../../webhookValueUtils.ts'
import { buildIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { deliveryAuditActionForEvent } from '../../webhookAuditContracts.ts'
import type { DwmAlertEventType } from '../../webhookDestinationTypes.ts'
import { alertDeliveryProofBlocker } from './retry-queue-blocker.ts'

type ProofInput = Parameters<typeof buildDwmWebhookAlertDeliveryProof>[0]
type ProofBlocker = ReturnType<typeof alertDeliveryProofBlocker>
type RequestInput = Pick<ProofInput,
    | 'orgId'
    | 'eventType'
    | 'dryRun'
    | 'liveRequested'
    | 'liveDeliveryEnabled'
    | 'selectedDestinations'
    | 'normalizedAlert'
    | 'watchlist'
    | 'customerSetup'
    | 'alertDestinationReadiness'
    | 'auditEventContracts'
> & {
    alertScopedBlockers: ProofBlocker[]
    selectedDestinationIds: Set<string>
}

export function buildAlertDeliveryProofRequests({
    orgId,
    eventType,
    dryRun,
    liveRequested,
    liveDeliveryEnabled,
    selectedDestinations,
    normalizedAlert,
    watchlist,
    customerSetup,
    alertDestinationReadiness,
    auditEventContracts,
    alertScopedBlockers,
    selectedDestinationIds,
}: RequestInput) {
    const safeAlertBody = {
        id: normalizedAlert.id,
        title: normalizedAlert.title,
        severity: normalizedAlert.severity,
        confidence: normalizedAlert.confidence,
        sourceFamily: normalizedAlert.sourceFamily,
        evidenceCount: normalizedAlert.evidenceCount,
        route: normalizedAlert.route,
        dedupeKey: normalizedAlert.dedupeKey,
        casePath: normalizedAlert.casePath,
        caseId: normalizedAlert.caseId,
        alertUrl: normalizedAlert.alertUrl,
        provenanceSummary: normalizedAlert.provenanceSummary,
        watchlist,
    }
    const deliveryRequestBodyForDestination = (destinationId: string, live: boolean) => ({
        orgId,
        organizationId: orgId,
        tenantId: orgId,
        destinationId,
        eventType,
        alertId: normalizedAlert.id,
        watchlistItemId: watchlist.id,
        watchlistName: watchlist.name,
        dedupeKey: normalizedAlert.dedupeKey || normalizedAlert.id,
        route: normalizedAlert.route,
        casePath: normalizedAlert.casePath,
        evidenceCount: normalizedAlert.evidenceCount,
        sourceFamily: normalizedAlert.sourceFamily,
        dryRun: !live,
        live,
        alert: safeAlertBody,
    })
    const dryRunDeliveryRequests = selectedDestinations.map(destination => ({
        destinationId: destination.id,
        expectedIdempotencyKey: buildIdempotencyKey(eventType, orgId, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id),
        expectedAuditAction: deliveryAuditActionForEvent(eventType),
        method: 'POST',
        route: 'POST /api/dwm/webhook-deliveries',
        noNetwork: true,
        externalSendEnabled: false,
        body: deliveryRequestBodyForDestination(destination.id, false),
        blockers: alertScopedBlockers.filter(blocker => blocker.destinationId === destination.id),
    }))
    const liveDeliveryRequests = selectedDestinations.map(destination => {
        const destinationBlockers = alertScopedBlockers.filter(blocker => !blocker.destinationId || blocker.destinationId === destination.id)
        const blockingDestinationCodes = destinationBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
        const canSend = liveDeliveryEnabled && !dryRun && liveRequested && blockingDestinationCodes.length === 0
        return {
            destinationId: destination.id,
            expectedIdempotencyKey: buildIdempotencyKey(eventType, orgId, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id),
            expectedAuditAction: deliveryAuditActionForEvent(eventType),
            method: 'POST',
            route: 'POST /api/dwm/webhook-deliveries',
            noNetwork: !canSend,
            externalSendEnabled: canSend,
            body: canSend ? deliveryRequestBodyForDestination(destination.id, true) : null,
            blockers: destinationBlockers,
        }
    })
    const customerSetupDryRunRequests = Array.isArray((customerSetup as { dryRunTestRequests?: unknown }).dryRunTestRequests)
        ? (customerSetup as { dryRunTestRequests: Array<{ destinationId?: string, payloadPreview?: unknown }> }).dryRunTestRequests
        : []
    const customerSetupDryRunRequestByDestination = new Map(customerSetupDryRunRequests
        .map(request => [clean(request.destinationId), request] as const)
        .filter(([destinationId]) => Boolean(destinationId)))
    const destinationTestRequests = selectedDestinations.map(destination => ({
        destinationId: destination.id,
        expectedIdempotencyKey: buildIdempotencyKey('dwm.alert.test', orgId, destination.id, 'webhook_test'),
        expectedAuditAction: 'delivery.tested',
        method: 'POST',
        route: `POST /api/dwm/webhook-destinations/${destination.id}/test`,
        noNetwork: true,
        externalSendEnabled: false,
        body: {
            orgId,
            destinationId: destination.id,
            eventType: 'dwm.alert.test' as DwmAlertEventType,
            dryRun: true,
            live: false,
            alert: safeAlertBody,
        },
        payloadPreview: customerSetupDryRunRequestByDestination.get(destination.id)?.payloadPreview || null,
    }))
    return {
        dryRunDeliveries: dryRunDeliveryRequests,
        liveDeliveries: liveDeliveryRequests,
        destinationTests: destinationTestRequests,
        alertEventReadiness: {
            schemaVersion: 'dwm.webhook.alert_event_readiness_fixture.v1',
            consumesSchemaVersion: alertDestinationReadiness.alertEventConsumer.schemaVersion,
            noNetwork: true,
            externalSendEnabled: false,
            eventType,
            orgId,
            alertId: normalizedAlert.id,
            dedupeKey: normalizedAlert.dedupeKey,
            casePath: normalizedAlert.casePath,
            sourceFamily: normalizedAlert.sourceFamily,
            watchlistId: watchlist.id,
            provenanceSummary: normalizedAlert.provenanceSummary,
            selectedDestinationIds: [...selectedDestinationIds],
            expectedDeliveryAttempts: dryRunDeliveryRequests.map(request => ({
                destinationId: request.destinationId,
                idempotencyKey: request.expectedIdempotencyKey,
                auditAction: request.expectedAuditAction,
                dryRun: true,
                live: false,
            })),
            payloadPreview: alertDestinationReadiness.alertEventConsumer.payloadPreview,
            payloadValidation: alertDestinationReadiness.alertEventConsumer.payloadValidation,
            readiness: {
                ready: alertDestinationReadiness.alertEventConsumer.ready,
                state: alertDestinationReadiness.alertEventConsumer.state,
                blockerCodes: alertDestinationReadiness.alertEventConsumer.blockerCodes,
                auditLinked: alertDestinationReadiness.alertEventConsumer.auditReadiness.auditLinked,
                auditMissing: alertDestinationReadiness.alertEventConsumer.auditReadiness.auditMissing,
            },
            blockers: alertScopedBlockers,
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                webhookSecretExposed: false,
                payloadSecretExposed: false,
            },
        },
        deliveryHistory: {
            method: 'GET',
            route: customerSetup.routes.deliveryHistory,
            expectedAuditActions: [...new Set(auditEventContracts.map(audit => audit.action).filter(Boolean))],
            query: {
                orgId,
                alertId: normalizedAlert.id,
                dedupeKey: normalizedAlert.dedupeKey,
                casePath: normalizedAlert.casePath,
            },
        },
    }
}
