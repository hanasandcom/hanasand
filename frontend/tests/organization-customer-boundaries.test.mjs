import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { organizationWorkspaceSource } from './organization-workspace-source.mjs'
import { afterAll, afterEach, mock, test } from 'bun:test'
import { NextRequest } from 'next/server'

const originalVmToken = process.env.VM_API_TOKEN
const originalFetch = globalThis.fetch
const originalAuthApi = process.env.FRONTEND_AUTH_API
const originalIdentityApi = process.env.FRONTEND_IDENTITY_API
const originalScraperApi = process.env.TI_SCRAPER_API_BASE
const cookieValues = new Map()

process.env.VM_API_TOKEN = 'synthetic-verified-server-key'
process.env.FRONTEND_AUTH_API = 'http://auth.test/api'
process.env.FRONTEND_IDENTITY_API = 'http://identity.test/api'
process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'

mock.module('next/headers', () => ({
    headers: async() => new Headers(),
    cookies: async() => ({ get: name => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined }),
}))

mock.module('../src/utils/proxy/tokenIsValid', () => ({ default: async() => ({ valid: true, state: 'valid' }) }))

afterEach(() => {
    globalThis.fetch = originalFetch
    cookieValues.clear()
})

afterAll(() => {
    if (originalVmToken === undefined) delete process.env.VM_API_TOKEN
    else process.env.VM_API_TOKEN = originalVmToken
    if (originalAuthApi === undefined) delete process.env.FRONTEND_AUTH_API
    else process.env.FRONTEND_AUTH_API = originalAuthApi
    if (originalIdentityApi === undefined) delete process.env.FRONTEND_IDENTITY_API
    else process.env.FRONTEND_IDENTITY_API = originalIdentityApi
    if (originalScraperApi === undefined) delete process.env.TI_SCRAPER_API_BASE
    else process.env.TI_SCRAPER_API_BASE = originalScraperApi
})

test('organization API-key proxy lists, creates, revokes, and preserves authorization denials', async() => {
    const calls = []
    globalThis.fetch = async(input, init) => {
        const headers = new Headers(init?.headers)
        calls.push({ url: String(input), method: init?.method, body: init?.body, headers })
        if (headers.get('id') === 'viewer') {
            return Response.json({ error: { code: 'organization_role_forbidden', message: 'Organization owners and administrators manage API keys.' } }, { status: 403 })
        }
        if (init?.method === 'POST') return Response.json({ apiKey: { id: 'key-1' }, secret: 'shown-once' }, { status: 201 })
        if (init?.method === 'DELETE') return Response.json({ apiKey: { id: 'key-1', enabled: false } })
        return Response.json({ organizationId: 'org/proxy', apiKeys: [{ id: 'key-1', enabled: true }] })
    }

    const collectionRoute = await import('../src/app/api/organizations/[id]/api-keys/route')
    const itemRoute = await import('../src/app/api/organizations/[id]/api-keys/[keyId]/route')
    const context = { params: Promise.resolve({ id: 'org/proxy' }) }
    const headers = { authorization: 'Bearer owner-session', id: 'owner' }

    const list = await collectionRoute.GET(new NextRequest('http://frontend.test/api/organizations/org/api-keys', { headers }), context)
    assert.equal(list.status, 200)
    assert.deepEqual(await list.json(), { organizationId: 'org/proxy', apiKeys: [{ id: 'key-1', enabled: true }] })

    const createBody = JSON.stringify({ name: 'Event ingestion' })
    const create = await collectionRoute.POST(new NextRequest('http://frontend.test/api/organizations/org/api-keys', { method: 'POST', headers, body: createBody }), context)
    assert.equal(create.status, 201)
    assert.deepEqual(await create.json(), { apiKey: { id: 'key-1' }, secret: 'shown-once' })

    const revoke = await itemRoute.DELETE(new NextRequest('http://frontend.test/api/organizations/org/api-keys/key', { method: 'DELETE', headers }), {
        params: Promise.resolve({ id: 'org/proxy', keyId: 'key/1' }),
    })
    assert.equal(revoke.status, 200)
    assert.deepEqual(await revoke.json(), { apiKey: { id: 'key-1', enabled: false } })

    const denied = await collectionRoute.GET(new NextRequest('http://frontend.test/api/organizations/org/api-keys', {
        headers: { authorization: 'Bearer viewer-session', id: 'viewer' },
    }), context)
    assert.equal(denied.status, 403)
    assert.equal((await denied.json()).error.code, 'organization_role_forbidden')

    assert.deepEqual(calls.slice(0, 3).map(call => ({ url: call.url, method: call.method, body: call.body })), [
        { url: 'http://auth.test/api/organizations/org%2Fproxy/api-keys', method: 'GET', body: undefined },
        { url: 'http://auth.test/api/organizations/org%2Fproxy/api-keys', method: 'POST', body: createBody },
        { url: 'http://auth.test/api/organizations/org%2Fproxy/api-keys/key%2F1', method: 'DELETE', body: '' },
    ])
    assert.equal(calls[0].headers.get('authorization'), 'Bearer owner-session')
})

