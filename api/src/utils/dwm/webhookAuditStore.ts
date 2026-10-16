import crypto from 'node:crypto'
import run from '#db'
import { redactAuditMetadata } from './webhookValueUtils.ts'

export async function recordDwmWebhookAudit({
    ownerId,
    actorId,
    orgId,
    destinationId = null,
    deliveryId = null,
    action,
    metadata = {},
}: {
    ownerId: string
    actorId: string
    orgId: string
    destinationId?: string | null
    deliveryId?: string | null
    action: string
    metadata?: Record<string, unknown>
}) {
    const id = crypto.randomUUID()
    await run(`
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::JSONB)
    `, [
        id,
        ownerId,
        actorId,
        orgId,
        destinationId,
        deliveryId,
        action,
        JSON.stringify(redactAuditMetadata(metadata)),
    ])
    return id
}
