import { afterEach, expect, test } from 'bun:test'
import Fastify from 'fastify'
import { HANASAND_ORGANIZATION_ID } from '../src/utils/auth/organizationPagePolicy.ts'
import { getTiScraperControl, postTiScraperControl } from '../src/handlers/ti/scraperControl.ts'

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalBase === undefined) delete process.env.TI_SCRAPER_API_BASE
    else process.env.TI_SCRAPER_API_BASE = originalBase
})

test('requires an authenticated session before contacting the TI scraper', async () => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    let fetchCount = 0
    globalThis.fetch = async () => {
        fetchCount++
        return Response.json({})
    }
    const app = controlApp()

    try {
        const response = await app.inject({ method: 'POST', url: '/api/ti/scraper/control', payload: { action: 'scheduler_run_now' } })
        expect(response.statusCode).toBe(401)
        expect(response.json()).toEqual({ error: 'authentication_required' })
        expect(fetchCount).toBe(0)
    } finally {
        await app.close()
    }
})

test('does not cache an authentication error when API-key auth lacks the scraper bearer token', async () => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    let fetchCount = 0
    globalThis.fetch = async () => {
        fetchCount++
        return Response.json({})
    }
    const app = controlApp('viewer', true)

    try {
        const response = await app.inject({ method: 'POST', url: '/api/ti/scraper/control', payload: { action: 'scheduler_run_now' } })
        expect(response.statusCode).toBe(401)
        expect(response.json()).toEqual({ error: 'authentication_required' })
        expect(response.headers['cache-control']).toBe('no-store, max-age=0')
        expect(fetchCount).toBe(0)
    } finally {
        await app.close()
    }
})

test('allows internal members to read control status but not change source state', async () => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    let fetchCount = 0
    globalThis.fetch = async () => {
        fetchCount++
        return Response.json({})
    }
    const app = controlApp('viewer')

    try {
        const read = await app.inject({ method: 'GET', url: '/api/ti/scraper/control', headers: { authorization: 'Bearer session-token' } })
        expect(read.statusCode).toBe(200)
        const requestsAfterRead = fetchCount
        expect(requestsAfterRead).toBeGreaterThan(0)

        const write = await app.inject({
            method: 'POST',
            url: '/api/ti/scraper/control',
            headers: { authorization: 'Bearer session-token' },
            payload: { action: 'source_status', sourceId: 'feed-1', status: 'paused' },
        })
        expect(write.statusCode).toBe(403)
        expect(write.json()).toEqual({ error: 'internal_access_required' })
        expect(write.headers['cache-control']).toBe('no-store, max-age=0')
        expect(fetchCount).toBe(requestsAfterRead)
    } finally {
        await app.close()
    }
})

test('returns the keyed scraper snapshot and per-endpoint health for the complete control dashboard', async () => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test/'
    const requests: Array<{ url: URL, authorization: string | null }> = []
    globalThis.fetch = async (input, init) => {
        const url = new URL(String(input))
        requests.push({ url, authorization: new Headers(init?.headers).get('authorization') })
        return Response.json({ path: url.pathname }, { status: url.pathname === '/v1/frontier' ? 503 : 200 })
    }
    const app = controlApp('viewer')

    try {
        const response = await app.inject({
            method: 'GET',
            url: '/api/ti/scraper/control?q=APT%2029',
            headers: { authorization: 'Bearer session-token', 'x-tenant-id': 'tenant-a' },
        })
        const body = response.json()
        const endpointNames = [
            'health', 'sources', 'frontier', 'resources', 'productSlo', 'scheduler', 'exposureParser', 'quality',
            'publicChannel', 'restricted', 'contracts', 'sourceInventory', 'sourcePacks', 'alerts', 'watchlists', 'deliveries',
        ]

        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe('no-store, max-age=0')
        expect(body).toMatchObject({ ok: true, query: 'APT 29', baseConfigured: true })
        expect(Object.keys(body.endpoints)).toEqual(endpointNames)
        expect(Object.fromEntries(endpointNames.map(name => [name, body[name]]))).toEqual(Object.fromEntries(
            endpointNames.map((name, index) => [name, { path: requests[index].url.pathname }]),
        ))
        expect(body.endpoints.frontier).toEqual({ ok: false, status: 503 })
        expect(requests).toHaveLength(endpointNames.length)
        expect(requests.map(({ url }) => url.pathname)).toEqual([
            '/v1/health', '/v1/sources', '/v1/frontier', '/v1/ops/resource-snapshot', '/v1/ops/product-slo',
            '/v1/ops/collection-scheduler', '/v1/dwm/exposure-parser/health', '/v1/quality/evaluate',
            '/v1/public-channels/status', '/v1/restricted-metadata/status', '/v1/contracts',
            '/v1/dwm/source-inventory', '/v1/dwm/source-packs', '/v1/dwm/alerts', '/v1/dwm/watchlists',
            '/v1/dwm/webhooks/deliveries',
        ])
        expect(requests.map(({ url }) => url.searchParams.get('q')).filter(Boolean)).toEqual(['APT 29', 'APT 29'])
        expect(requests.find(({ url }) => url.pathname === '/v1/ops/collection-scheduler')?.url.searchParams.get('tenantId')).toBe('tenant-a')
        expect(requests.find(({ url }) => url.pathname === '/v1/ops/collection-scheduler')?.authorization).toBe('Bearer session-token')
    } finally {
        await app.close()
    }
})