test('workspace organization list reads from Identity without calling the Hanasand API', async() => {
    let upstream
    globalThis.fetch = async(input, init) => {
        upstream = { url: String(input), init }
        return Response.json({ organizations: [{ id: 'org_identity', name: 'Identity Org' }] })
    }
    const { GET } = await import('../src/app/api/organizations/route')
    const response = await GET(new NextRequest('http://frontend.test/api/organizations?source=workspace', {
        headers: { authorization: 'Bearer identity-session', id: 'identity-user' },
    }))

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { organizations: [{ id: 'org_identity', name: 'Identity Org' }] })
    assert.equal(upstream.url, 'http://identity.test/api/organizations?source=workspace')
    assert.equal(new Headers(upstream.init?.headers).get('authorization'), 'Bearer identity-session')
    assert.equal(new Headers(upstream.init?.headers).get('id'), 'identity-user')
})

test('organization watchlist save retains core receipts and never fans out a user session', async() => {
    const calls = []
    let projectionState = 'pending'
    globalThis.fetch = async(input, init) => {
        calls.push({ url: String(input), headers: new Headers(init?.headers) })
        assert.ok(String(input).startsWith('http://auth.test/api/organizations/org-review/watchlists'))
        return Response.json({
            saved: true,
            watchlistItem: { id: 'term-1', kind: 'company', value: 'Review Company', status: 'active' },
            operation: { actorId: 'owner', requestId: 'request-1' },
            dwmAlertBridge: {
                schemaVersion: 'organization.watchlist_projection_receipt.v1',
                organizationId: 'org-review', itemIds: ['term-1'],
                projection: { status: projectionState, checkedAt: null, source: 'identity', watchlistIds: [], unresolvedItemIds: [] },
                alertRebuild: { status: 'not_requested', reason: 'projection_only' },
            },
        }, { status: init?.method === 'POST' ? 201 : 200 })
    }
    const { POST } = await import('../src/app/api/organizations/[id]/watchlists/route')
    const context = { params: Promise.resolve({ id: 'org-review' }) }
    for (const outcome of ['pending', 'failed', 'unchanged']) {
        projectionState = outcome
        const response = await POST(new NextRequest('https://hanasand.com/api/organizations/org-review/watchlists', {
            method: 'POST', headers: { authorization: 'Bearer owner-session', id: 'owner', dpop: `synthetic-${outcome}` },
            body: JSON.stringify({ kind: 'company', value: 'Review Company', requestId: 'request-1' }),
        }), context)
        const payload = await response.json()
        assert.equal(response.status, 201)
        assert.equal(payload.saved, true)
        assert.equal(payload.watchlistItem.id, 'term-1')
        assert.equal(payload.operation.actorId, 'owner')
        assert.equal(payload.dwmAlertBridge.projection.status, outcome)
        assert.equal(payload.dwmAlertBridge.alertRebuild.status, 'not_requested')
        assert.equal('savedAlertCount' in payload.dwmAlertBridge, false)
    }
    assert.equal(calls.length, 3)
    for (const call of calls) {
        assert.equal(call.headers.get('authorization'), 'Bearer owner-session')
        assert.equal(call.headers.get('x-hanasand-server-session-assertion'), 'synthetic-verified-server-key')
        assert.equal(call.headers.get('dpop'), null)
    }
    const workspace = organizationWorkspaceSource
    assert.doesNotMatch(workspace, /editDuplicate \|\| !editChanged \|\| Boolean\(busy\)/)
    assert.match(workspace, /\{editChanged \? 'Save' : 'Sync'\}/)
    assert.match(workspace, /await loadOrganizationBundle\(selectedOrganization\.id\)/)
})

test('organization onboarding reads organizations and readiness only from the persisted proxy', async() => {
    const organizationsRoute = await readFile(new URL('../src/app/api/organizations/route.ts', import.meta.url), 'utf8')
    const readinessRoute = await readFile(new URL('../src/app/api/organizations/[id]/alert-readiness/route.ts', import.meta.url), 'utf8')
    const scraperControlHandler = await readFile(new URL('../../api/src/handlers/ti/scraperControl.ts', import.meta.url), 'utf8')
    for (const source of [organizationsRoute, readinessRoute]) {
        assert.match(source, /proxyOrganizationApiRequest/)
        assert.doesNotMatch(source, /ProofLedger|productProgress|PRODUCT_PROGRESS/)
    }
    assert.match(scraperControlHandler, /scraperBase\(\)/)
    assert.match(scraperControlHandler, /ti_scraper_unavailable/)
    assert.doesNotMatch(scraperControlHandler, /ProofLedger|productProgress|PRODUCT_PROGRESS/)
})
