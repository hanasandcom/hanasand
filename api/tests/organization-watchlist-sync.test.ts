import { expect, test } from 'bun:test'
import { savedWatchlistProjection, syncWatchlistProjection, WATCHLIST_PROJECTION_RECEIPT } from '../src/utils/organizations/watchlistSync.ts'

const receipt = () => ({ schemaVersion: WATCHLIST_PROJECTION_RECEIPT, organizationId: 'org', itemIds: ['item'], projection: { status: 'synchronized', checkedAt: new Date().toISOString(), source: 'identity', watchlistIds: ['org_shared_watchlist:org:item'], unresolvedItemIds: [] }, alertRebuild: { status: 'not_requested', reason: 'projection_only' } })
const options = (fetchImpl: typeof fetch) => ({ base: 'http://synthetic.invalid', token: 'synthetic-server-key', fetchImpl })
test('saved projection sends only selected scope using service ownership and no rebuild', async () => {
    const calls: unknown[] = []
    const result = await savedWatchlistProjection('org', ['item'], options((async (target, init) => {
        calls.push(target)
        expect(String(target)).toBe('http://synthetic.invalid/v1/internal/organization-watchlists/reconcile')
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body))).toEqual({ organizationId: 'org', itemIds: ['item'] })
        expect(new Headers(init?.headers).get('authorization')).toBeNull()
        expect(new Headers(init?.headers).get('dpop')).toBeNull()
        expect(new Headers(init?.headers).get('x-hanasand-service-token')).toBe('synthetic-server-key')
        return Response.json(receipt())
    }) as typeof fetch))
    expect(result.saved).toBe(true)
    expect(result.dwmAlertBridge.projection.status).toBe('synchronized')
    expect(result.dwmAlertBridge.alertRebuild.status).toBe('not_requested')
    expect('savedAlertCount' in result.dwmAlertBridge).toBe(false)
    expect(calls).toHaveLength(1)
})
test('downstream failure retains saved source and is never retried', async () => {
    for (const status of [401, 409, 503]) {
        let calls = 0
        const result = await savedWatchlistProjection('org', ['item'], options((async () => { calls++; return new Response('', { status }) }) as typeof fetch))
        expect(result.saved).toBe(true)
        expect(result.dwmAlertBridge.projection.status).toBe(status === 503 ? 'pending' : 'failed')
        expect(result.dwmAlertBridge.projection.checkedAt).toBeNull()
        expect(calls).toBe(1)
    }
})
test('a foreign, fabricated rebuild or incomplete receipt is not synchronization', async () => {
    for (const payload of [{ ...receipt(), organizationId: 'other' }, { ...receipt(), alertRebuild: { status: 'completed', savedAlertCount: 0 } }, {}, { ...receipt(), projection: { ...receipt().projection, checkedAt: null } }]) {
        const result = await syncWatchlistProjection('org', ['item'], options((async () => Response.json(payload)) as typeof fetch))
        expect(result.projection.status).toBe('failed')
    }
})
test('empty cleanup is an explicit no-op without claiming a source read', async () => {
    const result = await syncWatchlistProjection('org', [], options((async () => { throw Error('must not fetch') }) as typeof fetch))
    expect(result.projection.status).toBe('unchanged')
    expect(result.projection.checkedAt).toBeNull()
    expect(result.projection.reason).toBe('no_changed_items')
})

test('invalid scope and unavailable configuration never trigger downstream work', async () => {
    for (const [org, ids] of [['bad/org', ['item']], ['org', ['bad/item']], ['org', Array.from({ length: 51 }, (_, i) => `item-${i}`)]] as Array<[string, string[]]>) {
        const result = await syncWatchlistProjection(org, ids, options((async () => { throw Error('must not fetch') }) as typeof fetch))
        expect(result.projection.status).toBe('failed')
    }
    const missing = await savedWatchlistProjection('org', ['item'], { base: '', token: '' })
    expect(missing.saved).toBe(true)
    expect(missing.dwmAlertBridge.projection.status).toBe('pending')
})
test('malformed or foreign item receipts fail without leaking service payloads', async () => {
    for (const response of [new Response('{'), Response.json({ ...receipt(), projection: { ...receipt().projection, watchlistIds: ['org_shared_watchlist:other:item'] } })]) {
        const result = await syncWatchlistProjection('org', ['item'], options((async () => response) as typeof fetch))
        expect(result.projection.status).toBe('failed')
    }
    const result = await syncWatchlistProjection('org', ['item'], options((async () => Response.json({ ...receipt(), privateField: 'must-not-expose' })) as typeof fetch))
    expect(result.projection.status).toBe('synchronized')
    expect(JSON.stringify(result)).not.toContain('must-not-expose')
})

test('partial ownership conflicts retain only requested unresolved IDs', async () => {
    const result = await savedWatchlistProjection('org', ['item'], options((async () => Response.json({ projection: { unresolvedItemIds: ['item', 'foreign', 'item'] }, privateValue: 'must-not-expose' }, { status: 409 })) as typeof fetch))
    expect(result.saved).toBe(true)
    expect(result.dwmAlertBridge.projection.status).toBe('failed')
    expect(result.dwmAlertBridge.projection.unresolvedItemIds).toEqual(['item'])
    expect(JSON.stringify(result)).not.toContain('must-not-expose')
})
test('projection request cancellation reports pending once', async () => {
    let calls = 0
    const fetchImpl = (async (_target, init) => new Promise((_resolve, reject) => {
        calls++
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Synthetic abort', 'AbortError')), { once: true })
    })) as typeof fetch
    const result = await savedWatchlistProjection('org', ['item'], { ...options(fetchImpl), timeoutMs: 5 })
    expect(result.saved).toBe(true)
    expect(result.dwmAlertBridge.projection.status).toBe('pending')
    expect(calls).toBe(1)
})

test('canonical Identity ID grammar permits dots, colon and at-sign without decoding JSON selectors', async () => {
    for (const [organizationId, itemId] of [['org.name', 'item.name'], ['org:colon', 'item:colon'], ['org@domain', 'item@domain'], ['.org', '.item']]) {
        let calls = 0
        const result = await syncWatchlistProjection(organizationId, [itemId], options((async (_url, init) => {
            calls++
            expect(JSON.parse(String(init?.body))).toEqual({ organizationId, itemIds: [itemId] })
            expect(new Headers(init?.headers).get('x-organization-id')).toBe(organizationId)
            return Response.json({ ...receipt(), organizationId, itemIds: [itemId], projection: { ...receipt().projection, watchlistIds: [`org_shared_watchlist:${organizationId}:${itemId}`] } })
        }) as typeof fetch))
        expect(result.projection.status).toBe('synchronized')
        expect(calls).toBe(1)
    }
    for (const bad of ['.', '..', 'bad/item', 'bad\\item', '%2F', '%252F', 'bad\u0000item', 'bad item']) {
        for (const [organizationId, ids] of [[bad, ['item']], ['org', [bad]]] as Array<[string, string[]]>) {
            let calls = 0
            const result = await syncWatchlistProjection(organizationId, ids, options((async () => { calls++; throw Error('must not fetch') }) as typeof fetch))
            expect(result.projection.status).toBe('failed')
            expect(calls).toBe(0)
        }
    }
})
