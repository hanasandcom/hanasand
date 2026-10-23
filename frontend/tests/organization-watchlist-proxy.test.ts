import { expect, mock, test } from 'bun:test'
let jar: Record<string, string> = {}
let validations: unknown[] = []
let requests: Array<{ url: string, init?: RequestInit }> = []
let used = new Set<string>()
let state = 'valid'
let status = 201
const payload = { saved: true, watchlistItem: { id: 'item' }, dwmAlertBridge: { projection: { status: 'pending' } } }
mock.module('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: (name: string) => jar[name] ? { value: jar[name] } : undefined }) }))
mock.module('../src/utils/proxy/tokenIsValid', () => ({ default: async (token: string, id: string, _unused: unknown, options: { deviceProof: { proof: string } }) => {
    validations.push({ token, id, options })
    if (used.has(options.deviceProof.proof)) return { valid: false, state: 'invalid' }
    used.add(options.deviceProof.proof)
    return { valid: state === 'valid', state }
} }))
process.env.FRONTEND_AUTH_API = 'https://core.invalid/api'
process.env.SOCIAL_AUTH_ORIGIN = 'https://hanasand.com'
globalThis.fetch = (async (target, init) => { requests.push({ url: String(target), init }); return Response.json(status === 409 ? { error: 'quota_exhausted' } : payload, { status }) }) as typeof fetch
const { NextRequest } = await import('next/server')
const { proxyOrganizationWatchlistMutation } = await import('../src/app/api/organizations/organizationWatchlistMutation')
const { proxyOrganizationApiRequest } = await import('../src/app/api/organizations/_organizationApiProxy')
function reset() { jar = {}; validations = []; requests = []; used = new Set(); state = 'valid'; status = 201; process.env.VM_API_TOKEN = 'synthetic-assertion' }
function request(path = '/organizations/org/watchlists', method: 'POST' | 'PUT' | 'DELETE' = 'POST', headers: Record<string, string> = {}, body = '{}') {
    return new NextRequest(`https://localhost:3000/api${path}`, { method, headers: { authorization: 'Bearer session', id: 'user', dpop: 'proof', ...headers }, body })
}
const send = (req = request(), path = '/organizations/org/watchlists', method: 'POST' | 'PUT' | 'DELETE' = 'POST') => proxyOrganizationWatchlistMutation(req, path, { method, organizationId: 'org' })
test('canonical verification runs once before one trusted core hop, retaining saved partial response', async () => {
    reset()
    const response = await send()
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual(payload)
    expect(validations).toEqual([{ token: 'session', id: 'user', options: { includeInternalAccess: false, deviceProof: { proof: 'proof', method: 'POST', url: 'https://hanasand.com/api/organizations/org/watchlists' } } }])
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('https://core.invalid/api/organizations/org/watchlists')
    const headers = new Headers(requests[0].init?.headers)
    expect(headers.get('x-hanasand-server-session-assertion')).toBe('synthetic-assertion')
    expect(headers.get('x-hanasand-server-session-id')).toBe('user')
    expect(headers.get('dpop')).toBeNull()
    expect(headers.get('x-device-proof-url')).toBeNull()
})
test('separate replay is rejected while a fresh proof proceeds', async () => {
    reset()
    expect((await send()).status).toBe(201)
    expect((await send()).status).toBe(401)
    expect((await send(request(undefined, 'POST', { dpop: 'fresh' }))).status).toBe(201)
    expect(requests).toHaveLength(2)
})
test('foreign targets, scope, impersonation and spoofed server context fail before verification', async () => {
    for (const headers of [{ 'x-device-proof-url': 'https://evil.invalid/api/organizations/org/watchlists' }, { 'x-device-proof-method': 'GET' }, { 'x-tenant-id': 'other' }, { 'x-organization-id': 'other' }, { 'x-impersonation-token': 'forbidden' }, { 'x-hanasand-server-session-validated': '1' }, { 'x-hanasand-session-validated': '1' }]) {
        reset()
        expect((await send(request(undefined, 'POST', headers))).status).toBeGreaterThanOrEqual(400)
        expect(validations).toHaveLength(0)
        expect(requests).toHaveLength(0)
    }
})
test('ambiguous credentials and malformed/oversized or conflicting bodies are rejected', async () => {
    reset(); jar = { id: 'other', access_token: 'other-session' }
    expect((await send()).status).toBe(401)
    for (const body of ['null', '[]', '{', JSON.stringify({ tenantId: 'other' }), JSON.stringify({ notes: 'x'.repeat(17000) })]) {
        reset()
        expect((await send(request(undefined, 'POST', {}, body))).status).toBe(400)
        expect(validations).toHaveLength(0)
        expect(requests).toHaveLength(0)
    }
})
test('validator outage and absent trusted-hop configuration fail closed', async () => {
    reset(); state = 'unavailable'
    expect((await send()).status).toBe(503)
    expect(requests).toHaveLength(0)
    reset(); delete process.env.VM_API_TOKEN
    expect((await send()).status).toBe(503)
    expect(validations).toHaveLength(0)
    expect(requests).toHaveLength(0)
})
test('finite actions preserve existing200 and body; wrong route is rejected', async () => {
    for (const [path, method] of [['/organizations/org/watchlists/item', 'PUT'], ['/organizations/org/watchlists/item', 'DELETE'], ['/organizations/org/watchlists/item/actions', 'POST'], ['/organizations/org/watchlists/cleanup', 'POST']] as const) {
        reset(); status = 200
        expect((await send(request(path, method), path, method)).status).toBe(200)
        expect(requests).toHaveLength(1)
        expect(requests[0].init?.body).toBe('{}')
        expect(requests[0].init?.method).toBe(method)
    }
    reset()
    expect((await send(request('/organizations/other/watchlists'))).status).toBe(400)
    expect(validations).toHaveLength(0)
})
test('original core rejection passes through without scraper fanout', async () => {
    reset(); status = 409
    const response = await send()
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'quota_exhausted' })
    expect(requests).toHaveLength(1)
})
test('unrelated organization proxy retains its impersonation behavior', async () => {
    reset(); jar = { impersonation_token: 'synthetic-impersonation' }
    await proxyOrganizationApiRequest(new NextRequest('https://hanasand.com/api/organizations/org'), '/organizations/org')
    expect(new Headers(requests[0].init?.headers).get('x-impersonation-token')).toBe('synthetic-impersonation')
})

