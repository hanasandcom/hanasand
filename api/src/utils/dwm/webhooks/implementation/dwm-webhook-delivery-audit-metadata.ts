import type { DwmWebhookDeliveryRow } from '../../webhookDestinationTypes.ts'
import { buildDwmWebhookDeliveryLedger } from '../../webhookDeliveryLedger.ts'
import run from '#db'
import { outboundReportAuditMetadata, isLiveDeliveredProof } from './webhook-contract-types.ts'
import { type buildDwmWebhookDestinationContracts } from './destination-contracts.ts'

export function dwmWebhookDeliveryAuditMetadata(
    delivery: DwmWebhookDeliveryRow,
    alert: Record<string, unknown>,
    additional: Record<string, unknown> = {},
) {
    return {
        alertId: delivery.alert_id,
        eventType: delivery.event_type,
        status: delivery.status,
        endpointHint: delivery.endpoint_hint,
        endpointHash: delivery.endpoint_hash,
        payloadHash: delivery.payload_hash,
        dryRun: delivery.dry_run,
        error: delivery.error,
        errorClass: delivery.error_class,
        attemptCount: delivery.attempt_count,
        nextRetryAt: delivery.next_retry_at,
        idempotencyKey: delivery.idempotency_key,
        watchlistId: delivery.watchlist_id,
        route: delivery.route,
        casePath: delivery.case_path,
        ...additional,
        ...outboundReportAuditMetadata(alert),
    }
}

export async function findDeliveredDwmWebhookDelivery(
    orgId: string,
    destinationId: string,
    idempotencyKey: string
) {
    const result = await run(`
        SELECT *
        FROM dwm_webhook_deliveries
        WHERE org_id = $1
          AND destination_id = $2
          AND idempotency_key = $3
          AND status = 'delivered'
          AND dry_run = FALSE
          AND attempted_at IS NOT NULL
        ORDER BY attempted_at DESC
        LIMIT 1
    `, [orgId, destinationId, idempotencyKey])

    return (result.rows as DwmWebhookDeliveryRow[])[0] || null
}

export async function loadLatestDwmWebhookDeliveryAttempt(
    orgId: string,
    destinationId: string,
    idempotencyKey: string
) {
    const result = await run(`
        SELECT *
        FROM dwm_webhook_deliveries
        WHERE org_id = $1
          AND destination_id = $2
          AND idempotency_key = $3
          AND dry_run = FALSE
          AND attempted_at IS NOT NULL
          AND status IN ('delivered', 'failed')
        ORDER BY attempted_at DESC, created_at DESC
        LIMIT 1
    `, [orgId, destinationId, idempotencyKey])

    return (result.rows as DwmWebhookDeliveryRow[])[0] || null
}

export async function countDwmWebhookDeliveryAttempts(
    orgId: string,
    destinationId: string | null,
    idempotencyKey: string
) {
    const result = await run(`
        SELECT COUNT(*)::INT AS count
        FROM dwm_webhook_deliveries
        WHERE org_id = $1
          AND (($2::TEXT IS NULL AND destination_id IS NULL) OR destination_id = $2)
          AND idempotency_key = $3
          AND dry_run = FALSE
          AND attempted_at IS NOT NULL
          AND status IN ('delivered', 'failed')
    `, [orgId, destinationId, idempotencyKey])

    return Number(result.rows[0]?.count ?? 0)
}

export function destinationReadinessBlockers({
    destination,
    latestAttempt,
    liveDeliveryEnabled,
}: {
    destination: ReturnType<typeof buildDwmWebhookDestinationContracts>[number]
    latestAttempt: ReturnType<typeof buildDwmWebhookDeliveryLedger>[number] | null
    liveDeliveryEnabled: boolean
}) {
    const blockers = []
    if (!destination.enabled) blockers.push('destination_disabled')
    if (!destination.lastTest.requestId) blockers.push('test_delivery_missing')
    if (!isLiveDeliveredProof(destination.lastTest)) blockers.push('test_delivery_unverified')
    if (destination.lastTest.status === 'failed') blockers.push('test_delivery_failed')
    if (!liveDeliveryEnabled) blockers.push('live_delivery_disabled')
    if (latestAttempt?.retryable) blockers.push('retry_scheduled')
    if (latestAttempt?.status === 'failed' && !latestAttempt.retryable) blockers.push('last_delivery_failed')
    if (latestAttempt?.status === 'skipped' && latestAttempt.errorClass !== 'live_delivery_disabled') blockers.push('last_delivery_skipped')
    return [...new Set(blockers)]
}
