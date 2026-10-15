import { expect, test } from 'bun:test'
import {
    buildDwmWebhookDeliveryEvidence,
    buildDwmWebhookDeliveryHistory,
    buildDwmWebhookDeliveryLedger,
    buildDwmWebhookDeliveryOperations,
    toDwmWebhookAuditEvent,
    toDwmWebhookDelivery,
    toDwmWebhookDestination,
} from '../src/utils/dwm/webhooks.ts'

const destination = toDwmWebhookDestination({
    id: 'destination_1',
    owner_id: 'owner_1',
    org_id: 'org_1',
    name: 'Receiver',
    kind: 'webhook',
    endpoint_encrypted: 'https://receiver.example/hook',
    endpoint_hint: 'receiver.example/...',
    endpoint_hash: 'endpoint_hash_1',
    status: 'active',
    events: ['dwm.alert.updated'],
    created_by: 'owner_1',
    last_tested_at: null,
    last_test_status: null,
    last_test_error: null,
    last_test_http_status: null,
    last_delivery_at: null,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
})

const payload = {
    schemaVersion: 'dwm.webhook.v1',
    alert: {
        id: 'alert_1',
        title: 'Evidence-backed alert',
        severity: 'medium',
        sourceFamily: 'clear_web',
        evidenceCount: 1,
        dedupeKey: 'case_1',
        casePath: '/dwm?alert=alert_1',
        provenance: { captureIds: ['capture_1'], sourceIds: ['source_1'] },
    },
    watchlist: { id: 'watch_1', name: 'Example domains', terms: ['example.com'] },
    delivery: {
        dedupeKey: 'case_1',
        route: 'customer_webhook',
        casePath: '/dwm?alert=alert_1',
    },
    _hanasand: {
        alert: {
            id: 'alert_1',
            title: 'Evidence-backed alert',
            severity: 'medium',
            sourceFamily: 'clear_web',
            evidenceCount: 1,
            dedupeKey: 'case_1',
            casePath: '/dwm?alert=alert_1',
            provenance: { captureIds: ['capture_1'], sourceIds: ['source_1'] },
        },
        watchlist: { id: 'watch_1', name: 'Example domains', terms: ['example.com'] },
        delivery: {
            dedupeKey: 'case_1',
            route: 'customer_webhook',
            casePath: '/dwm?alert=alert_1',
        },
    },
}

const deliveries = [
    toDwmWebhookDelivery({
        id: 'delivery_1',
        destination_id: 'destination_1',
        owner_id: 'owner_1',
        org_id: 'org_1',
        alert_id: 'alert_1',
        event_type: 'dwm.alert.updated',
        status: 'failed',
        dry_run: false,
        endpoint_hint: destination.endpointHint,
        endpoint_hash: destination.endpointHash,
        payload_hash: 'payload_hash_1',
        payload,
        response_status: 503,
        response_body: 'upstream unavailable',
        error: 'Webhook returned HTTP 503.',
        error_class: 'upstream_5xx',
        attempt_count: 1,
        next_retry_at: '2026-10-01T10:01:00.000Z',
        idempotency_key: 'dwm.alert.updated:org_1:destination_1:case_1',
        watchlist_id: 'watch_1',
        watchlist_name: 'Example domains',
        route: 'customer_webhook',
        case_path: '/dwm?alert=alert_1',
        attempted_at: '2026-10-01T10:00:01.000Z',
        completed_at: '2026-10-01T10:00:02.000Z',
        delivered_at: null,
        created_at: '2026-10-01T10:00:00.000Z',
    }),
    toDwmWebhookDelivery({
        id: 'delivery_2',
        destination_id: 'destination_1',
        owner_id: 'owner_1',
        org_id: 'org_1',
        alert_id: 'alert_1',
        event_type: 'dwm.alert.updated',
        status: 'delivered',
        dry_run: false,
        endpoint_hint: destination.endpointHint,
        endpoint_hash: destination.endpointHash,
        payload_hash: 'payload_hash_2',
        payload,
        response_status: 204,
        response_body: null,
        error: null,
        error_class: null,
        attempt_count: 2,
        next_retry_at: null,
        idempotency_key: 'dwm.alert.updated:org_1:destination_1:case_1',
        watchlist_id: 'watch_1',
        watchlist_name: 'Example domains',
        route: 'customer_webhook',
        case_path: '/dwm?alert=alert_1',
        attempted_at: '2026-10-01T10:02:01.000Z',
        completed_at: '2026-10-01T10:02:02.000Z',
        delivered_at: '2026-10-01T10:02:02.000Z',
        created_at: '2026-10-01T10:02:00.000Z',
    }),
]

const auditEvents = deliveries.map((delivery, index) => toDwmWebhookAuditEvent({
    id: `audit_${index + 1}`,
    owner_id: 'owner_1',
    actor_id: 'owner_1',
    org_id: 'org_1',
    destination_id: 'destination_1',
    delivery_id: delivery.id,
    action: index === 0 ? 'delivery.retry_scheduled' : 'delivery.sent',
    metadata: { status: delivery.status, idempotencyKey: delivery.idempotencyKey },
    created_at: `2026-10-01T10:0${index + 1}:03.000Z`,
}))

test('projects shared evidence, attempts, operations and history without losing lifecycle links', () => {
    const input = { deliveries, auditEvents, destinations: [destination] }
    const evidence = buildDwmWebhookDeliveryEvidence(input)
    const ledger = buildDwmWebhookDeliveryLedger(input)
    const operations = buildDwmWebhookDeliveryOperations(input)
    const history = buildDwmWebhookDeliveryHistory(input)

    expect(evidence.map(item => [item.deliveryId, item.auditEventId])).toEqual([
        ['delivery_1', 'audit_1'],
        ['delivery_2', 'audit_2'],
    ])
    expect(ledger.map(item => [item.deliveryId, item.status, item.attemptCount])).toEqual([
        ['delivery_1', 'failed', 1],
        ['delivery_2', 'sent', 2],
    ])
    expect(operations.recentDeliveries.map(item => item.deliveryId)).toEqual(['delivery_2', 'delivery_1'])
    expect(history.entries.map(item => item.deliveryId)).toEqual(['delivery_2', 'delivery_1'])
    expect(history.entries[0]).toMatchObject({
        status: 'sent',
        destination: { id: 'destination_1', label: 'Receiver', enabled: true },
        deliveryProof: { auditEventId: 'audit_2', payloadHash: 'payload_hash_2' },
        retry: { attemptCount: 2 },
        alert: { id: 'alert_1', title: 'Evidence-backed alert', evidenceCount: 1 },
        dedupe: { alreadyDelivered: true, duplicateAttemptCount: 2 },
    })

    const filtered = buildDwmWebhookDeliveryHistory({ ...input, filters: { action: 'delivery.retry_scheduled' } })
    expect(filtered).toMatchObject({
        total: 1,
        counts: { failed: 1 },
        filters: { action: 'delivery.retry_scheduled' },
        entries: [{ deliveryId: 'delivery_1', deliveryProof: { auditEventId: 'audit_1' } }],
    })
})
