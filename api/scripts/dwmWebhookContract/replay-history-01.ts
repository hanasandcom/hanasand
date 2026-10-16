/* eslint-disable @typescript-eslint/no-unused-vars -- fixture values are consumed by later sequential modules */
import { webhooks, context as ctx } from './runtime.ts'
const { buildDwmWebhookDeliveryAuditTrail, buildDwmWebhookDeliveryHistory, buildDwmWebhookDeliveryRetryPersistence, buildDwmWebhookDeliveryRetryQueue, buildDwmWebhookDeliveryRetryRequestContract, buildDwmWebhookDeliveryRetryWorkOrders } = webhooks
const { auditDeliveryRows, operationAuditEvents, operationDestinations, replayPayload, replayWorkflowAlert, secret } = ctx

const duplicateReplayGuardHistory = ctx.duplicateReplayGuardHistory = buildDwmWebhookDeliveryHistory({
    liveDeliveryEnabled: true,
    destinations: [
        {
            id: 'destination_duplicate_replay_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            name: 'Duplicate Guard Discord',
            kind: 'discord' as const,
            endpointHint: `https://discord.com/api/webhooks/777777777/${secret}`,
            endpointHash: 'endpoint_duplicate_replay_hash',
            status: 'active' as const,
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
            createdBy: 'owner_contract',
            lastTestedAt: '2026-06-28T12:04:00.000Z',
            lastTestStatus: 'dry_run' as const,
            lastTestError: null,
            lastTestHttpStatus: null,
            lastDeliveryAt: '2026-06-28T12:20:00.000Z',
            createdAt: '2026-06-28T11:00:00.000Z',
            updatedAt: '2026-06-28T12:21:00.000Z',
        },
    ],
    deliveries: [
        {
            id: 'delivery_duplicate_replay_delivered_contract',
            destinationId: 'destination_duplicate_replay_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            alertId: 'alert_duplicate_replay_contract',
            eventType: 'dwm.alert.replayed' as const,
            status: 'delivered' as const,
            dryRun: false,
            endpointHint: `https://discord.com/api/webhooks/777777777/${secret}`,
            endpointHash: 'endpoint_duplicate_replay_hash',
            payloadHash: 'payload_duplicate_replay_delivered_hash',
            payload: replayPayload,
            responseStatus: 204,
            responseBody: '',
            error: null,
            idempotencyKey: 'dwm.alert.replayed:org_contract:destination_duplicate_replay_contract:dwm_dedupe_duplicate_replay_contract',
            watchlistId: 'watchlist_item_replay_contract',
            watchlistName: 'Replay contract watchlist',
            route: 'identity_response',
            casePath: replayWorkflowAlert.casePath,
            attemptedAt: '2026-06-28T12:20:00.000Z',
            createdAt: '2026-06-28T12:20:00.000Z',
        },
        {
            id: 'delivery_duplicate_replay_skipped_contract',
            destinationId: 'destination_duplicate_replay_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            alertId: 'alert_duplicate_replay_contract',
            eventType: 'dwm.alert.replayed' as const,
            status: 'skipped' as const,
            dryRun: false,
            endpointHint: `https://discord.com/api/webhooks/777777777/${secret}`,
            endpointHash: 'endpoint_duplicate_replay_hash',
            payloadHash: 'payload_duplicate_replay_skipped_hash',
            payload: replayPayload,
            responseStatus: null,
            responseBody: null,
            error: 'Delivery skipped because this destination already has a delivered attempt for the same idempotency key.',
            idempotencyKey: 'dwm.alert.replayed:org_contract:destination_duplicate_replay_contract:dwm_dedupe_duplicate_replay_contract',
            watchlistId: 'watchlist_item_replay_contract',
            watchlistName: 'Replay contract watchlist',
            route: 'identity_response',
            casePath: replayWorkflowAlert.casePath,
            attemptedAt: '2026-06-28T12:21:00.000Z',
            createdAt: '2026-06-28T12:21:00.000Z',
        },
    ],
    auditEvents: [
        {
            id: 'audit_duplicate_replay_delivered_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_duplicate_replay_contract',
            deliveryId: 'delivery_duplicate_replay_delivered_contract',
            action: 'delivery.replayed',
            metadata: { status: 'delivered', endpointHint: `https://discord.com/api/webhooks/777777777/${secret}` },
            createdAt: '2026-06-28T12:20:01.000Z',
        },
        {
            id: 'audit_duplicate_replay_skipped_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_duplicate_replay_contract',
            deliveryId: 'delivery_duplicate_replay_skipped_contract',
            action: 'delivery.skipped',
            metadata: { status: 'skipped', reason: 'duplicate_delivered_idempotency_key', endpointHint: `https://discord.com/api/webhooks/777777777/${secret}` },
            createdAt: '2026-06-28T12:21:01.000Z',
        },
    ],
    filters: { orgId: 'org_contract', dedupeKey: 'dwm.alert.replayed:org_contract:destination_duplicate_replay_contract:dwm_dedupe_duplicate_replay_contract' },
})
const deliveryRetryPersistence = ctx.deliveryRetryPersistence = buildDwmWebhookDeliveryRetryPersistence({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
})
const deliveryRetryBase = ctx.deliveryRetryBase = {
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
}
const deliveryRetryAccessScenarios = ctx.deliveryRetryAccessScenarios = {
    admin: {
        viewerRole: 'admin',
        canManage: true,
        visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
    },
    member: {
        viewerRole: 'member',
        canManage: false,
        visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
    },
    nonmember: {
        viewerRole: null,
        canManage: false,
        visibility: { role: undefined, status: undefined, userActive: true, alertVisibilityPolicy: 'members' },
    },
}
type DeliveryRetryAccessScenario = typeof deliveryRetryAccessScenarios[keyof typeof deliveryRetryAccessScenarios]

function buildDeliveryRetryAccessContracts(access: DeliveryRetryAccessScenario) {
    const input = { ...deliveryRetryBase, ...access }
    return {
        queue: buildDwmWebhookDeliveryRetryQueue(input),
        request: buildDwmWebhookDeliveryRetryRequestContract(input),
        workOrders: buildDwmWebhookDeliveryRetryWorkOrders(input),
        auditTrail: buildDwmWebhookDeliveryAuditTrail(input),
    }
}
ctx.buildDeliveryRetryAccessContracts = buildDeliveryRetryAccessContracts

