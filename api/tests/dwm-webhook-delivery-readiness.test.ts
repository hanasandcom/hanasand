import { expect, setSystemTime, test } from 'bun:test'
import { auditEvents, deliveries, destination } from './fixtures/dwm-webhook-delivery-projection.ts'
import {
    buildDwmWebhookDeliveryAttemptPersistenceReadModel,
    buildDwmWebhookDeliveryHistoryConsumerProof,
    buildDwmWebhookDeliveryRetryPersistence,
    buildDwmWebhookDashboardReadinessAdapter,
} from '../src/utils/dwm/webhooks.ts'

test('retry persistence uses its supplied planning time', () => {
    const delivery = { ...deliveries[0]!, attemptedAt: null, nextRetryAt: null }
    const persistence = buildDwmWebhookDeliveryRetryPersistence({
        deliveries: [delivery],
        auditEvents: [auditEvents[0]!],
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

test('dashboard readiness publishes fixed retry and latest-attempt contract fields', () => {
    const now = new Date('2026-10-01T10:00:00.000Z')
    setSystemTime(now)
    try {
        const delivery = { ...deliveries[0]!, attemptedAt: null, nextRetryAt: null, attemptCount: 1 }
        const dashboard = buildDwmWebhookDashboardReadinessAdapter({
            destinations: [destination],
            deliveries: [delivery],
            auditEvents: [auditEvents[0]!],
            liveDeliveryEnabled: true,
        })

        expect(dashboard.summary.retryScheduledCount).toBe(1)
        expect(dashboard.destinations[0]).toMatchObject({
            retry: {
                retryable: true,
                nextRetryAt: '2026-10-01T10:01:00.000Z',
                attemptCount: 1,
                lastErrorCategory: 'upstream_5xx',
                terminalFailure: false,
            },
            latestDeliveryProof: {
                requestId: 'delivery_1',
                deliveryId: 'delivery_1',
                status: 'failed',
                rawStatus: 'failed',
                dedupeKey: 'case_1',
                idempotencyKey: 'dwm.alert.updated:org_1:destination_1:case_1',
                auditEventId: 'audit_1',
                attemptedAt: null,
            },
        })
    } finally {
        setSystemTime()
    }
})

test('history consumer and attempt read model preserve fixed row and backoff contracts', () => {
    const now = new Date('2026-10-01T10:00:00.000Z')
    setSystemTime(now)
    try {
        const first = { ...deliveries[0]!, attemptedAt: null, nextRetryAt: null, attemptCount: 1 }
        const input = {
            deliveries: [first, { ...first, id: 'delivery_3' }],
            auditEvents: [],
            destinations: [destination],
            liveDeliveryEnabled: true,
        }
        const historyConsumer = buildDwmWebhookDeliveryHistoryConsumerProof(input)
        const attempts = buildDwmWebhookDeliveryAttemptPersistenceReadModel(input)

        expect(historyConsumer).toMatchObject({
            schemaVersion: 'dwm.webhook.delivery_history_consumer.v1',
            noNetwork: true,
            counts: { total: 2, auditLinked: 0, retryScheduled: 2, redactedDestinations: 2 },
            rows: [
                {
                    deliveryId: 'delivery_1',
                    idempotencyKey: 'dwm.alert.updated:org_1:destination_1:case_1',
                    retry: { retryable: true, nextRetryAt: '2026-10-01T10:05:00.000Z' },
                    redactedDestination: { endpointExposed: false },
                    blockers: [{ code: 'audit_missing', blocking: false }, { code: 'retry_scheduled', blocking: false }],
                },
                {
                    deliveryId: 'delivery_3',
                    idempotency: { duplicate: true, deliveryIds: ['delivery_1', 'delivery_3'] },
                },
            ],
        })
        expect(attempts.rows.map(row => [row.deliveryId, row.retry.nextRetryAt])).toEqual([
            ['delivery_1', '2026-10-01T10:01:00.000Z'],
            ['delivery_3', '2026-10-01T10:01:00.000Z'],
        ])
        expect(historyConsumer.rows.map(row => row.idempotency)).toEqual(attempts.rows.map(row => row.idempotency))
    } finally {
        setSystemTime()
    }
})
