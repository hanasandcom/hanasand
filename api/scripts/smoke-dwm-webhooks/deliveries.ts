import {
    buildDwmAlertDeliveryPayload,
    buildDwmAlertWebhookNotificationInput,
    buildDwmWebhookDeliveryPreview,
    buildDwmWebhookDestinationContracts,
    deliverDwmAlertNotification,
    listDwmWebhookAuditEvents,
    listDwmWebhookDeliveries,
    listDwmWebhookDestinations,
    testDwmWebhookDestination,
} from '#utils/dwm/webhooks.ts'
import { SmokeAlert } from './alert.ts'
import { SmokeDestination } from './destination.ts'
import { endpointSecret, expect, orgId, otherUserId, ownerId } from './state.ts'

export async function exerciseDeliveries(destination: SmokeDestination, alert: SmokeAlert) {
    verifyPayloadPreview(destination, alert)
    const testDelivery = await createDryRunTest(destination)
    const replayDeliveries = await replayAlert(alert)
    const blockedLive = await verifyLiveSafetyGate(destination, alert)
    await verifySharedDestination(destination)

    const deliveries = await listDwmWebhookDeliveries(ownerId, orgId)
    expect(deliveries.length >= 3, 'Deliveries were not persisted.', deliveries)
    expect(deliveries.every(delivery => delivery.endpointHash && delivery.payloadHash && delivery.attemptedAt), 'Delivery ledger should include hashes and attemptedAt.', deliveries)
    const refreshedDestination = (await listDwmWebhookDestinations(ownerId, orgId)).find(item => item.id === destination.id)
    expect(refreshedDestination?.lastTestStatus === 'dry_run', 'Destination should persist the latest test result.', refreshedDestination)
    const auditEvents = await listDwmWebhookAuditEvents(ownerId, orgId)
    verifyContractAndDryRunPreview(refreshedDestination, deliveries, auditEvents, testDelivery, replayDeliveries)

    return { testDelivery, replayDeliveries, blockedLive, deliveries, refreshedDestination, auditEvents }
}

function verifyPayloadPreview(destination: SmokeDestination, alert: SmokeAlert) {
    const payload = buildDwmAlertDeliveryPayload({
        destination: { id: destination.id, kind: 'discord', name: destination.name, org_id: orgId },
        alert,
        eventType: 'dwm.alert.created',
        deliveryId: 'preview-delivery',
    }) as Record<string, unknown>
    const context = payload._hanasand as Record<string, unknown>
    expect(Array.isArray(payload.embeds), 'Discord payload should include embeds.', payload)
    expect(JSON.stringify(payload).includes('Acme Security'), 'Payload should include organization context.', payload)
    expect(JSON.stringify(context).includes('acme-security.com'), 'Payload should include watchlist or matched-term context.', context)
    expect(JSON.stringify(payload).includes('Evidence count'), 'Discord payload should expose evidence count.', payload)
    expect(JSON.stringify(payload).includes('customer_discord'), 'Discord payload should expose delivery route.', payload)
    expect(JSON.stringify(payload).includes('/dwm?alert='), 'Discord payload should expose the case path.', payload)
    expect(JSON.stringify(payload).includes('dwm.alert.created'), 'Discord payload should expose event type in context.', payload)
    expect(!JSON.stringify(payload).includes(endpointSecret), 'Delivery payload leaked webhook secret.', payload)
}

async function createDryRunTest(destination: SmokeDestination) {
    const delivery = await testDwmWebhookDestination(ownerId, destination.id, { dryRun: true })
    expect(delivery?.status === 'dry_run', 'Test delivery should default to dry_run.', delivery)
    expect(delivery.alertId.startsWith('webhook_test_'), 'Test delivery should use the test alert contract.', delivery)
    expect(delivery.endpointHash?.startsWith('endpoint_'), 'Test delivery should persist endpoint hash.', delivery)
    expect(delivery.payloadHash?.startsWith('payload_'), 'Test delivery should persist payload hash.', delivery)
    expect(delivery.attemptedAt, 'Test delivery should expose attemptedAt.', delivery)
    expect(!JSON.stringify(delivery).includes(endpointSecret), 'Test delivery leaked webhook secret.', delivery)
    return delivery
}

