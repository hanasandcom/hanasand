import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import './fixtures/dwm-webhook-report-retry-setup.ts'
import { withLiveDelivery } from './fixtures/dwm-webhook-report-retry-env.ts'
import { ledger, queries, state } from './fixtures/dwm-webhook-report-retry-state.ts'
import { deliveryInput } from './fixtures/dwm-webhook-report-retry-data.ts'

test('rejects an undated alert before network or delivery persistence', async () => {
    const { deliverDwmAlertNotification } = await import('../src/utils/dwm/webhooks.ts')
    let networkAttempts = 0
    const input = deliveryInput('undated_alert', false)
    input.alert = {
        ...input.alert,
        firstSeenAt: undefined,
        sourceFamily: 'clear_web',
        evidenceCount: 1,
        provenance: { captureIds: ['capture_1'], sourceIds: ['source_1'] },
        casePath: '/dwm?alert=alert_1',
        watchlist: { id: 'watch_1', terms: ['example.com'] },
    }

    await expect(deliverDwmAlertNotification('owner_1', input, async () => {
        networkAttempts += 1
        return { status: 202, body: '' }
    })).rejects.toMatchObject({ code: 'missing_timestamp' })
    expect(networkAttempts).toBe(0)
    expect(ledger).toHaveLength(0)
})


test('persists an explicitly requested missing destination after validating the alert', async () => {
    const { deliverDwmAlertNotification } = await import('../src/utils/dwm/webhooks.ts')
    const requestedId = 'destination_missing'
    state.missingDestinationId = requestedId
    let networkAttempts = 0

    const [delivery] = await deliverDwmAlertNotification('owner_1', {
        ...deliveryInput('missing_destination', true),
        destinationId: requestedId,
    }, async () => {
        networkAttempts += 1
        return { status: 202, body: '' }
    })

    expect(networkAttempts).toBe(0)
    expect(delivery).toMatchObject({
        status: 'skipped',
        destinationId: null,
        endpointHint: 'requested_destination_not_found',
        attemptCount: 0,
    })
    expect(delivery.error).toContain('requested webhook destination was not found')
    expect(delivery.endpointHash).toBe(`endpoint_${createHash('sha256').update(requestedId).digest('hex').slice(0, 32)}`)
    expect(delivery.idempotencyKey).toContain(requestedId)
    expect(ledger).toHaveLength(1)
    expect(ledger[0]).toMatchObject({
        status: 'skipped',
        destination_id: null,
        endpoint_hint: 'requested_destination_not_found',
        endpoint_hash: delivery.endpointHash,
        attempt_count: 0,
    })
    const skippedAudit = queries.find(query =>
        query.sql.includes('INSERT INTO dwm_webhook_audit_events') && query.params[6] === 'delivery.skipped'
    )
    expect(JSON.parse(String(skippedAudit?.params[7]))).toMatchObject({
        alertId: delivery.alertId,
        status: 'skipped',
        endpointHint: 'requested_destination_not_found',
        idempotencyKey: delivery.idempotencyKey,
        reason: 'requested_destination_not_found',
        requestedDestinationId: requestedId,
    })
})


test('does not persist a missing-destination outcome for an invalid alert', async () => {
    const { deliverDwmAlertNotification } = await import('../src/utils/dwm/webhooks.ts')
    const requestedId = 'destination_missing'
    state.missingDestinationId = requestedId
    const input = deliveryInput('invalid_missing_destination', true)
    input.destinationId = requestedId
    input.alert.firstSeenAt = undefined

    await expect(deliverDwmAlertNotification('owner_1', input)).rejects.toMatchObject({ code: 'missing_timestamp' })
    expect(ledger).toHaveLength(0)
})


test('delivery loads org destinations using the nested alert organization fallback', async () => {
    const { deliverDwmAlertNotification } = await import('../src/utils/dwm/webhooks.ts')
    const input = deliveryInput('alert_org_resolution', true)
    input.destinationId = undefined
    input.orgId = undefined
    input.alert.organizationId = 'alert_org'
    state.orgDestinations = [{
        id: 'destination_paused',
        org_id: 'alert_org',
        name: 'Paused receiver',
        kind: 'webhook',
        endpoint_hint: 'receiver.example/...',
        endpoint_hash: 'endpoint_hash',
        status: 'paused',
        events: ['dwm.alert.updated'],
    }]

    await deliverDwmAlertNotification('owner_1', input)

    expect(queries.find(query => query.sql.includes('status <> \'archived\''))?.params).toEqual(['alert_org'])
    expect(ledger[0]).toMatchObject({ org_id: 'alert_org', destination_id: 'destination_paused', status: 'skipped' })
})


test('records HTTP sender outcomes on a live delivery', async () => {
    const { deliverDwmAlertNotification } = await import('../src/utils/dwm/webhooks.ts')
    await withLiveDelivery(async () => {
        const [delivery] = await deliverDwmAlertNotification('owner_1', deliveryInput('http_failure', false), async () => ({
            status: 503,
            body: 'upstream unavailable',
        }))

        expect(delivery).toMatchObject({
            status: 'failed',
            responseStatus: 503,
            responseBody: 'upstream unavailable',
            error: 'Webhook returned HTTP 503.',
        })
    })
})


test('blocks a fresh send after five live failures while preceding dry runs consume no budget', async () => {
    const { deliverDwmAlertNotification } = await import('../src/utils/dwm/webhooks.ts')
    let networkAttempts = 0
    const sender = async () => {
        networkAttempts += 1
        return { status: 503, body: 'retry later' }
    }
    await withLiveDelivery(async () => {
        for (const actor of ['owner_1', 'member_2', 'owner_1']) {
            const result = await deliverDwmAlertNotification(actor, deliveryInput('checksum_budget', true), sender)
            expect(result[0]?.status).toBe('dry_run')
            expect(result[0]?.attemptCount).toBe(0)
        }
        const statuses: string[] = []
        for (let index = 0; index < 6; index += 1) {
            const actor = index % 2 === 0 ? 'owner_1' : 'member_2'
            const result = await deliverDwmAlertNotification(actor, deliveryInput('checksum_budget', false), sender)
            statuses.push(result[0]?.status)
        }
        expect(networkAttempts).toBe(5)
        expect(statuses).toEqual(['failed', 'failed', 'failed', 'failed', 'failed', 'skipped'])
        expect(ledger.filter(row => row.dry_run)).toHaveLength(3)
        expect(ledger.filter(row => !row.dry_run && row.attempted_at)).toHaveLength(5)
        expect(ledger.at(-1)).toMatchObject({
            status: 'skipped',
            attempt_count: 5,
            error_class: 'delivery_attempt_limit',
            attempted_at: null,
        })
    })
})
