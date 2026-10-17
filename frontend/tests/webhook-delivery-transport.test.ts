import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { postWebhookJson } from '../src/app/dashboard/webhookDeliveryTransport.ts'

test('webhook delivery transport posts scoped JSON and returns the feature payload', async() => {
    let request: { url: string, init: RequestInit } | undefined
    const payload = { attemptedCount: 1, delivery: { id: 'delivery-1', status: 'delivered' } }
    const response = await postWebhookJson<typeof payload>('/api/findings/webhooks/deliver', {
        tenantId: 'tenant-1', organizationId: 'org-1', alertId: 'alert-1', limit: 1,
    }, async(url, init = {}) => {
        request = { url: String(url), init }
        return { ok: true, json: async() => payload } as Response
    })

    assert.equal(request?.url, '/api/findings/webhooks/deliver')
    assert.equal(request?.init.method, 'POST')
    assert.equal(new Headers(request?.init.headers).get('content-type'), 'application/json')
    assert.deepEqual(JSON.parse(String(request?.init.body)), {
        tenantId: 'tenant-1', organizationId: 'org-1', alertId: 'alert-1', limit: 1,
    })
    assert.equal(response.delivery.id, 'delivery-1')
})

test('webhook delivery transport preserves API error messages', async() => {
    await assert.rejects(postWebhookJson('/api/findings/webhooks/deliver', {}, async() => ({
        ok: false, statusText: 'Bad Request', json: async() => ({ error: { message: 'Alert is not ready.' } }),
    } as Response)), { message: 'Alert is not ready.' })
})

test('webhook delivery transport falls back to status text when the response is not JSON', async() => {
    await assert.rejects(postWebhookJson('/api/findings/webhooks/deliver', {}, async() => ({
        ok: false, statusText: 'Service Unavailable', json: async() => { throw new Error('invalid JSON') },
    } as Response)), { message: 'Service Unavailable' })
})
