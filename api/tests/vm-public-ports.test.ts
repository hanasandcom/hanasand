import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const statements: Array<{ sql: string, params: unknown[] }> = []
let vmRoutes: Array<{ vm_name: string, vm_ip: string }> = []
let authorized = true

mock.module('#db', () => ({ default: async (sql: string, params: unknown[] = []) => {
    statements.push({ sql, params })
    if (sql.includes('FROM vms v JOIN vm_details')) return { rows: vmRoutes }
    return { rows: [] }
} }))
mock.module('#utils/vms/access.ts', () => ({
    requireVmAccess: async (_req: unknown, _res: unknown, name: string) => authorized ? { id: 'owner', admin: false, name } : null,
}))
mock.module('#constants', () => ({ default: { vm_host_id: 'inspur', vm_port_route_token: 'sync-token' } }))

const { getInternalVmPublicPorts, getVmPublicPorts } = await import('../src/handlers/vms/publicPorts.ts')
const ensureVmPublicPortsSchema = (await import('../src/utils/db/vmPublicPortsSchema.ts')).default
const { internalTokenRoutes, matchesInternalTokenRoute } = await import('../src/plugins/rateLimitPolicy.ts')
const app = Fastify()
app.get('/vm/:id/public-services', getVmPublicPorts)
app.get('/vms/internal/public-ports', getInternalVmPublicPorts)
afterAll(() => app.close())
beforeEach(() => {
    statements.length = 0
    vmRoutes = [{ vm_name: 'test3', vm_ip: '10.119.85.80' }]
    authorized = true
})

test('VM public-service panel exposes the VM-owned hostname and guest-port alias', async () => {
    const response = await app.inject('/vm/test3/public-services')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
        hostname: 'test3.hanasand.com',
        portAlias: '<port>-test3.hanasand.com',
    })
    expect(response.json().note).toContain('inside the VM')
    expect(statements).toHaveLength(0)
})

test('gateway receives only VM hostnames and private IPs, never service ports', async () => {
    const response = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer sync-token' } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([{ hostname: 'test3.hanasand.com', vmName: 'test3', vmIp: '10.119.85.80' }])
    expect(statements[0].params).toEqual(['inspur', expect.arrayContaining(['mail', 'www', 'name-pending'])])
    expect(statements[0].sql).not.toContain('vm_public_ports')
    expect(statements[0].sql).not.toContain('guest_port')
})

test('gateway route data requires its token through the API proxy', async () => {
    const denied = await app.inject('/vms/internal/public-ports')
    const proxied = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer sync-token', 'x-forwarded-for': '127.0.0.1' } })
    const allowed = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer sync-token' } })
    expect(denied.statusCode).toBe(404)
    expect(proxied.statusCode).toBe(200)
    expect(allowed.json()).toEqual([{ hostname: 'test3.hanasand.com', vmName: 'test3', vmIp: '10.119.85.80' }])
})

test('the existing route token remains recognized by the API rate-limit prehandler', () => {
    const route = internalTokenRoutes.get('GET /api/vms/internal/public-ports')
    expect(route).toBe('service:vm-port-routes')
    expect(matchesInternalTokenRoute({ headers: { authorization: 'Bearer sync-token' } } as never, route!)).toBe(true)
    expect(matchesInternalTokenRoute({ headers: { authorization: 'Bearer wrong-token' } } as never, route!)).toBe(false)
})

test('the legacy public-service table is retained without changing existing records', async () => {
    await ensureVmPublicPortsSchema()
    expect(statements.some(({ sql }) => sql.includes('short_hostname BOOLEAN NOT NULL DEFAULT FALSE'))).toBe(true)
    expect(statements.some(({ sql }) => sql.includes('ADD COLUMN IF NOT EXISTS short_hostname'))).toBe(true)
    expect(statements.every(({ sql }) => !sql.includes('DROP TABLE'))).toBe(true)
})
