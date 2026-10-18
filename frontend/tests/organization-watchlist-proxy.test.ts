import assert from 'node:assert/strict'
import test from 'node:test'
// @ts-expect-error Bun supplies this module for focused checks.
import { mock } from 'bun:test'

let cookieValues: Record<string, string> = {}
const requests: Array<{ url: string, init?: RequestInit }> = []
mock.module('next/headers', () => ({
    cookies: async () => ({ get: (name: string) => cookieValues[name] ? { value: cookieValues[name] } : undefined }),
}))
process.env.FRONTEND_AUTH_API = 'https://api.test/api'
process.env.TI_SCRAPER_API_BASE = 'https://scraper.test'
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    requests.push({ url, init })
    if (url.startsWith('https://api.test/')) return Response.json({ watchlistItem: { id: 'term-1', kind: 'domain', value: 'example.test', status: 'active' } }, { status: 201 })
    if (url === 'https://scraper.test/v1/dwm/watchlists') return Response.json({
        watchlist: { id: 'org_term-1' },
        alertRebuild: { status: 'completed', savedAlertCount: 1, alertIds: ['alert-1'] },
    }, { status: 201 })
    if (url.startsWith('https://scraper.test/v1/dwm/alerts/')) return Response.json({ alert: { id: 'alert-1' } })
    return Response.json({ error: 'unexpected request' }, { status: 500 })
}) as typeof fetch

const { NextRequest } = await import('next/server')
const { proxyOrganizationWatchlistMutation } = await import('../src/app/api/organizations/organizationWatchlistMutation')
const { proxyOrganizationApiRequest } = await import('../src/app/api/organizations/_organizationApiProxy')

test('forwards cookie and request authorization and user id to the DWM watchlist POST', async () => {
    for (const [cookies, expectedToken, expectedId] of [
        [{ access_token: 'cookie-token', id: 'cookie-user', impersonation_token: 'impersonation-secret' }, 'Bearer cookie-token', 'cookie-user'],
        [{}, 'Bearer request-token', 'request-user'],
    ] as const) {
        cookieValues = cookies
        requests.length = 0
        const request = new NextRequest('https://frontend.test/api/organizations/org_acme/watchlists?source=ui', {
            method: 'POST',
            headers: { authorization: 'Bearer request-token', id: 'request-user', 'x-tenant-id': 'tenant-acme' },
            body: JSON.stringify({ kind: 'domain', value: 'example.test' }),
        })
        const response = await proxyOrganizationWatchlistMutation(request, '/organizations/org_acme/watchlists', { method: 'POST', organizationId: 'org_acme' })
        assert.equal(response.status, 201)

        const organizationRequest = requests.find(item => item.url.startsWith('https://api.test/'))!
        const organizationHeaders = new Headers(organizationRequest.init?.headers)
        assert.equal(organizationHeaders.get('authorization'), expectedToken)
        assert.equal(organizationHeaders.get('id'), expectedId)
        assert.equal(organizationHeaders.has('x-impersonation-token'), false)
        assert.equal(organizationHeaders.get('x-tenant-id'), 'tenant-acme')
        assert.equal(organizationRequest.init?.body, JSON.stringify({ kind: 'domain', value: 'example.test' }))
        assert.equal(new URL(organizationRequest.url).searchParams.get('source'), 'ui')

        const dwmRequest = requests.find(item => item.url === 'https://scraper.test/v1/dwm/watchlists')!
        const dwmHeaders = new Headers(dwmRequest.init?.headers)
        assert.equal(dwmHeaders.get('authorization'), expectedToken)
        assert.equal(dwmHeaders.get('id'), expectedId)
        assert.equal(dwmHeaders.get('x-tenant-id'), 'org_acme')
        assert.equal(dwmHeaders.get('x-organization-id'), 'org_acme')
        assert.deepEqual(JSON.parse(String(dwmRequest.init?.body)), {
            id: 'org_term-1', tenantId: 'org_acme', organizationId: 'org_acme',
            name: 'Org watchlist - example.test', status: 'active',
            terms: [{ id: 'term-1', value: 'example.test', kind: 'domain' }], reason: 'organization_watchlist_saved',
        })
    }
})

