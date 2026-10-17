import { idempotencyCoverage } from '../../webhookDeliveryUtilities.ts'
import { buildDwmWebhookDeliveryLedger } from '../../webhookDeliveryLedger.ts'
import { type buildDwmWebhookDestinationContracts } from './destination-contracts.ts'
import { destinationReadinessBlockers } from './dwm-webhook-delivery-audit-metadata.ts'

export function buildDwmWebhookDeliveryReadinessFromProjection({
    destinationContracts,
    deliveryLedger,
    liveDeliveryEnabled,
}: {
    destinationContracts: ReturnType<typeof buildDwmWebhookDestinationContracts>
    deliveryLedger: ReturnType<typeof buildDwmWebhookDeliveryLedger>
    liveDeliveryEnabled: boolean
}) {
    const attemptsByDestination = new Map<string, typeof deliveryLedger>()
    for (const attempt of deliveryLedger) {
        if (!attempt.destinationId) continue
        const attempts = attemptsByDestination.get(attempt.destinationId) || []
        attempts.push(attempt)
        attemptsByDestination.set(attempt.destinationId, attempts)
    }
    const destinationReadiness = destinationContracts.map((destination) => {
        const attempts = (attemptsByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const latestAttempt = attempts[0] || null
        const blockers = destinationReadinessBlockers({ destination, latestAttempt, liveDeliveryEnabled })
        const ready = blockers.filter(blocker => blocker !== 'live_delivery_disabled').length === 0
        const retryState = latestAttempt
            ? {
                retryable: latestAttempt.retryable,
                nextRetryAt: latestAttempt.nextRetryAt,
                errorClass: latestAttempt.errorClass,
                reason: latestAttempt.retryReason,
                attemptCount: latestAttempt.attemptCount,
            }
            : { retryable: false, nextRetryAt: null, errorClass: null, reason: 'no_attempts', attemptCount: 0 }

        return {
            destinationId: destination.id,
            orgId: destination.orgId,
            type: destination.type,
            label: destination.label,
            status: destination.status,
            enabled: destination.enabled,
            ready,
            readiness: ready ? 'ready' : latestAttempt?.retryable ? 'retrying' : destination.enabled ? 'blocked' : 'disabled',
            redactedEndpoint: destination.redactedDestination,
            lastTest: destination.lastTest,
            lastDelivery: destination.lastDelivery,
            retryState,
            failureClass: retryState.errorClass,
            blockers,
            idempotencyCoverage: idempotencyCoverage(attempts),
            recentAttempts: attempts.slice(0, 5),
            auditEventIds: destination.auditEventIds,
            latestAuditEventId: destination.latestAuditEventId,
        }
    })
    const blockers = [...new Set(destinationReadiness.flatMap(destination => destination.blockers))]
    const recentAttempts = [...deliveryLedger]
        .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        .slice(0, 10)

    return {
        schemaVersion: 'dwm.webhook.readiness.v1',
        liveDeliveryEnabled,
        destinationCount: destinationReadiness.length,
        activeDestinationCount: destinationReadiness.filter(destination => destination.enabled).length,
        readyDestinationCount: destinationReadiness.filter(destination => destination.ready).length,
        disabledDestinationCount: destinationReadiness.filter(destination => !destination.enabled).length,
        retryScheduledCount: destinationReadiness.filter(destination => destination.retryState.retryable).length,
        failedDestinationCount: destinationReadiness.filter(destination => destination.failureClass && !destination.retryState.retryable).length,
        blockers,
        destinations: destinationReadiness,
        recentAttempts,
        idempotencyCoverage: idempotencyCoverage(deliveryLedger),
    }
}