test('forwards a source status change for an internal editor', async () => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test/'
    let forwardedUrl = ''
    let forwardedInit: RequestInit | undefined
    globalThis.fetch = async (input, init) => {
        forwardedUrl = String(input)
        forwardedInit = init
        return Response.json({ source: { id: 'feed/one', status: 'paused' } })
    }
    const app = controlApp('editor')

    try {
        const response = await app.inject({
            method: 'POST',
            url: '/api/ti/scraper/control',
            headers: { authorization: 'Bearer session-token' },
            payload: { action: 'source_status', sourceId: 'feed/one', tenantId: 'tenant-a', status: 'paused' },
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toMatchObject({ ok: true, payload: { source: { id: 'feed/one', status: 'paused' } } })
        expect(new URL(forwardedUrl).pathname).toBe('/v1/sources/feed%2Fone')
        expect(forwardedInit?.method).toBe('PATCH')
        expect(JSON.parse(String(forwardedInit?.body))).toEqual({ status: 'paused', tenantId: 'tenant-a' })
        expect(new Headers(forwardedInit?.headers).get('authorization')).toBe('Bearer session-token')
        expect(new Headers(forwardedInit?.headers).get('x-actor-id')).toBe('ti-operator')
    } finally {
        await app.close()
    }
})

test('routes a manual collection request through the scraper scheduler', async () => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    let forwardedUrl = ''
    let forwardedBody: unknown
    globalThis.fetch = async (input, init) => {
        forwardedUrl = String(input)
        forwardedBody = JSON.parse(String(init?.body))
        return Response.json({ scheduled: true })
    }
    const app = controlApp('editor')

    try {
        const response = await app.inject({
            method: 'POST',
            url: '/api/ti/scraper/control',
            headers: { authorization: 'Bearer session-token' },
            payload: { action: 'scheduler_run_now' },
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toMatchObject({ ok: true, payload: { scheduled: true } })
        expect(new URL(forwardedUrl).pathname).toBe('/v1/ops/collection-scheduler')
        expect(forwardedBody).toEqual({ action: 'run_now', approvedBy: 'dashboard/ti/control', reason: 'operator source scheduler control' })
    } finally {
        await app.close()
    }
})

test.each([
    ['scheduler_pause', 'pause'],
    ['scheduler_resume', 'resume'],
] as const)('forwards %s through the scraper scheduler', async (action, upstreamAction) => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    const { response, requests } = await postControl({ action })

    expect(response.statusCode).toBe(200)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
        pathname: '/v1/ops/collection-scheduler',
        method: 'POST',
        body: {
            action: upstreamAction,
            approvedBy: 'dashboard/ti/control',
            reason: 'operator source scheduler control',
        },
    })
})

