import crypto from 'node:crypto'
import run from '#db'
import type { DwmWebhookDestinationInput, DwmWebhookDestinationRow } from './webhookDestinationTypes.ts'
import { normalizeDwmWebhookDestinationInput, parseBoolean } from './webhookDestinationInput.ts'
import { toDwmWebhookDestination } from './webhookDestinationModels.ts'
import { decryptWebhookTarget, encryptWebhookTarget } from './webhookDestinationSecrets.ts'
import { assertPublicWebhookTarget, controlledReceiverEndpointHashes } from './webhookTransport.ts'
import { recordDwmWebhookAudit } from './webhookAuditStore.ts'
import { loadDwmWebhookDestination } from './webhookDestinationReads.ts'

export async function updateDwmWebhookDestination(ownerId: string, id: string, input: DwmWebhookDestinationInput) {
    const existing = await loadDwmWebhookDestination(ownerId, id)
    if (!existing) return null

    const normalized = normalizeDwmWebhookDestinationInput(input, ownerId, existing)
    const rotateSigningSecret = parseBoolean(input.rotateSigningSecret ?? input.rotate_signing_secret, false)
    const existingTarget = decryptWebhookTarget(existing.endpoint_encrypted)
    if (rotateSigningSecret && controlledReceiverEndpointHashes().includes(existing.endpoint_hash)) {
        throw new Error('The controlled Hanasand receiver uses managed signing and cannot be rotated here.')
    }
    const rotatedSigningSecret = rotateSigningSecret && existingTarget.endpoint
        ? crypto.randomBytes(32).toString('hex')
        : null
    const endpointEncrypted = rotatedSigningSecret
        ? encryptWebhookTarget(existingTarget.endpoint, rotatedSigningSecret)
        : normalized.endpointEncrypted
    if (normalized.endpointUrl) await assertPublicWebhookTarget(normalized.endpointUrl)
    const result = await run(`
        UPDATE dwm_webhook_destinations
           SET org_id = $2,
               name = $3,
               kind = $4,
               endpoint_encrypted = COALESCE($5, endpoint_encrypted),
               endpoint_hint = COALESCE($6, endpoint_hint),
               endpoint_hash = COALESCE($7, endpoint_hash),
               status = $8,
               events = $9::TEXT[],
               updated_at = NOW()
         WHERE id = $1
         RETURNING *
    `, [
        id,
        normalized.orgId,
        normalized.name,
        normalized.kind,
        endpointEncrypted,
        normalized.endpointHint,
        normalized.endpointHash,
        normalized.status,
        normalized.events,
    ])

    if (!result.rows.length) return null
    const destination = result.rows[0] as DwmWebhookDestinationRow
    await recordDwmWebhookAudit({
        ownerId,
        actorId: ownerId,
        orgId: destination.org_id,
        destinationId: destination.id,
        action: 'destination.updated',
        metadata: {
            kind: destination.kind,
            endpointHint: destination.endpoint_hint,
            endpointHash: destination.endpoint_hash,
            events: destination.events,
            status: destination.status,
        },
    })

    return {
        ...toDwmWebhookDestination(destination),
        ...((normalized.endpointUrl && normalized.signingSecret) || rotatedSigningSecret
            ? { signingSecret: rotatedSigningSecret || normalized.signingSecret }
            : {}),
    }
}

export async function archiveDwmWebhookDestination(ownerId: string, id: string) {
    const existing = await loadDwmWebhookDestination(ownerId, id)
    if (!existing) return null

    const result = await run(`
        UPDATE dwm_webhook_destinations
           SET status = 'archived',
               updated_at = NOW()
         WHERE id = $1
           AND status <> 'archived'
         RETURNING *
    `, [id])

    if (!result.rows.length) return null
    const destination = result.rows[0] as DwmWebhookDestinationRow
    await recordDwmWebhookAudit({
        ownerId,
        actorId: ownerId,
        orgId: destination.org_id,
        destinationId: destination.id,
        action: 'destination.archived',
        metadata: { endpointHint: destination.endpoint_hint, endpointHash: destination.endpoint_hash },
    })

    return toDwmWebhookDestination(destination)
}
