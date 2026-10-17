import { expect, setSystemTime, test } from 'bun:test'
import { auditEvents, deliveries, destination } from './fixtures/dwm-webhook-delivery-projection.ts'
import {
    buildDwmWebhookDeliveryHistory,
    buildDwmWebhookDeliveryHistoryAndPersistenceReadModels,
    buildDwmWebhookDeliveryPersistenceProof,
    buildDwmWebhookDeliveryRetryPersistence,
} from '../src/utils/dwm/webhooks.ts'

test('combined history and persistence contracts cover sparse results with fixed defaults', () => {
    const result = buildDwmWebhookDeliveryHistoryAndPersistenceReadModels({ deliveries: [], liveDeliveryEnabled: false })

    expect(Object.keys(result)).toEqual(['history', 'persistenceProof', 'retryPersistence'])
    expect(result).toMatchObject({
        history: {
            schemaVersion: 'dwm.webhook.delivery_history.v1',
            liveDeliveryEnabled: false,
            total: 0,
            counts: { queued: 0, sent: 0, failed: 0, skipped: 0, dryRun: 0, live: 0, replay: 0, retryable: 0 },
            entries: [],
        },
        persistenceProof: {
            schemaVersion: 'dwm.webhook.delivery_persistence_proof.v1',
            ok: false,
            redacted: true,
            totals: { rows: 0, persisted: 0, failed: 0, skipped: 0, retryScheduled: 0, auditLinked: 0 },
            audit: { eventType: 'dwm.webhook.delivery_persistence_checked', outcome: 'blocked', auditEventIds: [] },
            blockers: [{ code: 'missing_delivery_attempt', path: 'deliveryHistory.entries', blocking: true }],
            rows: [],
        },
        retryPersistence: {
            schemaVersion: 'dwm.webhook.delivery_retry_persistence.v1',
            totalDeliveryKeys: 0,
            counts: { attempts: 0, retryable: 0, terminalFailure: 0, delivered: 0 },
            idempotencyCoverage: { attemptCount: 0, coveredAttemptCount: 0, covered: true, duplicateKeyCount: 0 },
            deliveryKeys: [],
        },
    })
})

test('combined history and persistence contracts preserve populated delivery evidence', () => {
    setSystemTime(new Date('2026-10-01T10:00:00.000Z'))
    try {
        const delivery = { ...deliveries[0]!, attemptedAt: null, nextRetryAt: null }
        const input = {
            deliveries: [delivery],
            auditEvents: [auditEvents[0]!],
            destinations: [destination],
            liveDeliveryEnabled: true,
        }
        const result = buildDwmWebhookDeliveryHistoryAndPersistenceReadModels(input)

        expect(result).toMatchObject({
            history: {
                schemaVersion: 'dwm.webhook.delivery_history.v1',
                total: 1,
                counts: { failed: 1, live: 1, retryable: 1 },
                entries: [{
                    deliveryId: 'delivery_1',
                    orgId: 'org_1',
                    destinationId: 'destination_1',
                    status: 'failed',
                    deliveryProof: { auditEventId: 'audit_1', payloadHash: 'payload_hash_1' },
                    retry: { retryable: true, nextRetryAt: '2026-10-01T10:01:00.000Z' },
                    destination: { redactedEndpoint: { endpointHash: 'endpoint_hash_1' } },
                }],
            },
            persistenceProof: {
                schemaVersion: 'dwm.webhook.delivery_persistence_proof.v1',
                ok: true,
                redacted: true,
                totals: { rows: 1, persisted: 0, failed: 1, retryScheduled: 1, live: 1, auditLinked: 1 },
                audit: { outcome: 'ready', auditEventIds: ['audit_1'] },
                blockers: [],
                rows: [{
                    deliveryId: 'delivery_1',
                    idempotencyKey: 'dwm.alert.updated:org_1:destination_1:case_1',
                    payloadHash: 'payload_hash_1',
                    retry: { retryable: true, nextRetryAt: '2026-10-01T10:01:00.000Z' },
                    audit: { auditEventId: 'audit_1', auditAction: 'delivery.retry_scheduled' },
                    actionRequests: {
                        dryRunReplay: {
                            route: 'POST /api/dwm/webhook-deliveries',
                            canSend: true,
                            noNetwork: true,
                            body: { eventType: 'dwm.alert.replayed', dryRun: true, live: false },
                        },
                    },
                    sanitizedPayloadPreview: { redaction: { endpointExposed: false, safeForCustomerDisplay: true } },
                }],
            },
            retryPersistence: {
                schemaVersion: 'dwm.webhook.delivery_retry_persistence.v1',
                totalDeliveryKeys: 1,
                counts: { attempts: 1, retryable: 1, live: 1 },
                deliveryKeys: [{
                    idempotencyKey: 'dwm.alert.updated:org_1:destination_1:case_1',
                    status: 'retry_scheduled',
                    retry: { retryable: true },
                    audit: { auditEventIds: ['audit_1'] },
                }],
            },
        })
        expect(result.history).toEqual(buildDwmWebhookDeliveryHistory(input))
        expect(result.persistenceProof).toEqual(buildDwmWebhookDeliveryPersistenceProof(input))
        expect(result.retryPersistence).toEqual(buildDwmWebhookDeliveryRetryPersistence({
            ...input,
            now: new Date('2026-10-01T10:00:00.000Z'),
        }))
    } finally {
        setSystemTime()
    }
})