test('organization proxy forwards impersonation by default when the caller does not opt out', async () => {
    cookieValues = { impersonation_token: 'impersonation-secret' }
    requests.length = 0
    const request = new NextRequest('https://frontend.test/api/organizations/org_acme', { method: 'GET' })
    await proxyOrganizationApiRequest(request, '/organizations/org_acme', { method: 'GET' })
    const upstream = requests[0]
    assert.equal(new Headers(upstream.init?.headers).get('x-impersonation-token'), 'impersonation-secret')
})

test('watchlist mutation keeps object-only coercion for primitive upstream JSON', async () => {
    cookieValues = {}
    requests.length = 0
    process.env.TI_SCRAPER_API_BASE = 'https://scraper.test'
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: input instanceof Request ? input.url : String(input), init })
        return Response.json(null, { status: 201 })
    }) as typeof fetch
    const request = new NextRequest('https://frontend.test/api/organizations/org_acme/watchlists', {
        method: 'POST', body: JSON.stringify({ kind: 'domain', value: 'example.test' }),
    })
    const response = await proxyOrganizationWatchlistMutation(request, '/organizations/org_acme/watchlists', { method: 'POST', organizationId: 'org_acme' })
    const payload = await response.json() as { dwmAlertBridge?: { skipped?: boolean, reason?: string } }
    assert.equal(payload.dwmAlertBridge?.skipped, true)
    assert.equal(payload.dwmAlertBridge?.reason, 'missing_watchlist_item')
    assert.equal(requests.length, 1)
    process.env.TI_SCRAPER_API_BASE = 'https://scraper.test'
})

test('watchlist PUT and DELETE preserve method, query, tenant, and request body forwarding', async () => {
    cookieValues = {}
    requests.length = 0
    process.env.TI_SCRAPER_API_BASE = ''
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: input instanceof Request ? input.url : String(input), init })
        return Response.json({ saved: true })
    }) as typeof fetch
    for (const method of ['PUT', 'DELETE'] as const) {
        const body = JSON.stringify({ status: method === 'PUT' ? 'paused' : 'confirm' })
        const request = new NextRequest(`https://frontend.test/api/organizations/org_acme/watchlists/item-1?source=${method}`, {
            method,
            headers: { 'x-tenant-id': 'tenant-acme' },
            body,
        })
        await proxyOrganizationWatchlistMutation(request, '/organizations/org_acme/watchlists/item-1', { method, organizationId: 'org_acme' })
        const upstream = requests.at(-1)!
        assert.equal(new URL(upstream.url).searchParams.get('source'), method)
        assert.equal(upstream.init?.method, method)
        assert.equal(upstream.init?.body, body)
        assert.equal(new Headers(upstream.init?.headers).get('x-tenant-id'), 'tenant-acme')
    }
    process.env.TI_SCRAPER_API_BASE = 'https://scraper.test'
})

test('passes organization proxy non-success status and JSON body through without calling DWM', async () => {
    cookieValues = {}
    requests.length = 0
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: input instanceof Request ? input.url : String(input), init })
        return Response.json({ error: { code: 'duplicate_watchlist_term', message: 'This term already exists.' } }, { status: 409 })
    }) as typeof fetch
    const request = new NextRequest('https://frontend.test/api/organizations/org_acme/watchlists', {
        method: 'POST', body: JSON.stringify({ kind: 'domain', value: 'example.test' }),
    })
    const response = await proxyOrganizationWatchlistMutation(request, '/organizations/org_acme/watchlists', { method: 'POST', organizationId: 'org_acme' })
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: { code: 'duplicate_watchlist_term', message: 'This term already exists.' } })
    assert.equal(requests.length, 1)
})

test('keeps the organization proxy error response and skips DWM when forwarding fails', async () => {
    cookieValues = {}
    requests.length = 0
    globalThis.fetch = (async () => { throw new Error('upstream offline') }) as typeof fetch
    const request = new NextRequest('https://frontend.test/api/organizations/org_acme/watchlists', {
        method: 'POST', body: JSON.stringify({ kind: 'domain', value: 'example.test' }),
    })
    const response = await proxyOrganizationWatchlistMutation(request, '/organizations/org_acme/watchlists', { method: 'POST', organizationId: 'org_acme' })
    assert.equal(response.status, 502)
    assert.deepEqual(await response.json(), { error: { code: 'organization_proxy_failed', message: 'upstream offline' } })
    assert.equal(requests.length, 0)
})
