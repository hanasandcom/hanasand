import { expect, test } from 'bun:test'
import { controlApp } from './ti-scraper-control-test-app.ts'

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
