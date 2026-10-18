import run from '#db'
import { clean, recordOrEmpty, redactAuditMetadata } from './webhookValueUtils.ts'
import { controlledReceiverEndpointHashes } from './webhookTransport.ts'
import { validateDwmWebhookReceiverEnvelope } from './webhookReceiverValidation.ts'

type ReceiverAuditRow = {
    id: string
    org_id: string
    destination_id: string | null
    delivery_id: string | null
    action: string
    metadata: unknown
    created_at: string
}

type ReceiverDeliveryRow = {
    id: string
    org_id: string
    destination_id: string | null
    endpoint_hash: string
    idempotency_key: string
    payload_hash: string
    status: string
}

export async function recordDwmWebhookReceiverReceipt(value: unknown) {
    const validation = validateDwmWebhookReceiverEnvelope(value)
    if (!validation.valid) return { ok: false as const, status: 400, error: validation.error }
    const receipt = validation.receipt
    const metadata = {
        schemaVersion: 'dwm.webhook.receiver_receipt.v1',
        deliveryId: receipt.deliveryId,
        eventType: receipt.eventType,
        idempotencyKey: receipt.idempotencyKey,
        payloadHash: receipt.payloadHash,
        receiverTargetHash: receipt.receiverEndpointHash,
        reportValidation: receipt.reportValidation,
        reportCaseId: receipt.reportCaseId,
        reportAlertId: receipt.reportAlertId,
        reportExportChecksum: receipt.reportExportChecksum,
        receivedAt: receipt.receivedAt,
    }
    const inserted = await run(`
        INSERT INTO dwm_webhook_audit_events (
            id,
            owner_id,
            actor_id,
            org_id,
            destination_id,
            delivery_id,
            action,
            metadata
        )
        SELECT $1, destination.owner_id, NULL, $2, destination.id, NULL, 'receiver.accepted', $4::JSONB
        FROM dwm_webhook_destinations destination
        WHERE destination.id = $3
          AND destination.org_id = $2
          AND destination.status = 'active'
          AND destination.endpoint_hash = $5
        ON CONFLICT (id) DO NOTHING
        RETURNING *
    `, [
        receipt.id,
        receipt.orgId,
        receipt.destinationId,
        JSON.stringify(redactAuditMetadata(metadata)),
        receipt.receiverEndpointHash,
    ])
    if (inserted.rows[0]) return { ok: true as const, created: true, receipt: receiverReceiptFromAudit(inserted.rows[0] as ReceiverAuditRow) }

    const existing = await run(`
        SELECT audit.*,
               destination.status AS receiver_destination_status,
               destination.endpoint_hash AS receiver_destination_endpoint_hash
        FROM dwm_webhook_audit_events audit
        JOIN dwm_webhook_destinations destination
          ON destination.id = audit.destination_id
         AND destination.org_id = audit.org_id
        WHERE audit.id = $1
          AND audit.org_id = $2
          AND audit.destination_id = $3
          AND audit.action = 'receiver.accepted'
        LIMIT 1
    `, [receipt.id, receipt.orgId, receipt.destinationId])
    if (existing.rows[0]) {
        const existingRow = existing.rows[0] as ReceiverAuditRow & {
            receiver_destination_status: string
            receiver_destination_endpoint_hash: string
        }
        const existingReceipt = receiverReceiptFromAudit(existingRow)
        if (existingReceipt.payloadHash !== receipt.payloadHash
            || existingReceipt.receiverEndpointHash !== receipt.receiverEndpointHash) {
            return { ok: false as const, status: 409, error: 'Receiver idempotency lineage already contains a different payload or target.' }
        }
        if (existingRow.receiver_destination_status !== 'active'
            || existingRow.receiver_destination_endpoint_hash !== receipt.receiverEndpointHash) {
            return { ok: false as const, status: 409, error: 'Receiver destination no longer matches the signed controlled target.' }
        }
        return { ok: true as const, created: false, receipt: existingReceipt }
    }
    return { ok: false as const, status: 404, error: 'Receiver destination is not active in the delivered organization scope.' }
}

