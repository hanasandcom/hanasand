import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'

let authenticated = true
let activeMember = true
let role = 'owner'
let status = 'active'
let privacy = false
let failAudit = false
let upstreamStatus = 200
const queries: Array<{ sql: string, params: unknown[] }> = []
const trace: string[] = []
const calls: Array<{ body: { organizationId: string, itemIds: string[] }, headers: Headers }> = []
const owned = ['active', 'paused', 'archived', 'item.name', 'item:colon', 'item@domain', ...Array.from({ length: 50 }, (_, index) => `bounded-${index}`)]
mock.module('#db', () => {
    const query = async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params })
        if (sql.includes('FROM organizations o')) return { rows: activeMember ? [{ id: params[0], status, role, audit_safe_metadata: privacy ? { privacyDeletionRunId: 'run' } : {} }] : [] }
        if (sql.includes('FROM organization_watchlist_items')) return { rows: (params[1] as string[]).filter(id => owned.includes(id)).map(id => ({ id })) }
        if (sql.includes('INSERT INTO system_events')) {
            trace.push('audit-start')
            await Promise.resolve()
            if (failAudit) throw Error('Synthetic audit unavailable')
            trace.push('audit-complete')
            return { rows: [] }
        }
        throw Error('Unexpected source write or query')
    }
    return { default: query, identityQueryOnce: query, withTransaction: async (work: (query: typeof query) => unknown) => work(query), withDatabaseAdvisoryLock: async (_key: string, work: () => unknown) => work() }
})
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authenticated, id: authenticated ? 'real-user' : undefined }) }))
mock.module('#utils/logs/recordLog.ts', () => ({ default: async () => undefined }))
const { postOrganizationWatchlistReconcile } = await import('../src/handlers/organizations/watchlists/reconcile.ts')
const app = Fastify()
app.post('/organizations/:id/watchlists/reconcile', postOrganizationWatchlistReconcile)
afterAll(() => app.close())
beforeEach(() => {
    authenticated = activeMember = true; role = 'owner'; status = 'active'; privacy = failAudit = false; upstreamStatus = 200
    queries.length = calls.length = trace.length = 0
    process.env.TI_SCRAPER_API_BASE = 'http://synthetic.invalid'
    process.env.TI_SCRAPER_SERVICE_TOKEN = 'synthetic-service'
    globalThis.fetch = (async (_target, init) => {
        trace.push('child')
        const body = JSON.parse(String(init?.body))
        calls.push({ body, headers: new Headers(init?.headers) })
        return Response.json({ schemaVersion: 'organization.watchlist_projection_receipt.v1', ...body,
            projection: { status: 'synchronized', source: 'identity', checkedAt: '2026-10-23T00:00:00Z', watchlistIds: body.itemIds.map((id: string) => `org_shared_watchlist:${body.organizationId}:${id}`), unresolvedItemIds: [] },
            alertRebuild: { status: 'not_requested', reason: 'projection_only' },
        }, { status: upstreamStatus })
    }) as typeof fetch
})
const send = (body: unknown = { itemIds: ['active', 'archived'], requestId: 'human-attempt', reason: 'Retry monitoring only.' }, extra: { url?: string, headers?: Record<string, string> } = {}) => app.inject({ method: 'POST', url: extra.url || '/organizations/org/watchlists/reconcile', payload: body, headers: extra.headers })

test('real actor attempt audit completes before one selected service call with no source mutation/rebuild', async () => {
    const response = await send()
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ organizationId: 'org', itemIds: ['active', 'archived'], dwmAlertBridge: { projection: { status: 'synchronized' }, alertRebuild: { status: 'not_requested' } } })
    expect(response.json().saved).toBeUndefined()
    expect(trace).toEqual(['audit-start', 'audit-complete', 'child'])
    expect(calls).toHaveLength(1)
    expect(calls[0].body).toEqual({ organizationId: 'org', itemIds: ['active', 'archived'] })
    expect(calls[0].headers.get('dpop')).toBeNull()
    expect(calls[0].headers.get('authorization')).toBeNull()
    const audit = queries.find(row => row.sql.includes('INSERT INTO system_events'))!
    expect(audit.params[0]).toBe('watchlist.projection_retry_requested')
    expect(audit.params[4]).toBe('real-user')
    expect(audit.params[9]).toBe('human-attempt')
    expect(JSON.parse(String(audit.params[12]))).toEqual({ itemIds: ['active', 'archived'], actorRole: 'owner', alertRebuild: 'not_requested' })
    expect(queries.filter(row => !row.sql.includes('SELECT') && !row.sql.includes('INSERT INTO system_events'))).toHaveLength(0)
    expect(queries.find(row => row.sql.includes('SELECT id FROM organization_watchlist_items'))?.sql).not.toContain('archived_at IS NULL')
})

test('normal active membership SQL excludes inactive and deletion-scheduled users; absent auth/member cannot dispatch', async () => {
    authenticated = false
    expect((await send()).statusCode).toBe(401)
    expect(queries).toHaveLength(0)
    authenticated = true; activeMember = false
    expect((await send()).statusCode).toBe(404)
    const membership = queries[0].sql
    expect(membership).toContain('om.status = \'active\'')
    expect(membership).toContain('current_member_user.active = TRUE')
    expect(membership).toContain('current_member_user.deletion_scheduled_at IS NULL')
    expect(calls).toHaveLength(0)
})

