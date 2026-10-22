import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const statements: Array<{ sql: string, params: unknown[] }> = []
const services: Array<Record<string, unknown>> = []
let authorized = true
let hostnameTaken = false
let canManage = true

mock.module('#db', () => ({ default: async (sql: string, params: unknown[] = []) => {
    statements.push({ sql, params })
    if (sql.includes('COUNT(*)')) return { rows: [{ total: services.length }] }
    if (sql.startsWith('SELECT 1 FROM vms')) return { rows: hostnameTaken ? [{}] : [] }
    if (sql.includes('INSERT INTO vm_public_ports')) {
        const [vmName, name, routeType, guestPort, createdBy] = params as [string, string, string, number, string]
        const row = { id: services.length + 1, name, route_type: routeType, guest_port: guestPort, short_hostname: true, created_at: '2026-10-20T00:00:00Z', vm_name: vmName, created_by: createdBy }
        services.push(row)
        return { rows: [row] }
    }
    if (sql.startsWith('DELETE FROM vm_public_ports')) {
        const index = services.findIndex(row => String(row.id) === params[0] && row.vm_name === params[1])
        if (index < 0) return { rows: [] }
        return { rows: services.splice(index, 1).map(row => ({ id: row.id })) }
    }
    if (sql.includes('FROM vm_public_ports WHERE vm_name')) return { rows: services }
    if (sql.includes('FROM vm_public_ports p JOIN vms')) return { rows: services.map(row => ({ ...row, vm_ip: '10.119.85.22' })) }
    return { rows: [] }
} }))
mock.module('#utils/vms/access.ts', () => ({
    requireVmAccess: async (_req: unknown, _res: unknown, name: string) => authorized ? { id: 'owner', admin: false, name } : null,
    hasVmAccess: async () => canManage,
}))
mock.module('#constants', () => ({ default: { vm_host_id: 'inspur', vm_port_route_token: 'sync-token' } }))

const { deleteVmPublicPort, getInternalVmPublicPorts, getVmPublicPorts, postVmPublicPort } = await import('../src/handlers/vms/publicPorts.ts')
const ensureVmPublicPortsSchema = (await import('../src/utils/db/vmPublicPortsSchema.ts')).default
const { internalTokenRoutes, matchesInternalTokenRoute } = await import('../src/plugins/rateLimitPolicy.ts')
const app = Fastify()
app.get('/vm/:id/public-services', getVmPublicPorts)
app.post('/vm/:id/public-services', postVmPublicPort)
app.delete('/vm/:id/public-services/:routeId', deleteVmPublicPort)
app.get('/vms/internal/public-ports', getInternalVmPublicPorts)
afterAll(() => app.close())
beforeEach(() => { services.length = 0; statements.length = 0; authorized = true; hostnameTaken = false; canManage = true })

test('VM managers can add, list and remove a Minecraft service by its short hostname', async () => {
    const created = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'survival', type: 'minecraft-java', port: 25565 } })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ hostname: 'survival.hanasand.com', port: 25565, type: 'minecraft-java' })
    const listed = await app.inject('/vm/hei/public-services')
    expect(listed.json()).toMatchObject({ canManage: true, services: [{ hostname: 'survival.hanasand.com' }] })
    const removed = await app.inject({ method: 'DELETE', url: '/vm/hei/public-services/1' })
    expect(removed.statusCode).toBe(200)
    expect(services).toHaveLength(0)
})

test('VM managers can publish an HTTP website through the HTTPS gateway', async () => {
    const created = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'site', type: 'http', port: 80 } })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ hostname: 'site.hanasand.com', port: 80, type: 'http' })

    const synced = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer sync-token' } })
    expect(synced.json()).toContainEqual({ hostname: 'site.hanasand.com', type: 'http', vmName: 'hei', vmIp: '10.119.85.22', port: 80 })
})

test('public services reject unsafe names, unsupported protocols, invalid ports and hostname conflicts', async () => {
    const malformed = [
        { name: 'unsafe.example', type: 'tls', port: 443 },
        { name: 'web', type: 'udp', port: 53 },
        { name: 'web', type: 'tls', port: 65536 },
        { name: 'port-web', type: 'tls', port: 443 },
    ]
    for (const payload of malformed) expect((await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload })).statusCode).toBe(400)
    hostnameTaken = true
    expect((await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'hei', type: 'tls', port: 443 } })).statusCode).toBe(409)
    hostnameTaken = false
    expect((await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'mail', type: 'tls', port: 443 } })).statusCode).toBe(409)
    expect((await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'api', type: 'tls', port: 443 } })).statusCode).toBe(409)
    expect(services).toHaveLength(0)
})

test('a VM can add 1,000 public service mappings but not a 1,001st', async () => {
    for (let index = 0; index < 1000; index++) {
        const response = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: `service-${index}`, type: 'tls', port: 443 } })
        expect(response.statusCode).toBe(201)
    }
    const overLimit = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'one-too-many', type: 'tls', port: 443 } })
    expect(overLimit.statusCode).toBe(409)
    expect(overLimit.json().error).toContain('1000')
    expect(services).toHaveLength(1000)
})

test('gateway route data requires its token through the API proxy', async () => {
    services.push({ id: 1, name: 'web', route_type: 'tls', guest_port: 443, short_hostname: true, created_at: '2026-10-20T00:00:00Z', vm_name: 'hei' })
    const denied = await app.inject('/vms/internal/public-ports')
    const proxied = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer sync-token', 'x-forwarded-for': '127.0.0.1' } })
    const allowed = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer sync-token' } })
    expect(denied.statusCode).toBe(404)
    expect(proxied.statusCode).toBe(200)
    expect(allowed.statusCode).toBe(200)
    expect(allowed.json()).toEqual([{ hostname: 'web.hanasand.com', type: 'tls', vmName: 'hei', vmIp: '10.119.85.22', port: 443 }])
})

test('existing services named after a Hanasand subdomain keep their safe legacy address', async () => {
    services.push({ id: 1, name: 'mail', route_type: 'tls', guest_port: 443, short_hostname: false, created_at: '2026-10-20T00:00:00Z', vm_name: 'hei' })
    const listed = await app.inject('/vm/hei/public-services')
    expect(listed.json().services).toMatchObject([{ hostname: 'port-mail.hanasand.com' }])
    const synced = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer sync-token' } })
    expect(synced.json()).toEqual([{ hostname: 'port-mail.hanasand.com', type: 'tls', vmName: 'hei', vmIp: '10.119.85.22', port: 443 }])
})

test('the public-service schema keeps existing hostnames and marks new short hostnames explicitly', async () => {
    await ensureVmPublicPortsSchema()
    expect(statements.some(({ sql }) => sql.includes('short_hostname BOOLEAN NOT NULL DEFAULT FALSE'))).toBe(true)
    expect(statements.some(({ sql }) => sql.includes('ADD COLUMN IF NOT EXISTS short_hostname'))).toBe(true)
})

test('route sync token is recognized by the global API rate-limit prehandler', () => {
    const route = internalTokenRoutes.get('GET /api/vms/internal/public-ports')
    expect(route).toBe('service:vm-port-routes')
    expect(matchesInternalTokenRoute({ headers: { authorization: 'Bearer sync-token' } } as never, route!)).toBe(true)
    expect(matchesInternalTokenRoute({ headers: { authorization: 'Bearer wrong-token' } } as never, route!)).toBe(false)
})
