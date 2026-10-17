import crypto from 'node:crypto'
import type { DwmWebhookDispatchDestination } from '../dispatchPlanning.ts'
import { buildDwmAlertDeliveryPayload } from '../alertDeliveryPayload.ts'
import type { DwmAlertEventType, DwmWebhookDeliveryRow } from '../../webhookDestinationTypes.ts'
import { toDwmWebhookDelivery } from '../../webhookDestinationModels.ts'
import { recordDwmWebhookAudit } from '../../webhookAuditStore.ts'
import { buildIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { classifyDeliveryError } from '../../webhookDeliveryRetryPolicy.ts'
import { hashValue as hashWebhookValue } from '../../webhookTransport.ts'
import run from '#db'
import { countDwmWebhookDeliveryAttempts, dwmWebhookDeliveryAuditMetadata } from './dwm-webhook-delivery-audit-metadata.ts'

export async function recordSkippedDwmWebhookDelivery({
    ownerId,
    orgId,
    destinationId,
    payloadDestination,
    endpointHint,
    endpointHash,
    eventType,
    alert,
    dryRun,
    idempotencyKey,
    error,
    reason,
    additionalAuditMetadata = {},
}: {
    ownerId: string
    orgId: string
    destinationId: string | null
    payloadDestination: Pick<DwmWebhookDispatchDestination, 'id' | 'kind' | 'name' | 'org_id'>
    endpointHint: string
    endpointHash: string
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    dryRun: boolean
    idempotencyKey?: string
    error: string
    reason: string
    additionalAuditMetadata?: Record<string, unknown>
}) {
    const deliveryId = crypto.randomUUID()
    const payload = buildDwmAlertDeliveryPayload({ destination: payloadDestination, alert, eventType, deliveryId })
    const { alert: normalizedAlert, watchlist } = '_hanasand' in payload ? payload._hanasand : payload
    const resolvedIdempotencyKey = idempotencyKey || buildIdempotencyKey(
        eventType,
        orgId,
        destinationId || 'missing_destination',
        normalizedAlert.dedupeKey || normalizedAlert.id,
    )
    const payloadBody = JSON.stringify(payload)
    const payloadHash = hashWebhookValue('payload', payloadBody)
    const attemptCount = await countDwmWebhookDeliveryAttempts(orgId, destinationId, resolvedIdempotencyKey)
    const errorClass = classifyDeliveryError({ status: 'skipped', dryRun, error })
    const result = await run(`
        INSERT INTO dwm_webhook_deliveries (
            id,
            destination_id,
            owner_id,
            org_id,
            alert_id,
            event_type,
            status,
            dry_run,
            endpoint_hint,
            endpoint_hash,
            payload_hash,
            payload,
            response_status,
            response_body,
            error,
            error_class,
            attempt_count,
            next_retry_at,
            idempotency_key,
            watchlist_id,
            watchlist_name,
            route,
            case_path,
            attempted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'skipped', $7, $8, $9, $10, $11::JSONB, NULL, NULL, $12, $13, $14, NULL, $15, $16, $17, $18, $19, NULL)
        RETURNING *
    `, [
        deliveryId,
        destinationId,
        ownerId,
        orgId,
        normalizedAlert.id,
        eventType,
        dryRun,
        endpointHint,
        endpointHash,
        payloadHash,
        payloadBody,
        error,
        errorClass,
        attemptCount,
        resolvedIdempotencyKey,
        watchlist.id,
        watchlist.name,
        normalizedAlert.route,
        normalizedAlert.casePath,
    ])

    const delivery = result.rows[0] as DwmWebhookDeliveryRow
    const auditEventId = await recordDwmWebhookAudit({
        ownerId,
        actorId: ownerId,
        orgId: delivery.org_id,
        destinationId: delivery.destination_id,
        deliveryId: delivery.id,
        action: 'delivery.skipped',
        metadata: {
            ...dwmWebhookDeliveryAuditMetadata(delivery, alert, {
                reason,
                ...additionalAuditMetadata,
            }),
        },
    })

    return {
        ...toDwmWebhookDelivery(delivery),
        auditEventId,
        auditAction: 'delivery.skipped',
        auditActorId: ownerId,
    }
}
