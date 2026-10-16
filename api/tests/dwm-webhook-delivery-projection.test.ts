import { expect, test } from 'bun:test'
import { auditEvents, deliveries, destination } from './fixtures/dwm-webhook-delivery-projection.ts'
import {
    buildDwmWebhookDeliveryEvidence,
    buildDwmWebhookDeliveryEvidenceAndLedger,
    buildDwmWebhookDeliveryHistory,
    buildDwmWebhookDeliveryLedger,
    buildDwmWebhookDeliveryOperations,
    toDwmWebhookDelivery,
} from '../src/utils/dwm/webhooks.ts'

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

test('projects evidence, attempts, operations and history with lifecycle links', () => {
    const input = { deliveries, auditEvents, destinations: [destination], liveDeliveryEnabled: false }
    const now = new Date('2026-10-01T10:05:00.000Z')
    const evidence = buildDwmWebhookDeliveryEvidence(input)
    const ledger = buildDwmWebhookDeliveryLedger({ ...input, now })
    const combined = buildDwmWebhookDeliveryEvidenceAndLedger({ ...input, now })
    const operations = buildDwmWebhookDeliveryOperations(input)
    const history = buildDwmWebhookDeliveryHistory(input)

    expect(combined).toEqual({ evidence, ledger })
    expect(combined.evidence.map(item => [item.deliveryId, item.auditEventId])).toEqual([
        ['delivery_1', 'audit_1'],
        ['delivery_2', 'audit_2'],
    ])
    expect(combined.ledger.map(item => [item.deliveryId, item.status, item.attemptCount])).toEqual([
        ['delivery_1', 'failed', 1],
        ['delivery_2', 'sent', 2],
    ])
    expect(evidence).toEqual(combined.evidence)
    expect(ledger).toEqual(combined.ledger)
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
        total: 2,
        counts: { sent: 1, failed: 1 },
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
    const filteredCombined = buildDwmWebhookDeliveryEvidenceAndLedger({ ...input, filters, now })
    expect(filteredCombined.evidence.map(item => item.deliveryId)).toEqual(['delivery_1'])
    expect(filteredCombined.ledger.map(item => item.deliveryId)).toEqual(['delivery_1'])
    const filteredOperations = buildDwmWebhookDeliveryOperations({ ...input, filters })
    expect(filteredOperations.recentDeliveries.map(item => item.deliveryId)).toEqual(['delivery_1'])
    expect(filteredOperations.filters.action).toBe('delivery.retry_scheduled')
    expect(buildDwmWebhookDeliveryHistory({ ...input, filters })).toMatchObject({
        total: 1,
        counts: { failed: 1 },
        filters: { action: 'delivery.retry_scheduled' },
        entries: [{ deliveryId: 'delivery_1', deliveryProof: { auditEventId: 'audit_1' } }],
    })
})
