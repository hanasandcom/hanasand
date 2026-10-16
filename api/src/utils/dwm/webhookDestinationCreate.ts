import crypto from 'node:crypto'
import run from '#db'
import type { DwmWebhookDestinationInput, DwmWebhookDestinationRow } from './webhookDestinationTypes.ts'
import { normalizeDwmWebhookDestinationInput } from './webhookDestinationInput.ts'
import { toDwmWebhookDestination } from './webhookDestinationModels.ts'
import { assertPublicWebhookTarget } from './webhookTransport.ts'
import { recordDwmWebhookAudit } from './webhookAuditStore.ts'

export async function createDwmWebhookDestination(ownerId: string, input: DwmWebhookDestinationInput) {
    const normalized = normalizeDwmWebhookDestinationInput(input, ownerId)
    if (!normalized.endpointUrl || !normalized.endpointEncrypted || !normalized.endpointHint) {
        throw new Error('endpointUrl is required.')
    }
    await assertPublicWebhookTarget(normalized.endpointUrl)

    const result = await run(`
        INSERT INTO dwm_webhook_destinations (
            id,
            owner_id,
            org_id,
            name,
            kind,
            endpoint_encrypted,
            endpoint_hint,
            endpoint_hash,
            status,
            events,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::TEXT[], $11)
        RETURNING *
    `, [
        crypto.randomUUID(),
        ownerId,
        normalized.orgId,
        normalized.name,
        normalized.kind,
        normalized.endpointEncrypted,
        normalized.endpointHint,
        normalized.endpointHash,
        normalized.status,
        normalized.events,
        ownerId,
    ])

    const destination = result.rows[0] as DwmWebhookDestinationRow
    await recordDwmWebhookAudit({
        ownerId,
        actorId: ownerId,
        orgId: destination.org_id,
        destinationId: destination.id,
        action: 'destination.created',
        metadata: {
            kind: destination.kind,
            endpointHint: destination.endpoint_hint,
            endpointHash: destination.endpoint_hash,
            events: destination.events,
            status: destination.status,
        },
    })

    return { ...toDwmWebhookDestination(destination), signingSecret: normalized.signingSecret }
}