async function replayAlert(alert: SmokeAlert) {
    const input = buildDwmAlertWebhookNotificationInput(alert, { eventType: 'dwm.alert.replayed', dryRun: true })
    const deliveries = await deliverDwmAlertNotification(ownerId, input)
    expect(input.organizationId === orgId && input.watchlistItemId === 'watchlist-acme', 'Replay adapter should map org and watchlist context for DB verification.', input)
    expect(deliveries.length === 1, 'Replay should deliver to the active org destination.', deliveries)
    expect(deliveries[0].status === 'dry_run', 'Replay delivery should stay dry-run when requested.', deliveries[0])
    expect(deliveries[0].payload && JSON.stringify(deliveries[0].payload).includes('dwm.alert.replayed'), 'Replay payload should include event type.', deliveries[0])
    expect(deliveries[0].watchlistId === 'watchlist-acme', 'Replay delivery should persist watchlist context.', deliveries[0])
    expect(deliveries[0].route === 'customer_discord', 'Replay delivery should persist route context.', deliveries[0])
    expect(deliveries[0].casePath?.includes('/dwm?alert='), 'Replay delivery should persist case path.', deliveries[0])
    return deliveries
}

async function verifyLiveSafetyGate(destination: SmokeDestination, alert: SmokeAlert) {
    const deliveries = await deliverDwmAlertNotification(ownerId, {
        orgId,
        destinationId: destination.id,
        eventType: 'dwm.alert.created',
        alert,
        dryRun: false,
        live: true,
    })
    expect(deliveries[0]?.status === 'skipped', 'Live delivery should be skipped unless explicitly enabled by env.', deliveries)
    expect(String(deliveries[0]?.error || '').includes('Live DWM webhook delivery is disabled'), 'Skipped live delivery should explain the safety gate.', deliveries[0])
    return deliveries
}

async function verifySharedDestination(destination: SmokeDestination) {
    const destinations = await listDwmWebhookDestinations(otherUserId, orgId)
    expect(destinations.some(item => item.id === destination.id), 'Org member should be able to see org-scoped destinations through the shared contract.', destinations)
}

function verifyContractAndDryRunPreview(
    refreshedDestination: Awaited<ReturnType<typeof listDwmWebhookDestinations>>[number] | undefined,
    deliveries: Awaited<ReturnType<typeof listDwmWebhookDeliveries>>,
    auditEvents: Awaited<ReturnType<typeof listDwmWebhookAuditEvents>>,
    testDelivery: NonNullable<Awaited<ReturnType<typeof testDwmWebhookDestination>>>,
    replayDeliveries: Awaited<ReturnType<typeof deliverDwmAlertNotification>>,
) {
    const contracts = buildDwmWebhookDestinationContracts({
        destinations: [refreshedDestination].filter(Boolean) as NonNullable<typeof refreshedDestination>[],
        deliveries,
        auditEvents,
    })
    const contract = contracts[0]
    const preview = buildDwmWebhookDeliveryPreview(testDelivery)
    expect(contract, 'Destination contract should be built from the refreshed destination.', contracts)
    expect(contract?.type === 'discord' && contract.label === 'Customer Discord', 'Destination contract should expose customer-facing type and label.', contract)
    expect(contract.enabled === true && contract.redactedUrl.includes('/api/webhooks/1234567890/...'), 'Destination contract should expose enabled redacted Discord ref.', contract)
    expect(contract.lastTest.requestId === testDelivery.id && contract.lastTest.auditEventId, 'Destination contract should expose last test request and audit ids.', contract)
    expect(contract.lastDelivery.requestId === replayDeliveries[0].id && contract.lastDelivery.auditEventId, 'Destination contract should expose last delivery request and audit ids.', contract)
    expect(!JSON.stringify(contract).includes(endpointSecret), 'Destination contract leaked Discord endpoint secret.', contract)
    expect(Array.isArray(preview.discord.embeds) && preview.discord.embeds.length === 1, 'Dry-run test preview should expose Discord-ready embeds.', preview)
    expect(preview.context.org.id === orgId, 'Dry-run test preview should expose org context.', preview)
    expect(preview.context.watchlist.id === 'test-watchlist', 'Dry-run test preview should expose watchlist context.', preview)
    expect(preview.context.alert.severity === 'medium' && preview.context.alert.casePath === '/dwm', 'Dry-run test preview should expose alert severity and case path.', preview)
    expect(!JSON.stringify(preview).includes(endpointSecret), 'Dry-run test preview leaked Discord endpoint secret.', preview)
}
