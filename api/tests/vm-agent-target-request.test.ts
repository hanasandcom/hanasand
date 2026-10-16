import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const vm = {
    name: 'private-vm',
    owner: 'owner',
    created_by: 'owner',
    organization_id: null,
    access_users: ['member'],
    device_eth0_ipv4_address: '192.0.2.10',
}
const queries: Array<{ sql: string, params?: unknown[] }> = []
const fetchCalls: Array<{ url: string, init?: RequestInit }> = []
let hasManageAccess = false
const previousFetch = globalThis.fetch

mock.module('../src/utils/auth/tokenWrapper.ts', () => ({
    default: async (req: any) => ({ valid: Boolean(req.headers.id), id: req.headers.id }),
}))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({
    default: async (req: any) => ({ valid: req.headers.id === 'admin' }),
}))
mock.module('../src/utils/db.ts', () => ({
    default: async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params })
        if (sql.includes('SELECT vm_user_can_manage($1, $2) AS allowed')) return { rows: [{ allowed: hasManageAccess }] }
        if (sql.includes('SELECT vm_user_has_access($1, $2) AS allowed')) return { rows: [{ allowed: true }] }
        return { rows: sql.includes('WHERE v.name = $1') ? [vm] : [] }
    },
}))
mock.module('../src/constants.ts', () => ({
    default: { internal_api: 'http://internal.test/api', vm_api_token: 'test-token' },
}))

globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    fetchCalls.push({ url: String(input), init })
    return new Response(JSON.stringify({ ok: true, status: 200, body: 'VM response' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}) as typeof fetch

const { default: postAgentTargetRequest } = await import('../src/handlers/vms/postAgentTargetRequest.ts')
const app = Fastify()
app.post('/vm/:id/request', postAgentTargetRequest)

beforeEach(() => {
    queries.length = 0
    fetchCalls.length = 0
    hasManageAccess = false
})
afterAll(async () => {
    globalThis.fetch = previousFetch
    await app.close()
})

test('VM request proxy requires manage access even when the caller can read the target', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/vm/private-vm/request',
        headers: { id: 'member' },
        payload: { url: 'http://127.0.0.1:8080/health' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Forbidden.' })
    expect(queries.filter(query => query.sql.includes('SELECT vm_user_can_manage($1, $2) AS allowed'))).toEqual([{
        sql: 'SELECT vm_user_can_manage($1, $2) AS allowed',
        params: ['private-vm', 'member'],
    }])
    expect(queries.some(query => query.sql.includes('INSERT INTO ai_agent_action_audit'))).toBe(false)
    expect(fetchCalls).toHaveLength(0)
})

test('VM request proxy forwards an allowed GET only to the VM-local API', async () => {
    hasManageAccess = true
    const response = await app.inject({
        method: 'POST',
        url: '/vm/private-vm/request',
        headers: { id: 'owner' },
        payload: {
            url: 'http://192.0.2.10:8080/health',
            headers: { 'Content-Type': ' application/json ', ignored: 42 },
        },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
        vmName: 'private-vm',
        trustBoundary: 'vm_local_http',
        allowedHosts: ['localhost', '127.0.0.1', '::1', '192.0.2.10'],
        ok: true,
        body: 'VM response',
    })
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0]?.url).toBe('http://internal.test/api/vm/private-vm/request')
    expect(JSON.parse(String(fetchCalls[0]?.init?.body))).toMatchObject({
        method: 'GET',
        url: 'http://192.0.2.10:8080/health',
        headers: { 'Content-Type': 'application/json' },
    })
    expect(queries.some(query => query.sql.includes('INSERT INTO ai_agent_action_audit'))).toBe(true)
})

test('VM request proxy rejects external hosts and unapproved writes before forwarding', async () => {
    hasManageAccess = true
    const external = await app.inject({
        method: 'POST',
        url: '/vm/private-vm/request',
        headers: { id: 'owner' },
        payload: { url: 'https://example.com/' },
    })
    expect(external.statusCode).toBe(400)
    expect(fetchCalls).toHaveLength(0)

    const write = await app.inject({
        method: 'POST',
        url: '/vm/private-vm/request',
        headers: { id: 'owner' },
        payload: { method: 'POST', url: 'http://localhost/admin', body: '{}' },
    })
    expect(write.statusCode).toBe(409)
    expect(write.json().decision.status).toBe('checkpoint_required')
    expect(fetchCalls).toHaveLength(0)
})
