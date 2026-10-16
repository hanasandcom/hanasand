import { expect, test } from 'bun:test'
import {
    buildDwmAlertDeliveryPayload,
    buildDwmAlertWebhookDispatchPlan,
    buildDwmAlertWebhookMissingDeliveryIntent,
    buildDwmAlertWebhookReadinessHandoff,
    buildDwmAlertWebhookSkippedDeliveryIntents,
} from '../src/utils/dwm/webhooks.ts'
import { alert, destination, orgId, ownerId } from './fixtures/dwm-webhook-core-contracts.ts'

test('Discord payloads stay within wire limits and omit endpoint credentials', () => {
    const payload = buildDwmAlertDeliveryPayload({
        destination: { id: destination.id, kind: destination.kind, name: destination.name, org_id: orgId },
        eventType: 'dwm.alert.created',
        deliveryId: 'delivery_limits',
        alert: {
            ...alert,
            title: 'long title '.repeat(80),
            claimSummary: 'long description '.repeat(500),
            recommendedAction: 'long action '.repeat(200),
            evidence: [{ label: 'long evidence label '.repeat(20), detail: 'long evidence detail '.repeat(100) }],
            endpointUrl: 'https://discord.com/api/webhooks/123456789/webhook-secret-sentinel',
        },
    }) as Record<string, any>
    const embed = payload.embeds[0]

    expect(payload.content.length).toBeLessThanOrEqual(2000)
    expect(embed.title.length).toBeLessThanOrEqual(256)
    expect(embed.description.length).toBeLessThanOrEqual(4096)
    expect(embed.fields.length).toBeLessThanOrEqual(25)
    expect(embed.fields.every((field: { name: string, value: string }) => field.name.length <= 256 && field.value.length <= 1024)).toBe(true)
    expect(payload.allowed_mentions).toEqual({ parse: [] })
    expect(JSON.stringify(payload)).not.toContain('webhook-secret-sentinel')
})

test('dispatch selects only subscribed active destinations in the alert organization', () => {
    const plan = buildDwmAlertWebhookDispatchPlan({
        ownerId,
        input: { ...alert, eventType: 'dwm.alert.replayed' },
        destinations: [
            { id: 'active_replay', org_id: orgId, status: 'active', events: ['dwm.alert.replayed'] },
            { id: 'paused', org_id: orgId, status: 'paused', events: ['dwm.alert.replayed'] },
            { id: 'wrong_event', org_id: orgId, status: 'active', events: ['dwm.alert.created'] },
            { id: 'foreign', org_id: 'org_foreign', status: 'active', events: ['dwm.alert.replayed'] },
        ],
    })
    const skippedIntents = buildDwmAlertWebhookSkippedDeliveryIntents(plan)

    expect(plan.selectedDestinations.map(row => row.id)).toEqual(['active_replay'])
    expect(plan.skippedDestinations.map(row => [row.id, row.reason])).toEqual([
        ['paused', 'disabled'],
        ['wrong_event', 'event_not_subscribed'],
        ['foreign', 'org_mismatch'],
    ])
    expect(skippedIntents.map(row => row.destinationId).sort()).toEqual(['paused', 'wrong_event'])
    expect(skippedIntents.every(row => row.persistable && row.orgId === orgId)).toBe(true)
})

test('missing destinations produce a persistable skip and blocked readiness without a preview', () => {
    const input = {
        organizationId: orgId,
        alertId: alert.id,
        eventType: 'dwm.alert.created' as const,
        watchlistItemId: 'watchlist_1',
        dedupeKey: alert.dedupeKey,
        casePath: alert.casePath,
        sourceFamily: alert.sourceFamily,
        alert,
    }
    const plan = buildDwmAlertWebhookDispatchPlan({ ownerId, input, destinations: [] })
    const intent = buildDwmAlertWebhookMissingDeliveryIntent(plan)
    const requestedIntent = buildDwmAlertWebhookMissingDeliveryIntent(plan, 'destination_requested')
    const readiness = buildDwmAlertWebhookReadinessHandoff({
        ownerId,
        input,
        destinations: [],
        liveDeliveryEnabled: false,
    })

    expect(intent).toMatchObject({
        orgId,
        reason: 'missing_destination',
        persistable: true,
        idempotencyKey: `dwm.alert.created:${orgId}:missing_destination:${alert.dedupeKey}`,
    })
    expect(requestedIntent).toMatchObject({ reason: 'requested_destination_not_found', requestedDestinationId: 'destination_requested' })
    expect(readiness).toMatchObject({ ready: false, state: 'missing_destination', externalSendEnabled: false })
    expect(readiness.alertEventConsumer).toMatchObject({
        ready: false,
        state: 'missing_destination',
        noNetwork: true,
        payloadPreview: null,
        blockerCodes: ['no_enabled_destination'],
    })
    expect(readiness.alertEventConsumer.auditReadiness.auditMissing).toBe(true)
})
