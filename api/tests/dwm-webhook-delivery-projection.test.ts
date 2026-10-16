import { expect, setSystemTime, test } from 'bun:test'
import { dwmWebhookDestinationRow } from './fixtures/dwm-webhook-destination.ts'
import {
    buildDwmAlertWebhookReadinessHandoff,
    buildDwmOrgAlertWebhookDeliveryContract,
    buildDwmOrgAlertWebhookDeliveryOutcome,
    buildDwmWebhookDeliveryRetryContract,
    buildDwmWebhookDeliveryEvidence,
    buildDwmWebhookDeliveryHistory,
    buildDwmWebhookDeliveryHistoryConsumerProof,
    buildDwmWebhookDeliveryAttemptPersistenceReadModel,
    buildDwmWebhookDeliveryLedger,
    buildDwmWebhookDeliveryOperations,
    buildDwmWebhookDeliveryRetryPersistence,
    buildDwmWebhookDestinationReadModels,
    toDwmWebhookAuditEvent,
    toDwmWebhookDelivery,
    toDwmWebhookDestination,
} from '../src/utils/dwm/webhooks.ts'

const destination = toDwmWebhookDestination(dwmWebhookDestinationRow())

test('maps audit fields joined onto delivery rows', () => {
    const delivery = toDwmWebhookDelivery({
        id: 'delivery_mapping_contract',
        audit_event_id: 'audit_mapping_contract',
        audit_action: 'delivery.replayed',
        audit_actor_id: 'owner_contract',
    } as Parameters<typeof toDwmWebhookDelivery>[0])

    expect(delivery).toMatchObject({
        auditEventId: 'audit_mapping_contract',
        auditAction: 'delivery.replayed',
        auditActorId: 'owner_contract',
    })
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
    const input = { deliveries, auditEvents, destinations: [destination], liveDeliveryEnabled: false }
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
    expect(Object.keys(operations)).toEqual(['schemaVersion', 'liveDeliveryEnabled', 'filters', 'total', 'counts', 'recentDeliveries'])
    expect(operations.filters).toEqual({
        orgId: null,
        destinationId: null,
        alertId: null,
        casePath: null,
        caseActionId: null,
        caseActionPath: null,
        dedupeKey: null,
        requestId: null,
        idempotencyKey: null,
        action: null,
        status: null,
        timeFrom: null,
        timeTo: null,
        retryState: null,
        actorId: null,
    })
    expect(Object.keys(history)).toEqual(['schemaVersion', 'liveDeliveryEnabled', 'filters', 'total', 'counts', 'entries'])
    expect(history).toMatchObject({
        schemaVersion: 'dwm.webhook.delivery_history.v1',
        liveDeliveryEnabled: false,
        filters: operations.filters,
        total: operations.total,
        counts: operations.counts,
    })
    expect(history.entries[0]).toMatchObject({
        status: 'sent',
        destination: { id: 'destination_1', label: 'Receiver', enabled: true },
        deliveryProof: { auditEventId: 'audit_2', payloadHash: 'payload_hash_2' },
        retry: { attemptCount: 2 },
        alert: { id: 'alert_1', title: 'Evidence-backed alert', evidenceCount: 1 },
        dedupe: { alreadyDelivered: true, duplicateAttemptCount: 2 },
    })

    const filters = { action: 'delivery.retry_scheduled' }
    const filteredOperations = buildDwmWebhookDeliveryOperations({ ...input, filters })
    expect(filteredOperations.recentDeliveries.map(item => item.deliveryId)).toEqual(['delivery_1'])
    expect(filteredOperations.filters.action).toBe('delivery.retry_scheduled')

    const filtered = buildDwmWebhookDeliveryHistory({ ...input, filters })
    expect(filtered).toMatchObject({
        total: 1,
        counts: { failed: 1 },
        filters: { action: 'delivery.retry_scheduled' },
        entries: [{ deliveryId: 'delivery_1', deliveryProof: { auditEventId: 'audit_1' } }],
    })
})

test('retry persistence uses the shared ledger and its supplied planning time', () => {
    const delivery = {
        ...deliveries[0],
        attemptedAt: null,
        nextRetryAt: null,
    }
    const persistence = buildDwmWebhookDeliveryRetryPersistence({
        deliveries: [delivery],
        auditEvents: [auditEvents[0]],
        destinations: [destination],
        liveDeliveryEnabled: true,
        now: new Date('2026-10-01T10:00:00.000Z'),
    })

    expect(persistence.deliveryKeys[0]).toMatchObject({
        idempotencyKey: delivery.idempotencyKey,
        retry: { retryable: true, nextRetryAt: '2026-10-01T10:01:00.000Z' },
        audit: { auditEventIds: ['audit_1'] },
    })
})

