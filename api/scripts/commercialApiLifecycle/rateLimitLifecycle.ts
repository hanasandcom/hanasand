import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'
import { queryOnce } from '../../src/utils/db.ts'
import type { createApiKey } from '../../src/utils/auth/apiKeys.ts'
import { commercialApp } from './helpers.ts'

type OrganizationKey = Awaited<ReturnType<typeof createApiKey>>

export async function verifyRateLimitLifecycle(initialApp: FastifyInstance, organizationKey: OrganizationKey) {
    let app = await initialApp
    const batchPayload = { queries: ['APT29'] }
    const sessionBatch = await app.inject({
        method: 'POST',
        url: '/api/v1/ti/search/batch',
        headers: { authorization: 'Bearer commercial-session-token', id: 'commercial-creator' },
        payload: batchPayload,
    })
    const apiKeyBatch = await app.inject({
        method: 'POST',
        url: '/api/v1/ti/search/batch',
        headers: { 'x-api-key': organizationKey.secret },
        payload: batchPayload,
    })
    for (const response of [sessionBatch, apiKeyBatch]) {
        assert.equal(response.statusCode, 200, response.body)
        assert.equal(response.headers['x-api-key-rate-limit-minute'], '12')
        assert.equal(response.headers['x-api-key-rate-limit-minute-remaining'], '11')
        assert.ok(response.headers['x-request-id'])
    }

    const sessionMinuteBucket = 'user:commercial-creator:endpoint:POST:/api/v1/ti/search/batch:minute'
    const apiKeyMinuteBucket = `api_key:${organizationKey.apiKey.id}:endpoint:POST:/api/v1/ti/search/batch:minute`
    assert.equal((await queryOnce(`
    UPDATE api_rate_limit_buckets
    SET request_count = 11
    WHERE bucket_key = ANY($1::text[])
`, [[sessionMinuteBucket, apiKeyMinuteBucket]])).rowCount, 2)
    await queryOnce(`
    UPDATE api_rate_limit_buckets
    SET window_started_at = NOW() - INTERVAL '2 seconds'
    WHERE bucket_key IN (
        'user:commercial-creator:endpoint:POST:/api/v1/ti/search/batch:second',
        $1
    )
`, [`api_key:${organizationKey.apiKey.id}:endpoint:POST:/api/v1/ti/search/batch:second`])
    await app.close()
    app = await commercialApp()

    const restartedConcurrentBatches = await Promise.all([
        Promise.all(Array.from({ length: 2 }, () => app.inject({
            method: 'POST',
            url: '/api/v1/ti/search/batch',
            headers: { authorization: 'Bearer commercial-session-token', id: 'commercial-creator' },
            payload: batchPayload,
        }))),
        Promise.all(Array.from({ length: 2 }, () => app.inject({
            method: 'POST',
            url: '/api/v1/ti/search/batch',
            headers: { 'x-api-key': organizationKey.secret },
            payload: batchPayload,
        }))),
    ])
    for (const responses of restartedConcurrentBatches) {
        assert.deepEqual(responses.map(response => response.statusCode).sort(), [200, 429])
        const rejected = responses.find(response => response.statusCode === 429)!
        assert.equal(rejected.json().error.code, 'rate_limit_exceeded')
        assert.equal(rejected.headers['x-api-key-rate-limit-minute'], '12')
        assert.equal(rejected.headers['x-api-key-rate-limit-minute-remaining'], '0')
        const resetAt = Date.parse(String(rejected.headers['x-api-key-rate-limit-minute-reset']))
        const expectedRetry = Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1)
        assert.ok(Math.abs(Number(rejected.headers['retry-after']) - expectedRetry) <= 1)
        assert.ok(Number(rejected.headers['retry-after']) > 1, 'the blocking minute window, not the one-second burst window, determines Retry-After')
        assert.ok(rejected.headers['x-request-id'])
    }


    return app
}
