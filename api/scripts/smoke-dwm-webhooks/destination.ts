import run from '#db'
import { createDwmWebhookDestination } from '#utils/dwm/webhooks.ts'
import { discordEndpoint, endpointSecret, expect, orgId, ownerId } from './state.ts'

export async function createDestination() {
    const destination = await createDwmWebhookDestination(ownerId, {
        orgId,
        name: 'Customer Discord',
        kind: 'discord',
        endpointUrl: discordEndpoint,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
    })

    expect(destination.orgId === orgId, 'Destination did not persist org scope.', destination)
    expect(destination.kind === 'discord', 'Discord destination kind was not persisted.', destination)
    expect(destination.endpointHint.includes('/api/webhooks/1234567890/...'), 'Endpoint hint should be Discord-friendly and redacted.', destination)
    expect(destination.endpointHash?.startsWith('endpoint_'), 'Destination should expose an endpoint hash for support correlation.', destination)
    expect(!JSON.stringify(destination).includes(endpointSecret), 'Destination response leaked webhook secret.', destination)

    const stored = await run('SELECT endpoint_encrypted, endpoint_hint, endpoint_hash FROM dwm_webhook_destinations WHERE id = $1', [destination.id])
    expect(stored.rows.length === 1, 'Destination row was not persisted.')
    expect(!String(stored.rows[0].endpoint_encrypted).includes(endpointSecret), 'Encrypted endpoint leaked raw secret.', stored.rows[0])
    expect(!String(stored.rows[0].endpoint_hint).includes(endpointSecret), 'Endpoint hint leaked raw secret.', stored.rows[0])
    expect(String(stored.rows[0].endpoint_hash).startsWith('endpoint_'), 'Endpoint hash was not persisted.', stored.rows[0])
    return destination
}

export type SmokeDestination = Awaited<ReturnType<typeof createDestination>>