test('supported historical metadata and cleanup aliases remain intact', async () => {
    for (const [path, body] of [['/organizations/org/watchlists', { kind: 'domain', value: 'example.test', request_id: 'legacy' }], ['/organizations/org/watchlists/cleanup', { item_ids: ['item'], request_id: 'legacy' }]] as const) {
        reset()
        const text = JSON.stringify(body)
        expect((await send(request(path, 'POST', {}, text), path)).status).toBe(201)
        expect(requests[0].init?.body).toBe(text)
    }
})

test('actual Next mutation routes preserve encoded dot, colon and at-sign IDs with exact public proof target', async () => {
    const { PUT } = await import('../src/app/api/organizations/[id]/watchlists/[itemId]/route')
    for (const [id, itemId] of [['org.name', 'item.name'], ['org:colon', 'item:colon'], ['org@domain', 'item@domain'], ['.org', '.item']]) {
        reset(); status = 200
        const path = `/organizations/${encodeURIComponent(id)}/watchlists/${encodeURIComponent(itemId)}`
        const response = await PUT(request(path, 'PUT'), { params: Promise.resolve({ id, itemId }) })
        expect(response.status).toBe(200)
        expect(validations).toHaveLength(1)
        expect(validations[0]).toEqual({ token: 'session', id: 'user', options: { includeInternalAccess: false, deviceProof: { proof: 'proof', method: 'PUT', url: `https://hanasand.com/api${path}` } } })
        expect(requests).toHaveLength(1)
        expect(requests[0].url).toBe(`https://core.invalid/api${path}`)
    }
})

