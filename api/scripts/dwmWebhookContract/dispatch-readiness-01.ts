import { webhooks, context as ctx, expect } from './runtime.ts'
const { buildDwmAlertDeliveryPayload, buildDwmAlertWebhookDispatchPlan, buildDwmAlertWebhookMissingDeliveryIntent, buildDwmAlertWebhookReadinessHandoff, buildDwmAlertWebhookSkippedDeliveryIntents } = webhooks
const { secret } = ctx

const dispatchPlan = ctx.dispatchPlan = buildDwmAlertWebhookDispatchPlan({
    ownerId: 'owner_contract',
    input: {
        organizationId: 'org_contract',
        alertId: 'alert_bridge_contract',
        eventType: 'dwm.alert.replayed',
        watchlistItemId: 'watchlist_bridge_contract',
        watchlistName: 'Bridge watchlist',
        dedupeKey: 'dwm_dedupe_bridge_contract',
        route: 'customer_discord',
        casePath: '/dwm?alert=alert_bridge_contract',
        evidenceCount: 4,
        sourceFamily: 'telegram_public',
    },
    destinations: [
        {
            id: 'destination_active',
            org_id: 'org_contract',
            name: 'Active Discord',
            kind: 'discord',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
        },
        {
            id: 'destination_paused',
            org_id: 'org_contract',
            name: 'Paused Discord',
            kind: 'discord',
            status: 'paused',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
        },
        {
            id: 'destination_created_only',
            org_id: 'org_contract',
            name: 'Created only',
            kind: 'webhook',
            status: 'active',
            events: ['dwm.alert.created'],
        },
        {
            id: 'destination_foreign_org',
            org_id: 'org_foreign',
            name: 'Foreign org',
            kind: 'discord',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
        },
    ],
})