test.each([
    {
        name: 'source requests',
        request: {
            action: 'request_source', query: 'LockBit', target: 'https://t.me/example', targets: ['https://t.me/example'],
            sourceType: 'restricted_metadata', activate: false, approveMetadataOnly: true,
        },
        pathname: '/v1/dwm/source-requests',
        body: {
            tenantId: 'default', target: 'https://t.me/example', targets: ['https://t.me/example'], type: 'restricted_metadata',
            scope: 'LockBit', activate: false, approveMetadataOnly: true, approvedBy: 'dashboard/ti/control',
            requestedBy: 'dashboard/ti/control', priority: 'high',
        },
    },
    {
        name: 'candidate actions',
        request: {
            action: 'source_candidate_action', candidateAction: 'promote', sourceId: 'source-1', candidateId: 'candidate-2',
            approveMetadataOnly: true, reason: 'reviewed source policy',
        },
        pathname: '/v1/dwm/source-requests',
        body: {
            action: 'promote', sourceId: 'source-1', candidateId: 'candidate-2', approveMetadataOnly: true,
            approvedBy: 'dashboard/ti/control', decidedBy: 'dashboard/ti/control', reason: 'reviewed source policy',
        },
    },
    {
        name: 'watchlist creation',
        request: { action: 'create_watchlist', query: 'APT29', watchlistName: 'APT29 activity', terms: ['APT29', 'Cozy Bear'], webhookUrl: 'https://hooks.example.test/ti' },
        pathname: '/v1/dwm/watchlists',
        body: { tenantId: 'default', name: 'APT29 activity', terms: ['APT29', 'Cozy Bear'], webhookUrl: 'https://hooks.example.test/ti', status: 'active' },
    },
    {
        name: 'alert rebuilding',
        request: { action: 'rebuild_alerts' },
        pathname: '/v1/dwm/alerts/rebuild',
        body: { tenantId: 'default', actor: 'dashboard/ti/control' },
    },
])('forwards $name with its operator payload', async ({ request, pathname, body }) => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    const { response, requests } = await postControl(request)

    expect(response.statusCode).toBe(200)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ pathname, method: 'POST', body })
    expect(requests[0].authorization).toBe('Bearer session-token')
})

test.each([
    { name: 'invalid tenant identifier', request: { action: 'source_status', sourceId: 'feed-1', status: 'paused', tenantId: 'not valid' } },
    { name: 'unsupported source status', request: { action: 'source_status', sourceId: 'feed-1', status: 'deleted' } },
    { name: 'blank source identifier', request: { action: 'source_status', sourceId: '   ', status: 'paused' } },
])('rejects $name before contacting the scraper', async ({ request }) => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    let fetchCount = 0
    globalThis.fetch = async () => {
        fetchCount++
        return Response.json({})
    }
    const app = controlApp('editor')

    try {
        const response = await app.inject({ method: 'POST', url: '/api/ti/scraper/control', headers: { authorization: 'Bearer session-token' }, payload: request })
        expect(response.statusCode).toBe(400)
        expect(response.json()).toEqual({ ok: false, error: { message: 'A source and valid status are required.' } })
        expect(fetchCount).toBe(0)
    } finally {
        await app.close()
    }
})

test('rejects a non-string query before contacting the scraper', async () => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    let fetchCount = 0
    globalThis.fetch = async () => {
        fetchCount++
        return Response.json({})
    }
    const app = controlApp('editor')

    try {
        const response = await app.inject({
            method: 'POST',
            url: '/api/ti/scraper/control',
            headers: { authorization: 'Bearer session-token' },
            payload: { action: 'run_query', query: 42 },
        })

        expect(response.statusCode).toBe(400)
        expect(response.json()).toEqual({ ok: false, error: { code: 'invalid_query', message: 'Query must be a string.' } })
        expect(fetchCount).toBe(0)
    } finally {
        await app.close()
    }
})

function controlApp(role?: string, withApiKey = false) {
    const app = Fastify()
    if (role || withApiKey) {
        app.addHook('onRequest', (request, _reply, done) => {
            request.headers.id = 'ti-operator'
            Object.assign(request, {
                ...(withApiKey ? { apiKeyAuth: { ownerId: 'ti-operator' } } : {}),
                ...(role ? { rateLimitSession: {
                    user: { id: 'ti-operator' },
                    organizationMembership: {
                        organizationId: HANASAND_ORGANIZATION_ID,
                        organizationStatus: 'active',
                        membershipStatus: 'active',
                        role,
                    },
                    refreshed: { token: 'session-token', expires_at: '2030-01-01T00:00:00.000Z' },
                } } : {}),
            })
            done()
        })
    }
    app.get('/api/ti/scraper/control', getTiScraperControl)
    app.post('/api/ti/scraper/control', postTiScraperControl)
    return app
}

async function postControl(payload: unknown) {
    const requests: Array<{ pathname: string, method: string | undefined, body: unknown, authorization: string | null }> = []
    globalThis.fetch = async (input, init) => {
        const url = new URL(String(input))
        requests.push({
            pathname: url.pathname,
            method: init?.method,
            body: JSON.parse(String(init?.body)),
            authorization: new Headers(init?.headers).get('authorization'),
        })
        return Response.json({ accepted: true })
    }
    const app = controlApp('editor')
    try {
        const response = await app.inject({ method: 'POST', url: '/api/ti/scraper/control', headers: { authorization: 'Bearer session-token' }, payload })
        return { response, requests }
    } finally {
        await app.close()
    }
}
