import { makeWebhookBlockerWithFields, uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { buildDwmWebhookDeliveryOperations } from '../../webhookDeliveryOperations.ts'
import { type DwmWebhookDestinationAdminProofBlockerCode } from './webhook-contract-types.ts'
import { type buildDwmWebhookDestinationHealth } from './destination-health.ts'

export function adminProofBlocker(
    code: DwmWebhookDestinationAdminProofBlockerCode,
    message: string,
    destinationId: string | null = null,
    retryable = false
) {
    return makeWebhookBlockerWithFields(code, message, destinationId, { retryable })
}

export function destinationAdminProofBlockers({
    health,
    latestOrgAlert,
    latestSent,
    latestFailedOrSkipped,
}: {
    health: ReturnType<typeof buildDwmWebhookDestinationHealth>[number]
    latestOrgAlert: ReturnType<typeof buildDwmWebhookDeliveryOperations>['recentDeliveries'][number] | null
    latestSent: ReturnType<typeof buildDwmWebhookDeliveryOperations>['recentDeliveries'][number] | null
    latestFailedOrSkipped: ReturnType<typeof buildDwmWebhookDeliveryOperations>['recentDeliveries'][number] | null
}) {
    const blockers: ReturnType<typeof adminProofBlocker>[] = []
    if (!health.enabled) {
        blockers.push(adminProofBlocker('destination_disabled', 'Destination is disabled.', health.destinationId))
    }
    if (!health.lastTest.requestId || (health.lastTest.status !== 'dry_run' && health.lastTest.status !== 'delivered')) {
        blockers.push(adminProofBlocker('no_verified_dry_run', 'Destination has no successful dry-run/test delivery.', health.destinationId))
    }
    if (!health.redactedEndpoint.endpointHash || !health.redactedEndpoint.endpointHint) {
        blockers.push(adminProofBlocker('no_live_endpoint', 'Destination has no stored webhook endpoint reference.', health.destinationId))
    }
    if (!health.latestAuditEventId && health.auditEventIds.length === 0) {
        blockers.push(adminProofBlocker('audit_missing', 'Destination has no linked webhook audit event.', health.destinationId))
    }
    if (!health.ready && health.enabled) {
        blockers.push(adminProofBlocker('destination_unhealthy', 'Destination health is blocked or retrying.', health.destinationId, health.retry.retryable))
    }
    if (!latestOrgAlert) {
        blockers.push(adminProofBlocker('missing_org_alert_context', 'No org alert delivery or replay has been recorded for this destination.', health.destinationId))
    }
    if (latestSent) {
        blockers.push(adminProofBlocker('dedupe_already_delivered', 'A delivery has already been sent for the latest destination dedupe context.', health.destinationId))
    }
    if (latestFailedOrSkipped && !latestFailedOrSkipped.attempts.retryable && latestFailedOrSkipped.status !== 'queued') {
        blockers.push(adminProofBlocker('retry_not_eligible', 'Latest failed or skipped delivery attempt is not eligible for retry.', health.destinationId))
    }
    return uniqueWebhookBlockers(blockers)
}

export function destinationAdminProofSummary(
    proofs: Array<{
        enabled: boolean
        health: { ready: boolean }
        retry: { retryable: boolean }
        dedupe: { duplicateKeyCount: number, alreadyDelivered: boolean }
        replay: { replayAttemptCount: number }
    }>,
    operations: ReturnType<typeof buildDwmWebhookDeliveryOperations>['recentDeliveries'],
    liveDeliveryEnabled: boolean
) {
    return {
        destinationCount: proofs.length,
        activeDestinationCount: proofs.filter(proof => proof.enabled).length,
        readyDestinationCount: proofs.filter(proof => proof.health.ready).length,
        blockedDestinationCount: proofs.filter(proof => !proof.health.ready).length,
        retryEligibleCount: proofs.filter(proof => proof.retry.retryable).length,
        replayDestinationCount: proofs.filter(proof => proof.replay.replayAttemptCount > 0).length,
        dedupeDeliveredCount: proofs.filter(proof => proof.dedupe.alreadyDelivered).length,
        duplicateDedupeDestinationCount: proofs.filter(proof => proof.dedupe.duplicateKeyCount > 0).length,
        recentDeliveryCount: operations.length,
        liveDeliveryEnabled,
    }
}

export function webhookProductProgressSummary(
    proofs: Array<{
        enabled: boolean
        health: { ready: boolean, adminProofBlockers: ReturnType<typeof adminProofBlocker>[] }
        retry: { retryable: boolean }
        deliveryOperations: { latestOrgAlert: unknown }
    }>,
    liveDeliveryEnabled: boolean,
    blockers: ReturnType<typeof adminProofBlocker>[]
) {
    const activeDestinationCount = proofs.filter(proof => proof.enabled).length
    const deliveryReadyCount = proofs.filter(proof => proof.enabled && proof.health.ready && proof.deliveryOperations.latestOrgAlert).length
    const blockerCodes = [...new Set(blockers.map(blocker => blocker.code))]
    return {
        schemaVersion: 'dwm.webhook.destination_admin_product_progress.v1',
        status: activeDestinationCount > 0 && deliveryReadyCount > 0 && !blockerCodes.includes('permission_denied') ? 'ready' : 'needs_action',
        destinationCount: proofs.length,
        activeDestinationCount,
        deliveryReadyCount,
        retryEligibleCount: proofs.filter(proof => proof.retry.retryable).length,
        liveDeliveryEnabled,
        blockerCodes,
        href: '/automation?setup=dwm',
    }
}