expect(dispatchPlan.orgId === 'org_contract', 'Dispatch plan should resolve organizationId.', dispatchPlan)
expect(dispatchPlan.eventType === 'dwm.alert.replayed', 'Dispatch plan should resolve replay event type.', dispatchPlan)
const skippedDeliveryIntents = ctx.skippedDeliveryIntents = buildDwmAlertWebhookSkippedDeliveryIntents(dispatchPlan)
expect(skippedDeliveryIntents.every(item => item.persistable === true && item.idempotencyKey.includes(`:${item.orgId}:${item.destinationId}:`)), 'Skipped delivery intents should carry durable idempotency keys.', skippedDeliveryIntents)
expect(skippedDeliveryIntents.some(item => item.reason === 'disabled' && item.error.includes('disabled')), 'Skipped delivery intents should explain disabled destinations.', skippedDeliveryIntents)
expect(!JSON.stringify(skippedDeliveryIntents).includes('destination_foreign_org'), 'Skipped delivery intents must not persist foreign-org destination leakage.', skippedDeliveryIntents)
const missingDestinationPlan = ctx.missingDestinationPlan = buildDwmAlertWebhookDispatchPlan({
    ownerId: 'owner_contract',
    input: {
        organizationId: 'org_contract',
        alertId: 'alert_missing_destination_contract',
        eventType: 'dwm.alert.created',
        watchlistItemId: 'watchlist_missing_destination_contract',
        dedupeKey: 'dwm_dedupe_missing_destination_contract',
        route: 'customer_discord',
        casePath: '/dwm?alert=alert_missing_destination_contract',
        evidenceCount: 1,
        sourceFamily: 'telegram_public',
    },
    destinations: [],
})
const missingDestinationIntent = ctx.missingDestinationIntent = buildDwmAlertWebhookMissingDeliveryIntent(missingDestinationPlan)
const requestedMissingDestinationIntent = ctx.requestedMissingDestinationIntent = buildDwmAlertWebhookMissingDeliveryIntent(missingDestinationPlan, 'destination_requested_missing')
const missingDestinationReadiness = ctx.missingDestinationReadiness = buildDwmAlertWebhookReadinessHandoff({
    ownerId: 'owner_contract',
    input: {
        organizationId: 'org_contract',
        alertId: 'alert_missing_destination_contract',
        eventType: 'dwm.alert.created',
        watchlistItemId: 'watchlist_missing_destination_contract',
        dedupeKey: 'dwm_dedupe_missing_destination_contract',
        route: 'customer_discord',
        casePath: '/dwm?alert=alert_missing_destination_contract',
        evidenceCount: 1,
        sourceFamily: 'telegram_public',
        alert: {
            id: 'alert_missing_destination_contract',
            title: 'Missing destination alert-created event',
            severity: 'medium',
            sourceFamily: 'telegram_public',
            evidence: [{ label: 'Capture', detail: 'Alert-created fixture proof.' }],
            provenance: { captureIds: ['capture_missing_destination'], sourceIds: ['source_missing_destination'] },
            watchlist: { id: 'watchlist_missing_destination_contract', terms: ['missing.example'] },
        },
    },
    destinations: [],
    deliveries: [],
    auditEvents: [],
    liveDeliveryEnabled: false,
})
expect(missingDestinationIntent?.reason === 'missing_destination' && missingDestinationIntent.error.includes('no enabled webhook destination'), 'Missing destination dispatch should create a durable skipped delivery intent.', missingDestinationIntent)
expect(missingDestinationIntent?.persistable === true && !JSON.stringify([missingDestinationIntent, requestedMissingDestinationIntent]).includes(secret), 'Missing destination intents should be persistable and secret-free.', { missingDestinationIntent, requestedMissingDestinationIntent })
expect(missingDestinationReadiness.alertEventConsumer.blockerCodes.includes('no_enabled_destination') && missingDestinationReadiness.alertEventConsumer.requiredFields.orgId === true, 'Alert event consumer should keep typed blockers and required fields for missing destinations.', missingDestinationReadiness.alertEventConsumer)
expect(missingDestinationReadiness.alertEventConsumer.payloadValidation.valid === false && missingDestinationReadiness.alertEventConsumer.payloadValidation.missingDiscordFields.length > 0, 'Alert event consumer should mark payload validation invalid when no destination preview exists.', missingDestinationReadiness.alertEventConsumer.payloadValidation)
expect(missingDestinationReadiness.alertEventConsumer.auditReadiness.auditMissing === true && missingDestinationReadiness.alertEventConsumer.auditReadiness.linkedAuditEventIds.length === 0, 'Alert event consumer should expose missing audit linkage when no destination attempt exists.', missingDestinationReadiness.alertEventConsumer.auditReadiness)

const bridgePayload = ctx.bridgePayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: dispatchPlan.selectedDestinations[0].id,
        kind: 'discord',
        name: dispatchPlan.selectedDestinations[0].name,
        org_id: dispatchPlan.orgId,
    },
    eventType: dispatchPlan.eventType,
    deliveryId: 'delivery_bridge_contract',
    alert: dispatchPlan.alert,
}) as Record<string, unknown>
const bridgeSerialized = ctx.bridgeSerialized = JSON.stringify(bridgePayload)
expect(bridgeSerialized.includes('telegram_public'), 'Dispatch payload should propagate source family.', bridgePayload)
expect(bridgeSerialized.includes('Evidence count') && bridgeSerialized.includes('4'), 'Dispatch payload should propagate evidence count.', bridgePayload)
expect(bridgeSerialized.includes('watchlist_bridge_contract'), 'Dispatch payload should propagate watchlist context.', bridgePayload)
expect(bridgeSerialized.includes('dwm_dedupe_bridge_contract'), 'Dispatch payload should propagate dedupe key.', bridgePayload)
expect(bridgeSerialized.includes('/dwm?alert=alert_bridge_contract'), 'Dispatch payload should propagate case path.', bridgePayload)