test('owner/admin/editor can retry; reader/member/viewer/support cannot', async () => {
    for (const nextRole of ['owner', 'admin', 'editor']) { role = nextRole; expect((await send()).statusCode).toBe(200) }
    calls.length = 0
    for (const nextRole of ['reader', 'member', 'viewer', 'support']) { role = nextRole; expect((await send()).statusCode).toBe(403) }
    expect(calls).toHaveLength(0)
})

test('archived/deleted organization or privacy deletion blocks before selection/audit/child', async () => {
    for (const nextStatus of ['archived', 'deleted']) { status = nextStatus; expect((await send()).statusCode).toBe(409) }
    status = 'active'; privacy = true
    expect((await send()).statusCode).toBe(409)
    expect(queries.some(row => row.sql.includes('organization_watchlist_items\n'))).toBe(false)
    expect(trace).toEqual([])
    expect(calls).toHaveLength(0)
})

test('invalid and ambiguous selectors, unknown operation fields and foreign scope never dispatch', async () => {
    for (const body of [{}, { itemIds: [] }, { itemIds: ['active', 'active'] }, { itemIds: Array(51).fill('active') }, { itemIds: ['.'] }, { itemIds: ['bad/item'] }, { itemIds: ['%2F'] }, { itemIds: [123] }, { itemIds: ['active'], item_ids: ['paused'] }, { itemIds: ['active'], actorId: 'other' }, { itemIds: ['active'], rebuild: true }, { itemIds: ['active'], tenantId: 'other' }]) expect((await send(body)).statusCode).toBe(400)
    expect((await send(undefined, { headers: { 'x-organization-id': 'other' } })).statusCode).toBe(400)
    expect((await send(undefined, { url: '/organizations/org/watchlists/reconcile?tenantId=other' })).statusCode).toBe(400)
    expect(trace).toEqual([])
    expect(calls).toHaveLength(0)
})

test('mixed foreign or missing IDs fail as generic same-organization lookup without partial dispatch', async () => {
    for (const itemIds of [['active', 'foreign'], ['missing']]) {
        const response = await send({ itemIds })
        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual({ error: 'Selected watchlist items were not found in this organization.' })
    }
    expect(calls).toHaveLength(0)
    expect(trace).toEqual([])
})

test('historical selector metadata and encoded canonical IDs preserve exact scope', async () => {
    const response = await send({ item_ids: ['item.name', 'item:colon', 'item@domain'], request_id: 'legacy-attempt' }, { url: '/organizations/org.name%3Atenant%40domain/watchlists/reconcile' })
    expect(response.statusCode).toBe(200)
    expect(calls[0].body).toEqual({ organizationId: 'org.name:tenant@domain', itemIds: ['item.name', 'item:colon', 'item@domain'] })
    expect(queries.find(row => row.sql.includes('INSERT INTO system_events'))?.params[9]).toBe('legacy-attempt')
})

test('exactly 50 explicitly selected own items are accepted without expanding selection', async () => {
    const itemIds = Array.from({ length: 50 }, (_, index) => `bounded-${index}`)
    const response = await send({ itemIds })
    expect(response.statusCode).toBe(200)
    expect(calls).toHaveLength(1)
    expect(calls[0].body.itemIds).toEqual(itemIds)
})

test('audit storage failure prevents child; existing source remains untouched', async () => {
    failAudit = true
    expect((await send()).statusCode).toBe(500)
    expect(trace).toEqual(['audit-start'])
    expect(calls).toHaveLength(0)
})

test('pending or failed child is an explicit200 receipt without saved claim or automatic retry', async () => {
    for (const code of [503, 401, 409]) {
        upstreamStatus = code
        const response = await send()
        expect(response.statusCode).toBe(200)
        expect(response.json().saved).toBeUndefined()
        expect(response.json().dwmAlertBridge.projection.status).toBe(code === 503 ? 'pending' : 'failed')
        expect(response.json().dwmAlertBridge.alertRebuild).toEqual({ status: 'not_requested', reason: 'projection_only' })
    }
    expect(calls).toHaveLength(3)
    expect(trace.filter(step => step === 'audit-complete')).toHaveLength(3)
})

test('canonical route registration retains default API-owned authentication policy', () => {
    const routes = readFileSync(new URL('../src/routes/organizationsAndCompute.ts', import.meta.url), 'utf8')
    expect(routes).toContain('fastify.post(\'/organizations/:id/watchlists/reconcile\', postOrganizationWatchlistReconcile)')
})

test('registered handler accepts exact browser/native proxy scope headers and rejects previous default scope', async () => {
    // These are the exact decoded scopes asserted on the real Next proxy output
    // by organization-watchlist-reconcile-proxy.test.ts, for both credential modes.
    const organizationId = 'org.name:tenant@example'
    const url = `/organizations/${encodeURIComponent(organizationId)}/watchlists/reconcile`
    const headers = { 'x-organization-id': organizationId, 'x-tenant-id': organizationId }
    for (const mode of ['browser-cookie', 'native-header']) {
        const response = await send({ itemIds: ['active', 'archived'], requestId: mode }, { url, headers })
        expect(response.statusCode).toBe(200)
        expect(response.json().organizationId).toBe(organizationId)
        expect(calls.at(-1)?.body).toEqual({ organizationId, itemIds: ['active', 'archived'] })
    }
    expect(calls).toHaveLength(2)
    expect((await send({ itemIds: ['active'] }, { url, headers: { ...headers, 'x-tenant-id': 'default' } })).statusCode).toBe(400)
    expect(calls).toHaveLength(2)
})
