import { describe, expect, test } from 'bun:test'
import { normalizeError } from '../src/handlers/ti/publicApi.ts'
import { createPublicTiClient } from '../sdk/publicTiClient.ts'
import { injectedFetch, searchResult, testApp, validateResponse } from './helpers/public-ti-v1.ts'

describe('public TI v1', () => {
    test('reports batch partial failures explicitly instead of returning fake searching results', async () => {
        const app = await testApp(undefined, async ({ query }) => {
            if (query === 'FAIL') throw new Error('upstream failure')
            return { ...searchResult, query }
        })
        const response = await app.inject({ method: 'POST', url: '/api/v1/ti/search/batch', headers: { 'x-api-key': 'valid' }, payload: { queries: ['APT29', 'FAIL'] } })
        expect(response.statusCode).toBe(207)
        expect(response.json().partial).toBe(true)
        expect(response.json().results[0].status).toBe('ok')
        expect(response.json().results[1]).toMatchObject({ query: 'FAIL', status: 'error' })
        expect(response.json().results[1].error).toEqual({
            code: 'search_unavailable',
            message: 'Threat-intelligence search is temporarily unavailable.',
            requestId: response.headers['x-request-id'],
        })
    })

    test('reports returned-unavailable batch searches as partial failures', async () => {
        const app = await testApp(undefined, async ({ query }) => query === 'OFFLINE'
            ? { ...searchResult, query, status: 'unavailable' as const, mode: 'unavailable' as const }
            : { ...searchResult, query })
        const response = await app.inject({ method: 'POST', url: '/api/v1/ti/search/batch', headers: { 'x-api-key': 'valid' }, payload: { queries: ['APT29', 'OFFLINE'] } })
        const body = response.json()
        expect(response.statusCode).toBe(207)
        expect(body.partial).toBe(true)
        expect(body.results[0]).toMatchObject({ query: 'APT29', status: 'ok', result: { status: 'ready' } })
        expect(body.results[1]).toMatchObject({ query: 'OFFLINE', status: 'error', error: { code: 'search_unavailable' } })
        expect(body.results[1].result).toBeUndefined()
    })

    test('rejects batch search fields other than queries before starting searches', async () => {
        let searchCalls = 0
        const app = await testApp(undefined, async ({ query }) => {
            searchCalls++
            return { ...searchResult, query }
        })
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/ti/search/batch',
            headers: { 'x-api-key': 'valid' },
            payload: { queries: ['APT29'], tenantId: 'forbidden' },
        })

        expect(response.statusCode).toBe(400)
        expect(response.json().error).toMatchObject({ code: 'invalid_request' })
        expect(searchCalls).toBe(0)
    })

    test('bounds batch fan-out before search and keeps valid work at three concurrent requests', async () => {
        let active = 0
        let peak = 0
        const app = await testApp(undefined, async ({ query }) => {
            active += 1
            peak = Math.max(peak, active)
            await new Promise(resolve => setTimeout(resolve, 1))
            active -= 1
            return { ...searchResult, query }
        })

        const oversized = await app.inject({
            method: 'POST',
            url: '/api/v1/ti/search/batch',
            headers: { 'x-api-key': 'valid' },
            payload: { queries: Array.from({ length: 26 }, (_, index) => `query-${index}`) },
        })
        expect(oversized.statusCode).toBe(400)
        expect(oversized.json().error.code).toBe('too_many_queries')
        expect(peak).toBe(0)

        const bounded = await app.inject({
            method: 'POST',
            url: '/api/v1/ti/search/batch',
            headers: { 'x-api-key': 'valid' },
            payload: { queries: Array.from({ length: 25 }, (_, index) => `query-${index}`) },
        })
        expect(bounded.statusCode).toBe(200)
        expect(bounded.json().count).toBe(25)
        expect(peak).toBeLessThanOrEqual(3)
    })

    test('returns a truthful unavailable response when the structured store cannot be reached', async () => {
        const app = await testApp(async () => new Response('offline', { status: 503 }))
        const response = await app.inject({ method: 'GET', url: '/api/v1/incidents', headers: { 'x-api-key': 'valid' } })
        expect(response.statusCode).toBe(503)
        expect(response.json().error.code).toBe('upstream_unavailable')
        expect(response.headers['cache-control']).toBe('no-store, max-age=0')
    })

    test('validates representative successes and errors against the published OpenAPI', async () => {
        const app = await testApp(async () => Response.json({ actorProfiles: [{ id: 'actor-1', canonicalName: 'APT29', aliases: [], confidence: 0.8, sourceIds: [], captureIds: [] }], total: 1 }))
        const responses = [
            ['/ti/search', 'post', await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'APT29' } })],
            ['/ti/search', 'post', await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'x' } })],
            ['/actors', 'get', await app.inject({ method: 'GET', url: '/api/v1/actors' })],
            ['/actors', 'get', await app.inject({ method: 'GET', url: '/api/v1/actors?limit=1', headers: { 'x-api-key': 'valid' } })],
        ] as const
        for (const [path, method, response] of responses) expect(validateResponse(path, method, response.statusCode, response.json())).toBe(true)
    })

    test('the generated client performs authenticated success, error, and pagination calls', async () => {
        const app = await testApp(async () => Response.json({ actorProfiles: [{ id: 'actor-1', canonicalName: 'APT29', aliases: [], confidence: 0.8, sourceIds: [], captureIds: [] }], total: 1 }))
        const anonymous = createPublicTiClient({ baseUrl: 'http://api.test/api/v1', fetch: injectedFetch(app) })
        const protectedCall = await anonymous.GET('/actors', { params: { query: { limit: 1 } } })
        expect(protectedCall.response.status).toBe(401)
        expect(protectedCall.error?.error.code).toBe('authentication_required')

        const authenticated = createPublicTiClient({ baseUrl: 'http://api.test/api/v1', apiKey: 'valid', fetch: injectedFetch(app) })
        const page = await authenticated.GET('/actors', { params: { query: { limit: 1, page: 1 } } })
        expect(page.error).toBeUndefined()
        expect(page.data?.data[0]?.canonicalName).toBe('APT29')
        expect(page.data?.pagination).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1, nextPage: null, nextCursor: null })
    })

    test('returns authenticated delivery counts and fails explicitly when metrics are missing', async () => {
        const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
        process.env.TI_SCRAPER_SERVICE_TOKEN = 'delivery-test-service'
        try {
            let payload: unknown = { generatedAt: '2026-09-19T10:00:00.000Z', summary: { recordCount: 20, needsReportCount: 11, unresolvedReferenceCount: 11, criticalThreshold: 10, status: 'critical' } }
            let calls = 0
            const app = await testApp(async (input, init) => {
                calls++
                expect(String(input)).toBe('https://scraper.example.test/v1/intel/timeliness/summary')
                expect(new Headers(init?.headers).get('x-hanasand-service-token')).toBe('delivery-test-service')
                return Response.json(payload)
            })
            expect((await app.inject('/api/v1/timeliness?summary=true')).statusCode).toBe(401)
            expect(calls).toBe(0)
            const response = await app.inject({ url: '/api/v1/timeliness?summary=true&tenantId=another-org', headers: { 'x-api-key': 'valid' } })
            expect(response.statusCode).toBe(200)
            expect(response.json().summary.needsReportCount).toBe(11)
            expect(validateResponse('/timeliness', 'get', 200, response.json())).toBe(true)
            payload = { summary: {} }
            const unavailable = await app.inject({ url: '/api/v1/timeliness?summary=true', headers: { 'x-api-key': 'valid' } })
            expect(unavailable.statusCode).toBe(503)
        } finally {
            if (previousToken === undefined) delete process.env.TI_SCRAPER_SERVICE_TOKEN
            else process.env.TI_SCRAPER_SERVICE_TOKEN = previousToken
        }
    })

    test('normalizes legacy rate-limit responses into the stable error contract', () => {
        const response = normalizeError(JSON.stringify({ error: 'Rate limit exceeded.' }), 429, 'request-1')
        expect(response).toEqual({ error: { code: 'rate_limit_exceeded', message: 'Rate limit exceeded.', requestId: 'request-1' } })
        expect(validateResponse('/actors', 'get', 429, response)).toBe(true)
    })
})
