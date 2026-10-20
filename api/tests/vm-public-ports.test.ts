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
        const row = { id: services.length + 1, name, route_type: routeType, guest_port: guestPort, created_at: '2026-10-20T00:00:00Z', vm_name: vmName, created_by: createdBy }
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
    throw new Error(`Unexpected query: ${sql}`)
} }))
mock.module('#utils/vms/access.ts', () => ({
    requireVmAccess: async (_req: unknown, _res: unknown, name: string) => authorized ? { id: 'owner', admin: false, name } : null,
    hasVmAccess: async () => canManage,
}))
mock.module('#constants', () => ({ default: { vm_host_id: 'inspur', vm_port_route_token: 'sync-token' } }))

const { deleteVmPublicPort, getInternalVmPublicPorts, getVmPublicPorts, postVmPublicPort } = await import('../src/handlers/vms/publicPorts.ts')
const { internalTokenRoutes, matchesInternalTokenRoute } = await import('../src/plugins/rateLimitPolicy.ts')
const app = Fastify()
app.get('/vm/:id/public-services', getVmPublicPorts)
app.post('/vm/:id/public-services', postVmPublicPort)
app.delete('/vm/:id/public-services/:routeId', deleteVmPublicPort)
app.get('/vms/internal/public-ports', getInternalVmPublicPorts)
afterAll(() => app.close())
beforeEach(() => { services.length = 0; statements.length = 0; authorized = true; hostnameTaken = false; canManage = true })

test('VM managers can add, list and remove a Minecraft service by hostname', async () => {
    const created = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'survival', type: 'minecraft-java', port: 25565 } })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ hostname: 'port-survival.hanasand.com', port: 25565, type: 'minecraft-java' })
    const listed = await app.inject('/vm/hei/public-services')
    expect(listed.json()).toMatchObject({ canManage: true, services: [{ hostname: 'port-survival.hanasand.com' }] })
    const removed = await app.inject({ method: 'DELETE', url: '/vm/hei/public-services/1' })
    expect(removed.statusCode).toBe(200)
    expect(services).toHaveLength(0)
})

test('public services reject unsafe names, unsupported protocols, invalid ports and hostname conflicts', async () => {
    const malformed = [
        { name: 'unsafe.example', type: 'tls', port: 443 },
        { name: 'web', type: 'udp', port: 53 },
        { name: 'web', type: 'tls', port: 65536 },
    ]
    for (const payload of malformed) expect((await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload })).statusCode).toBe(400)
    hostnameTaken = true
    expect((await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'hei', type: 'tls', port: 443 } })).statusCode).toBe(409)
    expect(services).toHaveLength(0)
})

test('gateway route data requires its token through the API proxy', async () => {
    services.push({ id: 1, name: 'web', route_type: 'tls', guest_port: 443, created_at: '2026-10-20T00:00:00Z', vm_name: 'hei' })
    const denied = await app.inject('/vms/internal/public-ports')
    const proxied = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer sync-token', 'x-forwarded-for': '127.0.0.1' } })
    const allowed = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer sync-token' } })
    expect(denied.statusCode).toBe(404)
    expect(proxied.statusCode).toBe(200)
    expect(allowed.statusCode).toBe(200)
    expect(allowed.json()).toEqual([{ hostname: 'port-web.hanasand.com', type: 'tls', vmName: 'hei', vmIp: '10.119.85.22', port: 443 }])
})

test('route sync token is recognized by the global API rate-limit prehandler', () => {
    const route = internalTokenRoutes.get('GET /api/vms/internal/public-ports')
    expect(route).toBe('service:vm-port-routes')
    expect(matchesInternalTokenRoute({ headers: { authorization: 'Bearer sync-token' } } as never, route!)).toBe(true)
    expect(matchesInternalTokenRoute({ headers: { authorization: 'Bearer wrong-token' } } as never, route!)).toBe(false)
})