export async function listDwmWebhookReceiverReceipts(orgId: string, filters: {
    destinationId?: unknown
    deliveryId?: unknown
    reportCaseId?: unknown
    reportExportChecksum?: unknown
} = {}) {
    const result = await run(`
        SELECT *
        FROM dwm_webhook_audit_events
        WHERE action = 'receiver.accepted'
          AND org_id = $1
          AND ($2::TEXT IS NULL OR destination_id = $2)
          AND ($3::TEXT IS NULL OR delivery_id = $3 OR metadata->>'deliveryId' = $3)
          AND ($4::TEXT IS NULL OR metadata->>'reportCaseId' = $4)
          AND ($5::TEXT IS NULL OR metadata->>'reportExportChecksum' = $5)
        ORDER BY created_at DESC
        LIMIT 100
    `, [
        orgId,
        clean(filters.destinationId) || null,
        clean(filters.deliveryId) || null,
        clean(filters.reportCaseId) || null,
        clean(filters.reportExportChecksum) || null,
    ])
    return (result.rows as ReceiverAuditRow[]).map(receiverReceiptFromAudit)
}

function receiverReceiptFromAudit(row: ReceiverAuditRow) {
    const metadata = recordOrEmpty(row.metadata)
    return {
        id: row.id,
        orgId: row.org_id,
        destinationId: row.destination_id,
        deliveryId: row.delivery_id,
        payloadDeliveryId: clean(metadata.deliveryId),
        eventType: clean(metadata.eventType),
        idempotencyKey: clean(metadata.idempotencyKey),
        payloadHash: clean(metadata.payloadHash),
        receiverEndpointHash: clean(metadata.receiverTargetHash),
        reportValidation: clean(metadata.reportValidation),
        reportCaseId: clean(metadata.reportCaseId) || null,
        reportAlertId: clean(metadata.reportAlertId) || null,
        reportExportChecksum: clean(metadata.reportExportChecksum) || null,
        receivedAt: clean(metadata.receivedAt),
        persistedAt: row.created_at,
    }
}

export async function bindDwmWebhookReceiverReceipt(delivery: ReceiverDeliveryRow, query: typeof run = run) {
    if (!controlledReceiverEndpointHashes().includes(delivery.endpoint_hash)) return false
    const result = await query(`
        UPDATE dwm_webhook_audit_events receipt
           SET delivery_id = $1
         WHERE receipt.action = 'receiver.accepted'
           AND receipt.org_id = $2
           AND receipt.destination_id = $3
           AND receipt.metadata->>'idempotencyKey' = $4
           AND receipt.metadata->>'payloadHash' = $5
           AND receipt.metadata->>'receiverTargetHash' = $6
           AND (
               receipt.delivery_id IS NULL
               OR (
                   $7 = 'delivered'
                   AND EXISTS (
                       SELECT 1
                       FROM dwm_webhook_deliveries prior
                       WHERE prior.id = receipt.delivery_id
                         AND prior.org_id = $2
                         AND prior.destination_id = $3
                         AND prior.status = 'failed'
                         AND prior.dry_run = FALSE
                         AND prior.idempotency_key = $4
                         AND prior.payload_hash = $5
                         AND prior.endpoint_hash = $6
                   )
               )
           )
        RETURNING id
    `, [
        delivery.id,
        delivery.org_id,
        delivery.destination_id,
        delivery.idempotency_key,
        delivery.payload_hash,
        delivery.endpoint_hash,
        delivery.status,
    ])
    return Boolean(result.rows[0])
}

export async function bindExactDwmWebhookReceiverReceipt(delivery: ReceiverDeliveryRow, query: typeof run = run) {
    const bound = await bindDwmWebhookReceiverReceipt(delivery, query)
    if (delivery.status === 'delivered' && controlledReceiverEndpointHashes().includes(delivery.endpoint_hash) && !bound) {
        throw new Error('Controlled receiver accepted delivery without an exact durable receipt.')
    }
}