test('history consumer reuses shared evidence and preserves retry projections at a fixed time', () => {
    const now = new Date('2026-10-01T10:00:00.000Z')
    setSystemTime(now)
    try {
        const first = { ...deliveries[0], attemptedAt: null, nextRetryAt: null, attemptCount: 1 }
        const second = { ...first, id: 'delivery_3' }
        const input = { deliveries: [first, second], auditEvents: [], destinations: [destination], liveDeliveryEnabled: true }
        const historyConsumer = buildDwmWebhookDeliveryHistoryConsumerProof(input)
        const history = buildDwmWebhookDeliveryHistory(input)
        const attempts = buildDwmWebhookDeliveryAttemptPersistenceReadModel(input)

        expect(historyConsumer.rows.map(row => row.deliveryId)).toEqual(history.entries.map(entry => entry.deliveryId))
        expect(historyConsumer.rows.map(row => row.idempotency)).toEqual(attempts.rows.map(row => row.idempotency))
        expect(historyConsumer.rows.map(row => row.retry.nextRetryAt)).toEqual([
            '2026-10-01T10:05:00.000Z',
            '2026-10-01T10:05:00.000Z',
        ])
        expect(attempts.rows.map(row => row.retry.nextRetryAt)).toEqual([
            '2026-10-01T10:01:00.000Z',
            '2026-10-01T10:01:00.000Z',
        ])
    } finally {
        setSystemTime()
    }
})

test('organization delivery contracts share destination selection semantics', () => {
    const destinations = [
        destination,
        { ...destination, id: 'destination_unsubscribed', events: ['dwm.alert.created'] },
        { ...destination, id: 'destination_paused', status: 'paused' as const },
        { ...destination, id: 'destination_other_org', orgId: 'org_2' },
        { ...destination, id: 'destination_legacy_org', orgId: ' org_1 ' },
    ]
    const input = {
        orgId: 'org_1',
        destinationId: 'destination_1',
        eventType: 'dwm.alert.updated' as const,
        alert: payload.alert,
    }
    const common = { ownerId: 'owner_1', input, destinations, deliveries: [], auditEvents: [], liveDeliveryEnabled: false }
    const retry = buildDwmWebhookDeliveryRetryContract({ ...common, canManage: true })
    const contract = buildDwmOrgAlertWebhookDeliveryContract({ ...common, viewerRole: 'owner', canManage: true })
    const destinationReadModels = buildDwmWebhookDestinationReadModels({ ...common, viewerRole: 'owner', canManage: true })
    const outcome = buildDwmOrgAlertWebhookDeliveryOutcome(common)
    const readiness = buildDwmAlertWebhookReadinessHandoff(common)

    expect(contract.destinationHealth).toEqual(destinationReadModels.destinationHealth)
    expect(contract.destinationLifecycle).toEqual(destinationReadModels.destinationLifecycle)
    expect(contract.destinationAdminProof).toEqual(destinationReadModels.destinationAdminProof)
    expect(retry.destinationSelection).toMatchObject({
        selectedDestinationIds: ['destination_1'],
        skippedDestinations: [
            { id: 'destination_unsubscribed', reason: 'event_not_subscribed' },
            { id: 'destination_paused', reason: 'disabled' },
            { id: 'destination_other_org', reason: 'org_mismatch' },
            { id: 'destination_legacy_org', reason: 'org_mismatch' },
        ],
    })
    expect(contract.destinationSelection.selectedDestinations.map(row => row.id)).toEqual(['destination_1'])
    const expectedFilters = {
        orgId: 'org_1',
        destinationId: 'destination_1',
        alertId: 'alert_1',
        casePath: '/dwm?alert=alert_1',
        dedupeKey: 'case_1',
    }
    expect(contract.deliveryTimeline.filters).toMatchObject(expectedFilters)
    expect(contract.deliveryActionPlan.filters).toMatchObject(expectedFilters)
    expect(contract.deliveryReplayGuard.filters).toMatchObject(expectedFilters)
    expect(contract.deliveryReadinessConsumer.filters).toMatchObject(expectedFilters)
    expect(outcome.selectedDestinations.map(row => row.destinationId)).toEqual(['destination_1'])
    expect(outcome.skippedDestinations.map(row => [row.destinationId, row.reason])).toEqual([
        ['destination_unsubscribed', 'event_not_subscribed'],
        ['destination_paused', 'disabled'],
        ['destination_other_org', 'org_mismatch'],
        ['destination_legacy_org', 'org_mismatch'],
    ])
    expect(readiness.destinationSelection).toMatchObject({
        selectedDestinationIds: ['destination_1'],
        skippedDestinations: [
            { id: 'destination_unsubscribed', reason: 'event_not_subscribed' },
            { id: 'destination_paused', reason: 'disabled' },
            { id: 'destination_other_org', reason: 'org_mismatch' },
            { id: 'destination_legacy_org', reason: 'org_mismatch' },
        ],
    })
})
