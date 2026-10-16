import { expect, test } from 'bun:test'
import {
    buildDwmAlertDeliveryPayload,
    buildDwmAlertWebhookDispatchPlan,
    buildDwmAlertWebhookMissingDeliveryIntent,
    buildDwmAlertWebhookReadinessHandoff,
    buildDwmAlertWebhookSkippedDeliveryIntents,
    buildDwmWebhookDestinationCrudContract,
} from '../src/utils/dwm/webhooks.ts'

const orgId = 'org_webhook_contract'
const ownerId = 'owner_webhook_contract'

const alert = {
    id: 'alert_webhook_contract',
    organizationId: orgId,
    tenantId: orgId,
    title: 'Credential exposure',
    severity: 'high',
    firstSeenAt: '2026-10-01T10:00:00.000Z',
    sourceFamily: 'telegram_public',
    matchedTerm: { value: 'example.com', kind: 'domain' },
    evidence: [{ label: 'Public source', detail: 'Observed credential exposure.', capturedAt: '2026-10-01T10:00:00.000Z' }],
    provenance: { captureIds: ['capture_1'], sourceIds: ['source_1'] },
    dedupeKey: 'dedupe_webhook_contract',
    route: 'customer_discord',
    casePath: '/dwm?alert=alert_webhook_contract',
    alertUrl: 'https://app.hanasand.local/dwm?alert=alert_webhook_contract',
    watchlist: { id: 'watchlist_1', name: 'Customer domains', terms: ['example.com'] },
}

const destination = {
    id: 'destination_webhook_contract',
    ownerId,
    orgId,
    name: 'Customer Discord',
    kind: 'discord' as const,
    endpointHint: 'https://discord.com/api/webhooks/123456789/…',
    endpointHash: 'endpoint_webhook_contract',
    status: 'active' as const,
    events: ['dwm.alert.created', 'dwm.alert.replayed'] as Array<'dwm.alert.created' | 'dwm.alert.replayed'>,
    createdBy: ownerId,
    lastTestedAt: null,
    lastTestStatus: null,
    lastTestError: null,
    lastTestHttpStatus: null,
    lastDeliveryAt: null,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    signingConfigured: true,
}

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

test('destination CRUD receipts deny cross-org updates and report delivered idempotency', () => {
    const createInput = {
        orgId,
        label: 'Customer Discord',
        type: 'discord',
        webhookUrl: 'https://discord.com/api/webhooks/999999999/new-secret',
        channelName: '#alerts',
    }
    const create = buildDwmWebhookDestinationCrudContract({
        action: 'create',
        ownerId,
        viewerRole: 'admin',
        canManage: true,
        input: createInput,
    })
    const duplicate = buildDwmWebhookDestinationCrudContract({
        action: 'create',
        ownerId,
        viewerRole: 'admin',
        canManage: true,
        destinations: [{ ...destination, endpointHash: create.desired.redactedEndpoint.endpointHash! }],
        input: createInput,
    })
    const mismatch = buildDwmWebhookDestinationCrudContract({
        action: 'update',
        ownerId,
        viewerRole: 'admin',
        canManage: true,
        destination,
        destinations: [destination],
        input: { orgId: 'org_other', endpointUrl: 'https://discord.com/api/webhooks/123456789/rotated-secret' },
    })
    const alreadyDelivered = buildDwmWebhookDestinationCrudContract({
        action: 'test',
        ownerId,
        viewerRole: 'admin',
        canManage: true,
        destination: { ...destination, id: 'destination_already_sent', endpointHash: 'endpoint_already_sent' },
        destinations: [{ ...destination, id: 'destination_already_sent', endpointHash: 'endpoint_already_sent' }],
        deliveries: [{
            id: 'delivery_test_prior',
            destinationId: 'destination_already_sent',
            ownerId,
            orgId,
            alertId: 'webhook_test',
            eventType: 'dwm.alert.created',
            status: 'delivered',
            dryRun: false,
            endpointHint: destination.endpointHint,
            endpointHash: destination.endpointHash,
            payloadHash: 'payload_test_prior',
            payload: {},
            responseStatus: 204,
            responseBody: null,
            error: null,
            errorClass: null,
            attemptCount: 1,
            nextRetryAt: null,
            idempotencyKey: `dwm.alert.created:${orgId}:destination_already_sent:dedupe_webhook_contract`,
            watchlistId: null,
            watchlistName: null,
            route: null,
            casePath: null,
            attemptedAt: '2026-10-01T10:00:00.000Z',
            completedAt: '2026-10-01T10:00:00.000Z',
            deliveredAt: '2026-10-01T10:00:00.000Z',
            createdAt: '2026-10-01T10:00:00.000Z',
        }],
        input: { orgId },
    })
    const roleDenied = buildDwmWebhookDestinationCrudContract({
        action: 'update',
        ownerId,
        viewerRole: 'member',
        canManage: false,
        destination,
        destinations: [destination],
        input: { orgId, label: 'Member rename denied' },
    })

    expect(create).toMatchObject({ schemaVersion: 'dwm.webhook.destination_crud.v1', action: 'create', canApply: true, orgId })
    expect(create.desired).toMatchObject({ label: 'Customer Discord', channel: '#alerts', type: 'discord' })
    expect(create.managementRequest).toMatchObject({ method: 'POST', route: '/api/dwm/webhook-destinations', canSend: true })
    expect(create.destinationPersistenceReceipt).toMatchObject({ action: 'create', noNetwork: true, redactedTarget: { endpoint: { endpointExposed: false } } })
    expect(JSON.stringify(create)).not.toContain('new-secret')

    expect(duplicate.canApply).toBe(false)
    expect(duplicate.blockingCodes).toContain('duplicate_destination')
    expect(duplicate.destinationPersistenceReceipt.mutation.persisted).toBe(false)

    expect(mismatch.canApply).toBe(false)
    expect(mismatch.blockingCodes).toContain('org_scope_mismatch')
    expect(mismatch.managementRequest.canSend).toBe(false)
    expect(mismatch.destinationPersistenceReceipt.mutation.persisted).toBe(false)
    expect(mismatch.destinationPersistenceReceipt.denial.blockingCodes).toContain('org_scope_mismatch')
    expect(JSON.stringify(mismatch)).not.toContain('rotated-secret')

    expect(roleDenied.blockingCodes).toContain('permission_denied')
    expect(roleDenied.managementRequest.canSend).toBe(false)
    expect(roleDenied.destinationPersistenceReceipt.mutation.persisted).toBe(false)

    expect(alreadyDelivered.canApply).toBe(true)
    expect(alreadyDelivered.blockers).toContainEqual(expect.objectContaining({ code: 'idempotency_duplicate', blocking: false }))
    expect(alreadyDelivered.destinationPersistenceReceipt.idempotency.alreadyDelivered).toBe(true)
    expect(alreadyDelivered.destinationPersistenceReceipt).toMatchObject({ noNetwork: true, externalSendEnabled: false })
})
