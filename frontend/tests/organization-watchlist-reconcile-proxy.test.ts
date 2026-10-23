import { expect, test } from 'bun:test'
import { NextRequest, validations, requests, reset, request, setUpstreamStatus } from './helpers/organizationWatchlistProxyFixture'

test('projection retry POST preserves canonical proof-once transport and explicit selector receipt', async () => {
    const { POST } = await import('../src/app/api/organizations/[id]/watchlists/reconcile/route')
    const id = 'org.name:tenant@example'
    const path = `/organizations/${encodeURIComponent(id)}/watchlists/reconcile`
    const body = JSON.stringify({ itemIds: ['item.name', 'item:colon', 'item@domain'], requestId: 'explicit-human-attempt' })
    reset(); setUpstreamStatus(200)
    expect((await POST(request(path, 'POST', {}, body), { params: Promise.resolve({ id }) })).status).toBe(200)
    expect(validations).toHaveLength(1)
    expect(validations[0]).toEqual({ token: 'session', id: 'user', options: { includeInternalAccess: false, deviceProof: { proof: 'proof', method: 'POST', url: `https://hanasand.com/api${path}` } } })
    expect(requests).toHaveLength(1)
    expect(requests[0].init?.body).toBe(body)
    expect(new Headers(requests[0].init?.headers).get('dpop')).toBeNull()
    expect((await POST(request(path, 'POST', {}, body), { params: Promise.resolve({ id }) })).status).toBe(401)
    expect((await POST(request(path, 'POST', { dpop: 'fresh' }, body), { params: Promise.resolve({ id }) })).status).toBe(200)
    expect(requests).toHaveLength(2)
    for (const extra of [{ value: 'source overwrite' }, { action: 'resume' }, { rebuild: true }, { actorId: 'other' }, { tenantId: 'other' }, { reason: 'x'.repeat(17000) }]) {
        reset()
        expect((await POST(request(path, 'POST', {}, JSON.stringify({ itemIds: ['item'], ...extra })), { params: Promise.resolve({ id }) })).status).toBe(400)
        expect(validations).toHaveLength(0)
        expect(requests).toHaveLength(0)
    }
})

test('static cleanup/reconcile commands preserve existing same-ID item GET/PUT/DELETE', async () => {
    const cleanup = await import('../src/app/api/organizations/[id]/watchlists/cleanup/route')
    const reconcile = await import('../src/app/api/organizations/[id]/watchlists/reconcile/route')
    for (const [name, route] of [['cleanup', cleanup], ['reconcile', reconcile]] as const) {
        const path = `/organizations/org/watchlists/${name}`
        reset(); setUpstreamStatus(200)
        expect((await route.GET(new NextRequest(`https://localhost:3000/api${path}`), { params: Promise.resolve({ id: 'org' }) })).status).toBe(200)
        expect(requests[0].url).toBe(`https://core.invalid/api${path}`)
        expect(requests[0].init?.method).toBe('GET')
        for (const [method, invoke] of [['PUT', route.PUT], ['DELETE', route.DELETE]] as const) {
            reset(); setUpstreamStatus(200)
            expect((await invoke(request(path, method), { params: Promise.resolve({ id: 'org' }) })).status).toBe(200)
            expect(validations).toHaveLength(1)
            expect(requests).toHaveLength(1)
            expect(requests[0].url).toBe(`https://core.invalid/api${path}`)
            expect(requests[0].init?.method).toBe(method)
        }
    }
})
