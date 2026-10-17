import { buildDwmWebhookDestinationTestPayloadPreview } from '../payloadPreviews.ts'
import { isLiveDeliveredProof } from './webhook-contract-types.ts'
import type { DwmWebhookDestinationPublic, DwmWebhookDeliveryPublic } from './webhook-contract-types.ts'
import type { buildDwmWebhookDestinationHealthFromProjection, prepareDwmWebhookDestinationProjection } from './dwm-webhook-destination-projection.ts'
import type { buildDwmWebhookDeliveryRetryPersistence } from './delivery-read-projections.ts'
import { hasTerminalDeliveryFailure } from './destination-health-attempt.ts'
import { destinationLifecycleState } from './destination-lifecycle-state.ts'
import { destinationLifecycleReadinessReceipt } from './destination-lifecycle-readiness-receipt.ts'
import { uniqueDashboardReadinessBlockers, dashboardPrimaryHealthStatus, dashboardReadinessBlocker } from './webhook-setup-routes.ts'

type Health = ReturnType<typeof buildDwmWebhookDestinationHealthFromProjection>[number]
type AuditContracts = ReturnType<typeof prepareDwmWebhookDestinationProjection>['auditContracts']
type RetryKey = ReturnType<typeof buildDwmWebhookDeliveryRetryPersistence>['deliveryKeys'][number]
type Blocker = ReturnType<typeof dashboardReadinessBlocker>

export function buildDashboardReadinessRow({
    health,
    policyBlockers,
    deliveriesById,
    destinationById,
    auditByDestination,
    dashboardCanManage,
    retryKeysByDestination,
    liveDeliveryEnabled,
}: {
    health: Health
    policyBlockers: Blocker[]
    deliveriesById: Map<string, DwmWebhookDeliveryPublic>
    destinationById: Map<string, DwmWebhookDestinationPublic>
    auditByDestination: Map<string, AuditContracts>
    dashboardCanManage: boolean
    retryKeysByDestination: Map<string, RetryKey[]>
    liveDeliveryEnabled: boolean
}) {

    const retryKeys = retryKeysByDestination.get(health.destinationId) || []
    const endpointPresent = Boolean(health.redactedEndpoint.endpointHash || health.redactedEndpoint.endpointHint)
    const latestRetryKey = retryKeys[0] || null
    const terminalFailure = hasTerminalDeliveryFailure(health.lastFailure)
            || retryKeys.some(key => key.retry.terminalFailure)
    const states = [
        policyBlockers.length ? 'policy_blocked' : null,
        !health.enabled ? 'disabled' : null,
        endpointPresent ? null : 'secret_missing',
        health.lastTest.status === 'failed' ? 'test_failed' : null,
        health.retry.retryable ? 'retry_scheduled' : null,
        terminalFailure ? 'terminal_failure' : null,
        health.enabled && endpointPresent && health.lastTest.requestId && isLiveDeliveredProof(health.lastTest) ? 'verified' : null,
    ].filter(Boolean) as string[]
    const blockers = [
        ...policyBlockers.map(blocker => ({ ...blocker, destinationId: health.destinationId })),
        !health.enabled ? dashboardReadinessBlocker('disabled', 'Destination is disabled.', health.destinationId, 'destination_disabled') : null,
        endpointPresent ? null : dashboardReadinessBlocker('secret_missing', 'Destination has no stored webhook URL reference.', health.destinationId, 'secret_missing'),
        health.lastTest.status === 'failed' ? dashboardReadinessBlocker('test_failed', 'Latest destination test failed.', health.destinationId, 'test_failed') : null,
        health.retry.retryable ? dashboardReadinessBlocker('retry_scheduled', 'Latest failed delivery has retry/backoff scheduled.', health.destinationId, health.retry.errorClass || 'retry_scheduled', false) : null,
        terminalFailure ? dashboardReadinessBlocker('terminal_failure', 'Latest delivery failure is not retryable.', health.destinationId, health.lastFailure?.errorClass || latestRetryKey?.retry.lastErrorCategory || 'terminal_failure') : null,
    ].filter(Boolean) as ReturnType<typeof dashboardReadinessBlocker>[]
    const healthStatus = dashboardPrimaryHealthStatus(states)
    const latestDelivery = health.latestAttempt?.deliveryId ? deliveriesById.get(health.latestAttempt.deliveryId) || null : null
    const latestPayloadPreview = latestDelivery?.payload ? buildDwmWebhookDestinationTestPayloadPreview(latestDelivery.payload) : null
    const lifecycleState = destinationLifecycleState({
        destination: destinationById.get(health.destinationId) || null,
        health,
        audits: auditByDestination.get(health.destinationId) || [],
        canManage: dashboardCanManage,
    })
    const lifecycleReadinessReceipt = destinationLifecycleReadinessReceipt({ health, lifecycleState, canManage: dashboardCanManage })

    return {
        schemaVersion: 'dwm.webhook.dashboard_destination_readiness.v1',
        orgId: health.orgId,
        destinationId: health.destinationId,
        label: health.label,
        type: health.type,
        lifecycle: {
            status: health.status,
            enabled: health.enabled,
        },
        healthStatus,
        healthStates: [...new Set(states.length ? states : ['unverified'])],
        readyForDryRun: health.enabled && endpointPresent && !policyBlockers.length,
        readyForLive: health.ready && liveDeliveryEnabled && !policyBlockers.length,
        secretState: endpointPresent ? 'redacted' : 'missing',
        redactedEndpoint: health.redactedEndpoint,
        lifecycleState,
        lifecycleReadinessReceipt,
        latestDeliveryProof: {
            requestId: health.latestAttempt?.requestId || null,
            deliveryId: health.latestAttempt?.deliveryId || null,
            status: health.latestAttempt?.status || null,
            rawStatus: health.latestAttempt?.rawStatus || null,
            dryRun: health.latestAttempt?.dryRun ?? null,
            live: health.latestAttempt?.live ?? null,
            replay: health.latestAttempt?.replay ?? null,
            dedupeKey: health.latestAttempt?.dedupeKey || latestRetryKey?.dedupeKey || null,
            idempotencyKey: health.latestAttempt?.idempotencyKey || latestRetryKey?.idempotencyKey || null,
            casePath: health.latestAttempt?.casePath || latestRetryKey?.casePath || null,
            auditEventId: health.latestAttempt?.auditEventId || latestRetryKey?.audit.latestAuditEventId || null,
            attemptedAt: health.latestAttempt?.attemptedAt || null,
            discordTemplate: latestPayloadPreview?.context.discordTemplate || null,
        },
        test: {
            status: health.lastTest.status,
            requestId: health.lastTest.requestId,
            auditEventId: health.lastTest.auditEventId,
            failureReason: health.lastTest.failureReason,
        },
        retry: {
            retryable: health.retry.retryable,
            nextRetryAt: health.retry.nextRetryAt,
            attemptCount: health.retry.attemptCount,
            lastErrorCategory: health.retry.errorClass,
            terminalFailure,
        },
        replay: {
            duplicateKeyCount: health.idempotencyCoverage.duplicateKeyCount,
            latestReplayRequestId: health.recentAttempts.find(attempt => attempt.replay)?.requestId || null,
        },
        auditEventIds: health.auditEventIds,
        latestAuditEventId: health.latestAuditEventId,
        blockers: uniqueDashboardReadinessBlockers(blockers),
    }

}
