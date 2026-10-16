import { expect, test } from 'bun:test'
import { canonicalJson } from '../src/utils/dwm/customerOutputSafety.ts'
import { withLiveDelivery } from './fixtures/dwm-webhook-report-retry-env.ts'
import './fixtures/dwm-webhook-report-retry-setup.ts'
import { ledger, queries, state } from './fixtures/dwm-webhook-report-retry-state.ts'
import { failedDeliveryFixture, payloadHash, reportDraft } from './fixtures/dwm-webhook-report-retry-data.ts'

test('retries a failed report after persistence reload with the exact stored payload and idempotency lineage', async () => {
    const { computeOutboundThirdPartyReportChecksum, retryDwmWebhookDelivery } = await import('../src/utils/dwm/webhooks.ts')
    const draft = reportDraft('2026-07-23T10:00:00.000Z')
    const exportChecksum = computeOutboundThirdPartyReportChecksum(draft)
    const report = { ...draft, exportChecksum, reportPolicy: { ...draft.reportPolicy, exportChecksum } }
    const payload = {
        schemaVersion: 'dwm.webhook.v1',
        report,
        alert: { id: 'alert_1', title: 'Canonical report' },
        delivery: { dedupeKey: exportChecksum },
    }
    state.persistedDelivery = JSON.parse(JSON.stringify({
        id: 'failed_delivery_1',
        destination_id: 'destination_1',
        owner_id: 'owner_1',
        org_id: 'org_1',
        alert_id: 'alert_1',
        event_type: 'dwm.alert.updated',
        status: 'failed',
        dry_run: false,
        endpoint_hint: 'receiver.example/...',
        endpoint_hash: 'endpoint_hash',
        payload_hash: payloadHash(canonicalJson(payload)),
        payload,
        response_status: 503,
        response_body: 'retry later',
        error: 'Webhook returned HTTP 503.',
        error_class: 'upstream_5xx',
        attempt_count: 1,
        next_retry_at: '2020-07-23T10:01:00.000Z',
        idempotency_key: `dwm.alert.updated:org_1:destination_1:${exportChecksum}`,
        watchlist_id: null,
        watchlist_name: null,
        route: 'customer_webhook',
        case_path: '/dwm/cases/case_1',
        attempted_at: '2026-07-23T10:00:00.000Z',
        completed_at: '2026-07-23T10:00:01.000Z',
        delivered_at: null,
        created_at: '2026-07-23T10:00:00.000Z',
    }))
    const sentBodies: string[] = []
    await withLiveDelivery(async () => {
        const result = await retryDwmWebhookDelivery('member_2', 'org_1', 'failed_delivery_1', async (_endpoint, body) => {
            sentBodies.push(body)
            return { status: 204, body: '' }
        })
        expect(result.ok).toBe(true)
        expect(result.ok && result.delivery).toMatchObject({
            status: 'delivered',
            responseStatus: 204,
            responseBody: null,
            error: null,
        })
        expect(sentBodies).toEqual([canonicalJson(payload)])
        expect(state.insertedDelivery?.payload_hash).toBe(state.persistedDelivery.payload_hash)
        expect(state.insertedDelivery?.payload).toEqual(payload)
        expect(state.insertedDelivery?.owner_id).toBe('owner_1')
        expect(state.insertedDelivery?.dry_run).toBe(false)
        expect(state.insertedDelivery?.idempotency_key).toBe(state.persistedDelivery.idempotency_key)
        expect(state.insertedDelivery?.attempt_count).toBe(2)
        expect(queries.find(item => item.sql.includes('WHERE id = $1'))?.sql).toContain('organization_members')
        const audit = queries.find(item => item.sql.includes('INSERT INTO dwm_webhook_audit_events'))
        expect(audit?.params.slice(1, 4)).toEqual(['owner_1', 'member_2', 'org_1'])
        expect(String(audit?.params[7])).toContain('"priorDeliveryId":"failed_delivery_1"')
        expect(String(audit?.params[7])).toContain('"exactPersistedPayload":true')
    })
})


test('records a thrown sender error on a live retry', async () => {
    const { retryDwmWebhookDelivery } = await import('../src/utils/dwm/webhooks.ts')
    state.persistedDelivery = failedDeliveryFixture('2020-07-23T10:01:00.000Z')
    await withLiveDelivery(async () => {
        const result = await retryDwmWebhookDelivery('member_2', 'org_1', state.persistedDelivery.id, async () => {
            throw new Error('connection reset')
        })

        expect(result.ok && result.delivery).toMatchObject({
            status: 'failed',
            responseStatus: null,
            responseBody: null,
            error: 'connection reset',
        })
    })
})


