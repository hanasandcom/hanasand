import crypto from 'node:crypto'
import type { DwmWebhookDeliveryRow } from '../../webhookDestinationTypes.ts'
import { bindDwmWebhookReceiverReceipt } from '../../webhookReceiverReceipts.ts'
import { toDwmWebhookDelivery } from '../../webhookDestinationModels.ts'
import { loadDwmWebhookDestination } from '../../webhookDestinationReads.ts'
import { recordDwmWebhookAudit } from '../../webhookAuditStore.ts'
import { MAX_DWM_WEBHOOK_DELIVERY_ATTEMPTS, planDwmWebhookDeliveryRetry } from '../../webhookDeliveryRetryPolicy.ts'
import { controlledReceiverEndpointHashes, postPublicWebhook } from '../../webhookTransport.ts'
import run, { withDatabaseAdvisoryLock, withTransaction } from '#db'
import { loadLatestDwmWebhookDeliveryAttempt, countDwmWebhookDeliveryAttempts, findDeliveredDwmWebhookDelivery } from './dwm-webhook-delivery-audit-metadata.ts'
import { validatePersistedDwmWebhookRetryPayload } from './validate-persisted-dwm-webhook-retry-payload.ts'
import { sendDwmWebhookPayload } from './send-dwm-webhook-payload.ts'
import { DWM_WEBHOOK_DELIVERY_INSERT } from './delivery-insert-query.ts'
import { outboundReportAuditMetadata } from './webhook-contract-types.ts'

