import { expect, test } from 'bun:test'
import { controlApp, postControl } from './ti-scraper-control-test-app.ts'

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
    const { response, requests } = await postControl({ action: 'scheduler_run_now' })

    expect(response.statusCode).toBe(200)
    expect(requests).toHaveLength(1)
    expect(requests[0].pathname).toBe('/v1/ops/collection-scheduler')
    expect(requests[0].body).toEqual({ action: 'run_now', approvedBy: 'dashboard/ti/control', reason: 'operator source scheduler control' })
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