test('encoded separators, double encoding, dotsegments and noncanonical internal paths fail before verifier', async () => {
    const { PUT } = await import('../src/app/api/organizations/[id]/watchlists/[itemId]/route')
    for (const bad of ['.', '..', 'bad/item', 'bad\\item', '%2F', '%252F', 'bad\u0000item', 'bad item']) {
        for (const [id, itemId] of [[bad, 'item'], ['org', bad]]) {
            reset()
            const path = `/organizations/${encodeURIComponent(id)}/watchlists/${encodeURIComponent(itemId)}`
            const response = await PUT(request(path, 'PUT'), { params: Promise.resolve({ id, itemId }) })
            expect(response.status).toBe(400)
            expect(validations).toHaveLength(0)
            expect(requests).toHaveLength(0)
        }
    }
    for (const path of ['/organizations/org%252Fother/watchlists/item', '/organizations/org/watchlists/item%2Fother', '/organizations/org/watchlists/item%5Cother', '/organizations/org/watchlists/%2E%2E', '/organizations/org/watchlists/%', '/organizations/org%2Ename/watchlists/item']) {
        reset()
        const response = await proxyOrganizationWatchlistMutation(request(path, 'PUT'), path, { method: 'PUT', organizationId: path.includes('org%2Ename') ? 'org.name' : 'org' })
        expect(response.status).toBe(400)
        expect(validations).toHaveLength(0)
        expect(requests).toHaveLength(0)
    }
})

test('valid encoded IDs cannot change asserted public target, organization or actual incoming path', async () => {
    const path = '/organizations/org%3Aname/watchlists/item%40domain'
    for (const [req, org] of [[request(path, 'PUT', { 'x-device-proof-url': 'https://hanasand.com/api/organizations/org:name/watchlists/item@domain' }), 'org:name'], [request(path, 'PUT'), 'other'], [request('/organizations/org%3Aname/watchlists/other', 'PUT'), 'org:name']] as const) {
        reset()
        const response = await proxyOrganizationWatchlistMutation(req, path, { method: 'PUT', organizationId: org })
        expect(response.status).toBeGreaterThanOrEqual(400)
        expect(validations).toHaveLength(0)
        expect(requests).toHaveLength(0)
    }
})

test('encoded organization works for actual create, cleanup and action routes without alternate proof targets', async () => {
    const create = await import('../src/app/api/organizations/[id]/watchlists/route')
    const cleanup = await import('../src/app/api/organizations/[id]/watchlists/cleanup/route')
    const action = await import('../src/app/api/organizations/[id]/watchlists/[itemId]/actions/route')
    const id = 'org.name:tenant@example'
    const itemId = 'item.name:watch@example'
    const root = `/organizations/${encodeURIComponent(id)}/watchlists`
    for (const [path, invoke] of [
        [root, (req: InstanceType<typeof NextRequest>) => create.POST(req, { params: Promise.resolve({ id }) })],
        [`${root}/cleanup`, (req: InstanceType<typeof NextRequest>) => cleanup.POST(req, { params: Promise.resolve({ id }) })],
        [`${root}/${encodeURIComponent(itemId)}/actions`, (req: InstanceType<typeof NextRequest>) => action.POST(req, { params: Promise.resolve({ id, itemId }) })],
    ] as const) {
        reset()
        expect((await invoke(request(path))).status).toBe(201)
        expect(validations).toHaveLength(1)
        expect(requests).toHaveLength(1)
    }
    for (const path of ['/organizations/org%3aname/watchlists/item', '/organizations/org:name/watchlists/item']) {
        reset()
        expect((await proxyOrganizationWatchlistMutation(request(path, 'PUT'), path, { method: 'PUT', organizationId: 'org:name' })).status).toBe(400)
        expect(validations).toHaveLength(0)
        expect(requests).toHaveLength(0)
    }
})
