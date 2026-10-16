import { expect, test } from 'bun:test'
import { app, databaseQueries, retryCalls, state } from './fixtures/dwm-webhook-delivery-route.ts'

test('authorized organization member can retry a delivery through the public route', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/dwm/webhook-deliveries',
        payload: { orgId: 'org_1', deliveryId: 'delivery_failed_1' },
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toMatchObject({
        deliveries: [{
            id: 'delivery_retry_1',
            alertId: 'alert_1',
            destinationId: 'destination_1',
            status: 'delivered',
        }],
    })
    expect(retryCalls).toEqual([{
        userId: 'user_1',
        orgId: 'org_1',
        deliveryId: 'delivery_failed_1',
    }])
    expect(databaseQueries).toHaveLength(1)
    expect(databaseQueries[0]?.params).toEqual(['org_1', 'user_1'])
})

test('retry failures preserve the helper HTTP status, code, and due time', async () => {
    state.retryResult = {
        ok: false,
        status: 409,
        code: 'delivery_retry_not_ready',
        error: 'Delivery retry is not due yet.',
        nextRetryAt: '2099-07-23T10:01:00.000Z',
    }

    const response = await app.inject({
        method: 'POST',
        url: '/dwm/webhook-deliveries',
        payload: { orgId: 'org_1', deliveryId: 'delivery_failed_1' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
        error: 'Delivery retry is not due yet.',
        code: 'delivery_retry_not_ready',
        nextRetryAt: '2099-07-23T10:01:00.000Z',
    })
    expect(retryCalls).toHaveLength(1)
})
