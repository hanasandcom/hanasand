import { afterEach, test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadDwmAlerts, loadDwmCases, loadDwmDeliveries, WORKBENCH_FETCH_TIMEOUT_MS } from '../src/app/dashboard/ti/workbench/pageData'

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalFetch = globalThis.fetch
const originalTimeout = AbortSignal.timeout

afterEach(() => {
    if (originalBase === undefined) delete process.env.TI_SCRAPER_API_BASE
    else process.env.TI_SCRAPER_API_BASE = originalBase
    globalThis.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
})

test('workbench collection loaders request the expected endpoint, tenant, and fetch options', async () => {
    process.env.TI_SCRAPER_API_BASE = 'https://scraper.example/root'
    const requests: Array<{ url: URL, init?: RequestInit }> = []
    let timeoutMs = 0
    AbortSignal.timeout = ((milliseconds: number) => {
        timeoutMs = milliseconds
        return originalTimeout(milliseconds)
    }) as typeof AbortSignal.timeout
    globalThis.fetch = (async (input, init) => {
        requests.push({ url: new URL(String(input)), init })
        return Response.json({ alerts: [{ id: 'a1' }], cases: [{ id: 'c1' }], deliveries: [{ id: 'd1' }] })
    }) as typeof fetch

    assert.deepEqual(await loadDwmAlerts(), [{ id: 'a1' }])
    assert.deepEqual(await loadDwmCases(), [{ id: 'c1' }])
    assert.deepEqual(await loadDwmDeliveries(), [{ id: 'd1' }])
    assert.deepEqual(requests.map(({ url }) => url.pathname), [
        '/v1/dwm/alerts', '/v1/cases', '/v1/dwm/webhooks/deliveries',
    ])
    assert.ok(requests.every(({ url }) => url.searchParams.get('tenantId') === 'default'))
    assert.ok(requests.every(({ init }) => init?.cache === 'no-store' && init.signal instanceof AbortSignal))
    assert.equal(timeoutMs, WORKBENCH_FETCH_TIMEOUT_MS)
})

test('workbench case and delivery collections retain descending timestamp order', async () => {
    process.env.TI_SCRAPER_API_BASE = 'https://scraper.example'
    globalThis.fetch = (async input => {
        const path = new URL(String(input)).pathname
        if (path === '/v1/cases') return Response.json({ cases: [{ id: 'old', updatedAt: '2026-01-01' }, { id: 'new', updatedAt: '2026-02-01' }] })
        return Response.json({ deliveries: [{ id: 'old', attemptedAt: '2026-01-01' }, { id: 'new', attemptedAt: '2026-02-01' }] })
    }) as typeof fetch

    assert.deepEqual((await loadDwmCases()).map(item => item.id), ['new', 'old'])
    assert.deepEqual((await loadDwmDeliveries()).map(item => item.id), ['new', 'old'])
})

test('workbench collection loaders return empty arrays when base, response, or payload is unavailable', async () => {
    delete process.env.TI_SCRAPER_API_BASE
    let calls = 0
    globalThis.fetch = (async () => { calls++; return Response.json({ alerts: [{ id: 'unexpected' }] }) }) as typeof fetch
    assert.deepEqual(await loadDwmAlerts(), [])
    assert.equal(calls, 0)

    process.env.TI_SCRAPER_API_BASE = 'https://scraper.example'
    globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch
    assert.deepEqual(await loadDwmAlerts(), [])

    globalThis.fetch = (async () => { throw new Error('network unavailable') }) as typeof fetch
    assert.deepEqual(await loadDwmCases(), [])

    globalThis.fetch = (async () => new Response('invalid json')) as typeof fetch
    assert.deepEqual(await loadDwmDeliveries(), [])

    globalThis.fetch = (async () => Response.json({ unrelated: [] })) as typeof fetch
    assert.deepEqual(await loadDwmAlerts(), [])
})

test('workbench case and delivery loaders ignore truthy non-array collection values', async () => {
    process.env.TI_SCRAPER_API_BASE = 'https://scraper.example'
    globalThis.fetch = (async input => {
        const path = new URL(String(input)).pathname
        return path === '/v1/cases'
            ? Response.json({ cases: { id: 'not-an-array' } })
            : Response.json({ deliveries: 'not-an-array' })
    }) as typeof fetch

    assert.deepEqual(await loadDwmCases(), [])
    assert.deepEqual(await loadDwmDeliveries(), [])
})

test('workbench loaders skip non-record rows and preserve valid collection data', async () => {
    process.env.TI_SCRAPER_API_BASE = 'https://scraper.example'
    globalThis.fetch = (async input => {
        const path = new URL(String(input)).pathname
        return path === '/v1/cases'
            ? Response.json({ cases: [null, { id: 'case', updatedAt: '2026-02-01' }, 'invalid'] })
            : Response.json({ deliveries: [null, { id: 'delivery', attemptedAt: '2026-02-01' }, 'invalid'] })
    }) as typeof fetch

    assert.deepEqual((await loadDwmCases()).map(item => item.id), ['case'])
    assert.deepEqual((await loadDwmDeliveries()).map(item => item.id), ['delivery'])
})

test('workbench alert loader excludes null rows before page adapters consume them', async () => {
    process.env.TI_SCRAPER_API_BASE = 'https://scraper.example'
    const alert = { id: 'alert-1', severity: 'high' }
    globalThis.fetch = (async () => Response.json({ alerts: [null, alert, 'invalid'] })) as typeof fetch

    assert.deepEqual(await loadDwmAlerts(), [alert])
})