export async function retryDwmWebhookDelivery(
    ownerId: string,
    orgId: string,
    deliveryId: string,
    sender: (endpoint: string, body: string, signingSecret?: string) => Promise<{ status: number, body: string }> = postPublicWebhook
) {
    const priorResult = await run(`
        SELECT *
        FROM dwm_webhook_deliveries
        WHERE id = $1
          AND org_id = $2
          AND (
              owner_id = $3
              OR org_id IN (
                  SELECT organization_id
                  FROM organization_members
                  WHERE user_id = $3
                    AND status = 'active'
              )
          )
        LIMIT 1
    `, [deliveryId, orgId, ownerId])
    const prior = (priorResult.rows as DwmWebhookDeliveryRow[])[0]
    if (!prior) return { ok: false as const, status: 404, code: 'delivery_not_found', error: 'Delivery not found for this organization.' }
    if (prior.status !== 'failed' || prior.dry_run) return { ok: false as const, status: 409, code: 'delivery_retry_not_eligible', error: 'Only a failed live delivery can be retried.' }
    if (!prior.destination_id) return { ok: false as const, status: 409, code: 'delivery_destination_missing', error: 'The persisted delivery has no destination.' }
    const destinationId = prior.destination_id

    const destination = await loadDwmWebhookDestination(ownerId, destinationId)
    if (!destination || destination.org_id !== orgId || destination.status !== 'active') {
        return { ok: false as const, status: 409, code: 'delivery_destination_unavailable', error: 'The persisted delivery destination is unavailable.' }
    }
    if (destination.endpoint_hash !== prior.endpoint_hash) {
        return { ok: false as const, status: 409, code: 'delivery_destination_changed', error: 'The delivery destination changed; create a new delivery instead of replaying prior recipient approval.' }
    }
    if (process.env.DWM_WEBHOOK_LIVE_DELIVERY !== 'true') {
        return { ok: false as const, status: 503, code: 'live_delivery_disabled', error: 'Live webhook delivery is disabled.' }
    }
    return withDatabaseAdvisoryLock(`dwm-webhook-delivery:${prior.idempotency_key}`, async () => {
        const latest = await loadLatestDwmWebhookDeliveryAttempt(orgId, destinationId, prior.idempotency_key)
        if (!latest || latest.id !== prior.id) {
            return { ok: false as const, status: 409, code: 'delivery_retry_stale', error: 'Retry the latest failed attempt for this delivery lineage.' }
        }
        const lineageOwnerId = prior.owner_id
        const attemptCount = await countDwmWebhookDeliveryAttempts(orgId, destinationId, prior.idempotency_key)
        if (attemptCount >= MAX_DWM_WEBHOOK_DELIVERY_ATTEMPTS) {
            return { ok: false as const, status: 409, code: 'delivery_retry_limit', error: `Delivery retry is limited to ${MAX_DWM_WEBHOOK_DELIVERY_ATTEMPTS} total attempts.` }
        }
        const priorRetry = planDwmWebhookDeliveryRetry({
            status: prior.status,
            dryRun: prior.dry_run,
            responseStatus: prior.response_status,
            error: prior.error,
            attemptedAt: prior.attempted_at,
            attemptCount: attemptCount || 1,
        })
        if (!priorRetry.retryable) return { ok: false as const, status: 409, code: 'delivery_retry_not_eligible', error: 'The persisted delivery failure is not retryable.' }
        const persistedRetryAt = prior.next_retry_at && Number.isFinite(Date.parse(prior.next_retry_at))
            ? new Date(prior.next_retry_at).toISOString()
            : null
        const nextRetryAt = persistedRetryAt || priorRetry.nextRetryAt
        if (nextRetryAt && Date.parse(nextRetryAt) > Date.now()) {
            return {
                ok: false as const,
                status: 409,
                code: 'delivery_retry_not_ready',
                error: `This delivery can be retried at ${nextRetryAt}.`,
                nextRetryAt,
            }
        }

        const delivered = await findDeliveredDwmWebhookDelivery(orgId, destination.id, prior.idempotency_key)
        if (delivered) return { ok: false as const, status: 409, code: 'delivery_already_delivered', error: 'This exact idempotency lineage already has a delivered attempt.' }

        const persistedPayload = validatePersistedDwmWebhookRetryPayload(prior, destination, orgId)
        if (!persistedPayload.ok) return { status: 409 as const, ...persistedPayload }
        const { payloadBody, payloadHash, persistedReport } = persistedPayload

        const attemptedAt = new Date().toISOString()
        const { status, responseStatus, responseBody, error } = await sendDwmWebhookPayload(destination, payloadBody, sender)
        const completedAt = new Date().toISOString()
        const nextAttemptCount = attemptCount + 1
        const retryPlan = planDwmWebhookDeliveryRetry({ status, dryRun: false, responseStatus, error, attemptedAt, attemptCount: nextAttemptCount })
        const nextId = crypto.randomUUID()
        const row = await withTransaction(async query => {
            const result = await query(DWM_WEBHOOK_DELIVERY_INSERT, [
                nextId,
                destination.id,
                lineageOwnerId,
                orgId,
                prior.alert_id,
                prior.event_type,
                status,
                false,
                destination.endpoint_hint,
                destination.endpoint_hash,
                payloadHash,
                payloadBody,
                responseStatus,
                responseBody,
                error,
                retryPlan.errorClass,
                nextAttemptCount,
                retryPlan.nextRetryAt,
                prior.idempotency_key,
                prior.watchlist_id,
                prior.watchlist_name,
                prior.route,
                prior.case_path,
                attemptedAt,
                completedAt,
                status === 'delivered' ? completedAt : null,
            ])
            const persisted = result.rows[0] as DwmWebhookDeliveryRow
            const receiptBound = await bindDwmWebhookReceiverReceipt(persisted, query)
            if (status === 'delivered'
                && controlledReceiverEndpointHashes().includes(persisted.endpoint_hash)
                && !receiptBound) {
                throw new Error('Controlled receiver accepted delivery without an exact durable receipt.')
            }
            return persisted
        })
        if (status === 'delivered') {
            await run(`
            UPDATE dwm_webhook_destinations
               SET last_delivery_at = $2::timestamptz,
                   updated_at = NOW()
             WHERE id = $1
        `, [destination.id, completedAt])
        }
        const auditAction = status === 'failed' ? retryPlan.nextRetryAt ? 'delivery.retry_scheduled' : 'delivery.failed' : 'delivery.replayed'
        const auditEventId = await recordDwmWebhookAudit({
            ownerId: lineageOwnerId,
            actorId: ownerId,
            orgId,
            destinationId: destination.id,
            deliveryId: row.id,
            action: auditAction,
            metadata: {
                alertId: row.alert_id,
                status: row.status,
                responseStatus: row.response_status,
                error: row.error,
                errorClass: row.error_class,
                attemptCount: row.attempt_count,
                nextRetryAt: row.next_retry_at,
                idempotencyKey: row.idempotency_key,
                payloadHash: row.payload_hash,
                priorDeliveryId: prior.id,
                exactPersistedPayload: true,
                ...outboundReportAuditMetadata({ report: persistedReport }),
            },
        })
        return {
            ok: true as const,
            status: 202,
            delivery: {
                ...toDwmWebhookDelivery(row),
                auditEventId,
                auditAction,
                auditActorId: ownerId,
            },
        }})
}
