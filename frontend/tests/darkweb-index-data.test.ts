import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'bun:test'
import { NextRequest } from 'next/server'

let requestHeaders = new Headers({ host: 'frontend.test', 'x-forwarded-proto': 'https' })
const requests: Array<{ url: string, init?: RequestInit }> = []
const originalFetch = globalThis.fetch

mock.module('next/headers', () => ({ headers: async () => requestHeaders }))
mock.module('@/utils/dwm/scraperApiBase', () => ({ tiScraperApiBase: () => 'https://scraper.test' }))

const { fetchDarkwebSearch, fetchDarkwebStatus } = await import('../src/app/ti/darkweb/index/indexData')
const { GET } = await import('../src/app/api/ti/darkweb/[[...path]]/route')

afterEach(() => {
    globalThis.fetch = originalFetch
    requests.length = 0
    requestHeaders = new Headers({ host: 'frontend.test', 'x-forwarded-proto': 'https' })
})

test('search maps filters through the public proxy and returns its response data', async () => {
    const payload = { count: 1, rows: [{ id: 'record-1', title: 'Example exposure' }] }
    globalThis.fetch = async (input, init) => {
        requests.push({ url: String(input), init })
        return Response.json(payload)
    }

    const result = await fetchDarkwebSearch({
        query: 'Acme & Sons', category: 'ransomware_claim', legalTriage: 'approved', network: 'tor', reviewState: 'ready',
    })

    assert.deepEqual(result, payload)
    assert.equal(requests[0]?.url, 'https://frontend.test/api/ti/darkweb/search?limit=50&q=Acme+%26+Sons&category=ransomware_claim&legalTriage=approved&network=tor&reviewState=ready')
    assert.equal(requests[0]?.init?.cache, 'no-store')
    assert.ok(requests[0]?.init?.signal)
})

test('status maps to the public proxy and non-success responses return null', async () => {
    let statusRequest = ''
    globalThis.fetch = async (input) => {
        statusRequest = String(input)
        return Response.json({ error: 'unavailable' }, { status: 503 })
    }

    assert.equal(await fetchDarkwebStatus(), null)
    assert.equal(statusRequest, 'https://frontend.test/api/ti/darkweb/status')
})

test('search returns null when the proxy fetch fails', async () => {
    globalThis.fetch = async () => { throw new Error('network unavailable') }
    assert.equal(await fetchDarkwebSearch({ query: '', category: '', legalTriage: '', network: '', reviewState: '' }), null)
})

test('forwarded host and protocol select the public proxy origin', async () => {
    requestHeaders = new Headers({ host: 'internal.test', 'x-forwarded-host': 'public.test, internal.test', 'x-forwarded-proto': 'https, http' })
    globalThis.fetch = async (input) => {
        requests.push({ url: String(input) })
        return Response.json({ status: { monitoredSourceCount: 7 } })
    }

    assert.deepEqual(await fetchDarkwebStatus(), { status: { monitoredSourceCount: 7 } })
    assert.equal(requests[0]?.url, 'https://public.test/api/ti/darkweb/status')
})

test('proxy forwards only supported search parameters and preserves upstream data', async () => {
    let upstreamUrl = ''
    globalThis.fetch = async (input, init) => {
        upstreamUrl = String(input)
        assert.equal(init?.cache, 'no-store')
        return Response.json({ rows: [{ id: 'record-2' }] }, { status: 206 })
    }
    const request = new NextRequest('https://frontend.test/api/ti/darkweb/search?limit=50&q=Acme&category=claim&legalTriage=approved&network=tor&reviewState=ready&ignored=secret')

    const response = await GET(request, { params: Promise.resolve({ path: ['search'] }) })

    assert.equal(upstreamUrl, 'https://scraper.test/v1/darkweb/search?limit=50&q=Acme&category=claim&legalTriage=approved&network=tor&reviewState=ready')
    assert.equal(response.status, 206)
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
    assert.deepEqual(await response.json(), { rows: [{ id: 'record-2' }] })
})