test('blocks an exact persisted retry until its due timestamp without a network attempt', async () => {
    const { retryDwmWebhookDelivery } = await import('../src/utils/dwm/webhooks.ts')
    const nextRetryAt = '2099-07-23T10:01:00.000Z'
    state.persistedDelivery = failedDeliveryFixture(nextRetryAt)
    let networkAttempts = 0
    await withLiveDelivery(async () => {
        const result = await retryDwmWebhookDelivery('member_2', 'org_1', state.persistedDelivery.id, async () => {
            networkAttempts += 1
            return { status: 204, body: '' }
        })
        expect(result).toMatchObject({
            ok: false,
            status: 409,
            code: 'delivery_retry_not_ready',
            nextRetryAt,
        })
        expect(networkAttempts).toBe(0)
        expect(state.insertedDelivery).toBeUndefined()
    })
})


test('rejects retry after the approved destination endpoint changes without a network attempt', async () => {
    const { retryDwmWebhookDelivery } = await import('../src/utils/dwm/webhooks.ts')
    state.persistedDelivery = failedDeliveryFixture('2020-07-23T10:01:00.000Z')
    state.destinationEndpointHash = 'endpoint_changed'
    let networkAttempts = 0
    await withLiveDelivery(async () => {
        const result = await retryDwmWebhookDelivery('member_2', 'org_1', state.persistedDelivery.id, async () => {
            networkAttempts += 1
            return { status: 204, body: '' }
        })
        expect(result).toMatchObject({
            ok: false,
            status: 409,
            code: 'delivery_destination_changed',
        })
        expect(networkAttempts).toBe(0)
        expect(state.insertedDelivery).toBeUndefined()
    })
})


test('rejects a tampered payload hash before validating its embedded report', async () => {
    const { retryDwmWebhookDelivery } = await import('../src/utils/dwm/webhooks.ts')
    const fixture = failedDeliveryFixture('2020-07-23T10:01:00.000Z')
    state.persistedDelivery = {
        ...fixture,
        payload: { ...fixture.payload, report: { exportChecksum: 'case_report_invalid' } },
        payload_hash: 'payload_tampered',
    }
    let networkAttempts = 0
    await withLiveDelivery(async () => {
        const result = await retryDwmWebhookDelivery('member_2', 'org_1', state.persistedDelivery.id, async () => {
            networkAttempts += 1
            return { status: 204, body: '' }
        })
        expect(result).toMatchObject({ ok: false, status: 409, code: 'persisted_payload_invalid' })
        expect(networkAttempts).toBe(0)
    })
})


test('rejects an invalid persisted report before retrying its payload', async () => {
    const { retryDwmWebhookDelivery } = await import('../src/utils/dwm/webhooks.ts')
    const fixture = failedDeliveryFixture('2020-07-23T10:01:00.000Z')
    const payload = { ...fixture.payload, report: { exportChecksum: 'case_report_invalid' } }
    state.persistedDelivery = { ...fixture, payload, payload_hash: payloadHash(canonicalJson(payload)) }
    let networkAttempts = 0
    await withLiveDelivery(async () => {
        const result = await retryDwmWebhookDelivery('member_2', 'org_1', state.persistedDelivery.id, async () => {
            networkAttempts += 1
            return { status: 204, body: '' }
        })
        expect(result).toMatchObject({ ok: false, status: 409, code: 'persisted_report_invalid' })
        expect(networkAttempts).toBe(0)
        expect(state.insertedDelivery).toBeUndefined()
    })
})


test('blocks a persisted retry after five live attempts without sending or inserting', async () => {
    const { retryDwmWebhookDelivery } = await import('../src/utils/dwm/webhooks.ts')
    state.persistedDelivery = failedDeliveryFixture('2020-07-23T10:01:00.000Z')
    ledger.push(...Array.from({ length: 4 }, (_, index) => ({
        ...state.persistedDelivery,
        id: `prior_attempt_${index + 1}`,
        attempted_at: `2020-07-23T09:5${index}:00.000Z`,
    })))
    let networkAttempts = 0
    await withLiveDelivery(async () => {
        const result = await retryDwmWebhookDelivery('member_2', 'org_1', state.persistedDelivery.id, async () => {
            networkAttempts += 1
            return { status: 204, body: '' }
        })
        expect(result).toMatchObject({ ok: false, status: 409, code: 'delivery_retry_limit' })
        expect(networkAttempts).toBe(0)
        expect(state.insertedDelivery).toBeUndefined()
        expect(ledger).toHaveLength(4)
    })
})
