import crypto from 'node:crypto'
import { buildDwmAlertDeliveryPayload } from '../alertDeliveryPayload.ts'
import type { DwmAlertEventType, DwmWebhookDeliveryRow, DwmWebhookDestinationRow } from '../../webhookDestinationTypes.ts'
import { bindExactDwmWebhookReceiverReceipt } from '../../webhookReceiverReceipts.ts'
import { toDwmWebhookDelivery } from '../../webhookDestinationModels.ts'
import { recordDwmWebhookAudit } from '../../webhookAuditStore.ts'
import { buildIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { classifyDeliveryError, MAX_DWM_WEBHOOK_DELIVERY_ATTEMPTS, planDwmWebhookDeliveryRetry } from '../../webhookDeliveryRetryPolicy.ts'
import { deliveryAuditActionForEvent } from '../../webhookAuditContracts.ts'
import { canonicalJson } from '../../customerOutputSafety.ts'
import { postPublicWebhook, hashValue as hashWebhookValue } from '../../webhookTransport.ts'
import run, { withTransaction } from '#db'
import { countDwmWebhookDeliveryAttempts, dwmWebhookDeliveryAuditMetadata } from './dwm-webhook-delivery-audit-metadata.ts'
import { sendDwmWebhookPayload } from './send-dwm-webhook-payload.ts'
import { DWM_WEBHOOK_DELIVERY_INSERT } from './delivery-insert-query.ts'

export async function deliverToDwmWebhookDestination({
    ownerId,
    destination,
    eventType,
    alert,
    dryRun,
    live,
    markTested,
    sender = postPublicWebhook,
}: {
    ownerId: string
    destination: DwmWebhookDestinationRow
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    dryRun: boolean
    live: boolean
    markTested: boolean
    sender?: (endpoint: string, body: string, signingSecret?: string) => Promise<{ status: number, body: string }>
}) {
    const deliveryId = crypto.randomUUID()
    const payload = buildDwmAlertDeliveryPayload({ destination, alert, eventType, deliveryId })
    const { alert: normalizedAlert, watchlist } = '_hanasand' in payload ? payload._hanasand : payload
    const payloadBody = canonicalJson(payload)
    const payloadHash = hashWebhookValue('payload', payloadBody)
    const liveRequested = live && !dryRun && process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true'
    let status: DwmWebhookDeliveryRow['status'] = dryRun ? 'dry_run' : 'skipped'
    let responseStatus: number | null = null
    let responseBody: string | null = null
    let error: string | null = null
    const idempotencyKey = buildIdempotencyKey(eventType, destination.org_id, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id)
    const liveAttemptCount = await countDwmWebhookDeliveryAttempts(destination.org_id, destination.id, idempotencyKey)
    const shouldSendLive = liveRequested && liveAttemptCount < MAX_DWM_WEBHOOK_DELIVERY_ATTEMPTS
    const attemptedAt = shouldSendLive ? new Date().toISOString() : null
    let completedAt: string | null = null
    const attemptCount = liveAttemptCount + (shouldSendLive ? 1 : 0)

    if (!dryRun && live && process.env.DWM_WEBHOOK_LIVE_DELIVERY !== 'true') {
        error = 'Live DWM webhook delivery is disabled. Set DWM_WEBHOOK_LIVE_DELIVERY=true and send live=true to enable external calls.'
    } else if (liveRequested && !shouldSendLive) {
        error = `Delivery attempt limit reached for this report (${MAX_DWM_WEBHOOK_DELIVERY_ATTEMPTS} attempts).`
    }

    if (shouldSendLive) {
        try {
            const sendResult = await sendDwmWebhookPayload(destination, payloadBody, sender)
            status = sendResult.status
            responseStatus = sendResult.responseStatus
            responseBody = sendResult.responseBody
            error = sendResult.error
        } finally {
            completedAt = new Date().toISOString()
        }
    }
    const deliveredAt = status === 'delivered' ? completedAt : null

    const delivery = await withTransaction(async query => {
        const result = await query(DWM_WEBHOOK_DELIVERY_INSERT, [
            deliveryId,
            destination.id,
            ownerId,
            destination.org_id,
            normalizedAlert.id,
            eventType,
            status,
            dryRun,
            destination.endpoint_hint,
            destination.endpoint_hash,
            payloadHash,
            payloadBody,
            responseStatus,
            responseBody,
            error,
            classifyDeliveryError({ status, dryRun, responseStatus, error }),
            attemptCount,
            planDwmWebhookDeliveryRetry({ status, dryRun, responseStatus, error, attemptCount }).nextRetryAt,
            idempotencyKey,
            watchlist.id,
            watchlist.name,
            normalizedAlert.route,
            normalizedAlert.casePath,
            attemptedAt,
            completedAt,
            deliveredAt,
        ])
        const persisted = result.rows[0] as DwmWebhookDeliveryRow
        await bindExactDwmWebhookReceiverReceipt(persisted, query)
        return persisted
    })

    if (status === 'delivered' || status === 'dry_run' || markTested) {
        await run(`
            UPDATE dwm_webhook_destinations
               SET last_tested_at = CASE WHEN $2 THEN NOW() ELSE last_tested_at END,
                   last_test_status = CASE WHEN $2 THEN $3 ELSE last_test_status END,
                   last_test_error = CASE WHEN $2 THEN $4 ELSE last_test_error END,
                   last_test_http_status = CASE WHEN $2 THEN $5 ELSE last_test_http_status END,
                   last_delivery_at = CASE WHEN $6 THEN $7::timestamptz ELSE last_delivery_at END,
                   updated_at = NOW()
             WHERE id = $1
        `, [destination.id, markTested, status, error, responseStatus, status === 'delivered', deliveredAt])
    }

    const auditAction = markTested
        ? 'delivery.tested'
        : delivery.status === 'failed'
            ? delivery.next_retry_at ? 'delivery.retry_scheduled' : 'delivery.failed'
            : delivery.status === 'skipped'
                ? 'delivery.skipped'
                : deliveryAuditActionForEvent(delivery.event_type)
    const auditEventId = await recordDwmWebhookAudit({
        ownerId,
        actorId: ownerId,
        orgId: delivery.org_id,
        destinationId: destination.id,
        deliveryId: delivery.id,
        action: auditAction,
        metadata: {
            ...dwmWebhookDeliveryAuditMetadata(delivery, alert, {
                responseStatus: delivery.response_status,
            }),
        },
    })

    return {
        ...toDwmWebhookDelivery(delivery),
        auditEventId,
        auditAction,
        auditActorId: ownerId,
    }
}
