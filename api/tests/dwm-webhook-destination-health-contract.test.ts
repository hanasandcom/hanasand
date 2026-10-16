import { expect, test } from 'bun:test'
import { dwmWebhookDestinationRow } from './fixtures/dwm-webhook-destination.ts'
import {
    buildDwmWebhookDeliveryReadiness,
    buildDwmWebhookDestinationHealth,
    toDwmWebhookAuditEvent,
    toDwmWebhookDelivery,
    toDwmWebhookDestination,
} from '../src/utils/dwm/webhooks.ts'

test('destination health preserves readiness, audit, and attempt projections', () => {
    const destination = toDwmWebhookDestination(dwmWebhookDestinationRow())
    const delivery = toDwmWebhookDelivery({
        id: 'delivery_health_contract',
        destination_id: destination.id,
        owner_id: destination.ownerId,
        org_id: destination.orgId,
        alert_id: 'alert_health_contract',
        event_type: 'dwm.alert.updated',
        status: 'failed',
        dry_run: false,
        endpoint_hint: destination.endpointHint,
        endpoint_hash: destination.endpointHash,
        payload_hash: 'payload_health_contract',
        payload: { alert: { id: 'alert_health_contract', dedupeKey: 'case_health_contract' } },
        response_status: 503,
        response_body: 'upstream unavailable',
        error: 'Webhook returned HTTP 503.',
        error_class: 'upstream_5xx',
        attempt_count: 1,
        next_retry_at: '2026-10-01T10:01:00.000Z',
        idempotency_key: 'dwm.alert.updated:org_health_contract:destination_health_contract:case_health_contract',
        attempted_at: '2026-10-01T10:00:01.000Z',
        created_at: '2026-10-01T10:00:00.000Z',
    })
    const audit = toDwmWebhookAuditEvent({
        id: 'audit_health_contract',
        owner_id: destination.ownerId,
        actor_id: destination.ownerId,
        org_id: destination.orgId,
        destination_id: destination.id,
        delivery_id: delivery.id,
        action: 'delivery.retry_scheduled',
        metadata: { status: delivery.status },
        created_at: '2026-10-01T10:00:02.000Z',
    })
    const input = {
        destinations: [destination],
        deliveries: [delivery],
        auditEvents: [audit],
        liveDeliveryEnabled: false,
    }

    const health = buildDwmWebhookDestinationHealth(input)
    const readiness = buildDwmWebhookDeliveryReadiness(input)

    expect(health).toHaveLength(1)
    expect(health[0]).toMatchObject({
        schemaVersion: 'dwm.webhook.destination_health.v1',
        destinationId: destination.id,
        orgId: destination.orgId,
        health: 'retrying',
        ready: false,
        retry: {
            retryable: true,
            nextRetryAt: '2026-10-01T10:01:00.000Z',
            attemptCount: 1,
        },
        latestAttempt: {
            deliveryId: delivery.id,
            status: 'failed',
            auditEventId: audit.id,
        },
        auditEventIds: [audit.id],
        auditEventContracts: [{
            auditEventId: audit.id,
            action: 'delivery.retry_scheduled',
            delivery: { alertId: 'alert_health_contract', status: 'failed' },
            retry: { retryable: true },
        }],
    })
    expect(health[0]?.retry).toEqual(readiness.destinations[0]?.retryState)
    expect(health[0]?.recentAttempts.map(attempt => attempt.deliveryId)).toEqual([delivery.id])
    expect(readiness.recentAttempts.map(attempt => attempt.deliveryId)).toEqual([delivery.id])
    expect(Object.keys(health[0] || {})).toEqual([
        'schemaVersion', 'destinationId', 'orgId', 'owner', 'type', 'label', 'status', 'enabled',
        'health', 'ready', 'liveDeliveryEnabled', 'redactedEndpoint', 'blockers', 'retry', 'lastDryRun',
        'lastTest', 'lastDelivery', 'lastFailure', 'lastLiveDisabled', 'latestAttempt', 'idempotencyCoverage',
        'recentAttempts', 'auditEventIds', 'latestAuditEventId', 'auditEventContracts', 'updatedAt', 'createdAt',
    ])
})
