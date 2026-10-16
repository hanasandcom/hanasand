import { expect, test } from 'bun:test'
import { app, databaseQueries, retryCalls, state } from './fixtures/dwm-webhook-delivery-route.ts'

test('unauthenticated delivery retry returns 401 before permission lookup or retry', async () => {
    state.user = { valid: false }

    const response = await app.inject({
        method: 'POST',
        url: '/dwm/webhook-deliveries',
        payload: { orgId: 'org_1', deliveryId: 'delivery_failed_1' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Unauthorized.' })
    expect(databaseQueries).toHaveLength(0)
    expect(retryCalls).toHaveLength(0)
})

test('cross-organization delivery retry returns 404 before retry execution', async () => {
    state.membership = null

    const response = await app.inject({
        method: 'POST',
        url: '/dwm/webhook-deliveries',
        payload: { orgId: 'org_other', deliveryId: 'delivery_failed_1' },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Organization not found.' })
    expect(databaseQueries).toHaveLength(1)
    expect(databaseQueries[0]?.params).toEqual(['org_other', 'user_1'])
    expect(retryCalls).toHaveLength(0)
})

test('organization deletion blocks delivery retry with 409 before retry execution', async () => {
    state.membership = {
        role: 'admin',
        organization_status: 'active',
        privacy_deletion_run_id: 'deletion_run_1',
    }

    const response = await app.inject({
        method: 'POST',
        url: '/dwm/webhook-deliveries',
        payload: { orgId: 'org_1', deliveryId: 'delivery_failed_1' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Organization deletion is in progress; writes are blocked.' })
    expect(retryCalls).toHaveLength(0)
})

test('a non-editor organization member receives 403 before delivery retry', async () => {
    state.membership = {
        role: 'reader',
        organization_status: 'active',
        privacy_deletion_run_id: null,
    }

    const response = await app.inject({
        method: 'POST',
        url: '/dwm/webhook-deliveries',
        payload: { orgId: 'org_1', deliveryId: 'delivery_failed_1' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
        error: 'Only organization owners, admins, and editors can configure webhook destinations.',
    })
    expect(retryCalls).toHaveLength(0)
})
