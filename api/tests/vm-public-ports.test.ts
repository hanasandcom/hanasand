import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const serviceFixture = (await Bun.file(new URL('./fixtures/vm-public-service-route.tsv', import.meta.url)).text()).trim().split('|')
const [fixtureName, fixtureHostname, fixtureType, fixtureVmName, fixtureVmIp, fixturePortText] = serviceFixture
const fixturePort = Number(fixturePortText)
const statements: Array<{ sql: string, params: unknown[] }> = []
const services: Array<Record<string, unknown>> = []
const vmRoutes = [{ vm_name: 'hei', vm_ip: '10.119.85.22' }]
let authorized = true
let hostnameTaken = false
let canManage = true

const execute = async (sql: string, params: unknown[] = []) => {
    statements.push({ sql, params })
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] }
    if (sql.includes('COUNT(*)')) return { rows: [{ total: services.length }] }
    if (sql.includes('FROM generate_series')) {
        const [first, last, count] = params as [number, number, number]
        for (let candidate = first; candidate <= last - count + 1; candidate += 1) {
            if (!services.some(row => typeof row.public_port === 'number' && row.public_port >= candidate && row.public_port < candidate + count)) {
                return { rows: [{ public_port: candidate }] }
            }
        }
        return { rows: [] }
    }
    if (sql.startsWith('SELECT 1 FROM vms')) return { rows: hostnameTaken ? [{}] : [] }
    if (sql.includes('FROM vms v JOIN vm_details')) return { rows: vmRoutes }
    if (sql.includes('INSERT INTO vm_public_ports')) {
        const [vmName, name, routeType, guestPort, publicPort, createdBy] = params as [string, string, string, number, number | null, string]
        const row = { id: services.length + 1, name, route_type: routeType, guest_port: guestPort, public_port: publicPort, created_at: '2026-10-20T00:00:00Z', vm_name: vmName, created_by: createdBy }
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
}
mock.module('#db', () => ({ default: execute, withTransaction: (work: (query: typeof execute) => Promise<unknown>) => work(execute) }))
mock.module('#utils/vms/access.ts', () => ({
    requireVmAccess: async (_req: unknown, res: { code: (status: number) => { send: (body: unknown) => void } }, name: string) => {
        if (!authorized) { res.code(403).send({ error: 'Forbidden.' }); return null }
        return { id: 'owner', admin: false, name }
    },
    hasVmAccess: async () => canManage,
}))
mock.module('#constants', () => ({ default: { vm_host_id: 'inspur', vm_port_route_token: 'sync-token', vm_api_token: 'host-token' } }))

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
    expect(created.json()).toMatchObject({ hostname: 'survival.hanasand.com', port: 25565, type: 'minecraft-java' })
    const listed = await app.inject('/vm/hei/public-services')
    expect(listed.json()).toMatchObject({ canManage: true, services: [{ hostname: 'survival.hanasand.com' }] })
    expect(listed.json().portAlias).toBe('<port>-hei.hanasand.com')
    const removed = await app.inject({ method: 'DELETE', url: '/vm/hei/public-services/1' })
    expect(removed.statusCode).toBe(200)
    expect(services).toHaveLength(0)
})

test('VM managers can publish an HTTP website through the HTTPS gateway', async () => {
    const created = await app.inject({ method: 'POST', url: `/vm/${fixtureVmName}/public-services`, payload: { name: fixtureName, type: fixtureType, port: fixturePort } })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ hostname: fixtureHostname, port: fixturePort, type: fixtureType })

    const synced = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer sync-token' } })
    expect(synced.json()).toContainEqual({ name: fixtureName, hostname: fixtureHostname, type: fixtureType, vmName: fixtureVmName, vmIp: fixtureVmIp, port: fixturePort })
})

test('public services reject unsafe names, unsupported protocols, invalid ports and hostname conflicts', async () => {
    const malformed = [
        { name: 'unsafe.example', type: 'tls', port: 443 },
        { name: 'web', type: 'ftp', port: 53 },
        { name: 'web', type: 'tls', port: 65536 },
    ]
    for (const payload of malformed) expect((await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload })).statusCode).toBe(400)
    hostnameTaken = true
    expect((await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'hei', type: 'tls', port: 443 } })).statusCode).toBe(409)
    hostnameTaken = false
    expect((await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'www', type: 'tls', port: 443 } })).json().error).toContain('reserved')
    expect((await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'cobbleverse', type: 'minecraft-java', port: 25565 } })).json().error).toContain('reserved')
    expect((await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: '25565-hei', type: 'tls', port: 443 } })).json().error).toContain('legacy VM port')
    expect(services).toHaveLength(0)
})

test('generic TCP and UDP services receive unique public ports in the host range', async () => {
    const udp = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'cs-game', type: 'udp', port: 27015 } })
    const tcp = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'terraria-game', type: 'tcp', port: 7777 } })
    expect(udp.statusCode).toBe(201)
    expect(tcp.statusCode).toBe(201)
    expect(udp.json()).toMatchObject({ type: 'udp', port: 27015, publicPort: 32000 })
    expect(tcp.json()).toMatchObject({ type: 'tcp', port: 7777, publicPort: 32001 })
    const listed = await app.inject('/vm/hei/public-services')
    expect(listed.json().services.map((service: { publicPort: number }) => service.publicPort)).toEqual([32000, 32001])
    const synced = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer sync-token' } })
    expect(synced.json()).toContainEqual({ name: 'cs-game', hostname: 'cs-game.hanasand.com', type: 'udp', vmName: 'hei', vmIp: '10.119.85.22', port: 27015, publicPort: 32000 })
    expect(statements.some(({ sql, params }) => sql.includes('pg_advisory_xact_lock') && params[0] === 'vm-public-ports:global')).toBe(true)
})

test('a game port group allocates adjacent public ports atomically in catalog order', async () => {
    const valheim = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'viking', game: 'game-valheim' } })
    expect(valheim.statusCode).toBe(201)
    expect(valheim.json().services).toMatchObject([
        { name: 'viking', hostname: 'viking.hanasand.com', type: 'udp', port: 2456, publicPort: 32000 },
        { name: 'viking-2', hostname: 'viking-2.hanasand.com', type: 'udp', port: 2457, publicPort: 32001 },
    ])
    const cs2 = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'counter', game: 'game-cs2' } })
    expect(cs2.statusCode).toBe(201)
    expect(cs2.json().services).toMatchObject([
        { name: 'counter', type: 'udp', port: 27015, publicPort: 32002 },
        { name: 'counter-2', type: 'tcp', port: 27015, publicPort: 32003 },
    ])
    expect(services).toHaveLength(4)
    const malformed = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'other', game: 'game-unknown' } })
    expect(malformed.statusCode).toBe(400)
})

test('game port groups require VM access and do not partly allocate at the per-VM limit', async () => {
    authorized = false
    const denied = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'private', game: 'game-valheim' } })
    expect(denied.statusCode).toBe(403)
    expect(statements).toHaveLength(0)

    authorized = true
    for (let index = 0; index < 999; index += 1) services.push({ id: index + 1, name: `occupied-${index}`, route_type: 'tls', guest_port: 443, public_port: null, vm_name: 'hei' })
    const atLimit = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'viking', game: 'game-valheim' } })
    expect(atLimit.statusCode).toBe(409)
    expect(services).toHaveLength(999)
    expect(statements.some(({ sql }) => sql.includes('INSERT INTO vm_public_ports'))).toBe(false)
})

test('a VM can add 1,000 public service mappings but not a 1,001st', async () => {
    for (let index = 0; index < 1000; index++) {
        const response = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: `port-${index}`, type: 'tls', port: 443 } })
        expect(response.statusCode).toBe(201)
    }
    const overLimit = await app.inject({ method: 'POST', url: '/vm/hei/public-services', payload: { name: 'one-too-many', type: 'tls', port: 443 } })
    expect(overLimit.statusCode).toBe(409)
    expect(overLimit.json().error).toContain('1000')
    expect(services).toHaveLength(1000)
}, 30_000)

test('gateway route data requires its token through the API proxy', async () => {
    services.push({ id: 1, name: fixtureName, route_type: fixtureType, guest_port: fixturePort, created_at: '2026-10-20T00:00:00Z', vm_name: fixtureVmName })
    const denied = await app.inject('/vms/internal/public-ports')
    const proxied = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer sync-token', 'x-forwarded-for': '127.0.0.1' } })
    const allowed = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer sync-token' } })
    const hostAllowed = await app.inject({ url: '/vms/internal/public-ports', headers: { authorization: 'Bearer host-token' } })
    expect(denied.statusCode).toBe(404)
    expect(proxied.statusCode).toBe(200)
    expect(allowed.statusCode).toBe(200)
    expect(hostAllowed.statusCode).toBe(200)
    expect(allowed.json()).toContainEqual({ hostname: 'hei.hanasand.com', vmName: 'hei', vmIp: '10.119.85.22' })
    expect(allowed.json()).toContainEqual({ name: fixtureName, hostname: fixtureHostname, type: fixtureType, vmName: fixtureVmName, vmIp: fixtureVmIp, port: fixturePort })
    expect(statements.some(({ sql }) => sql.includes('guest_port'))).toBe(true)
})

test('route sync token is recognized by the global API rate-limit prehandler', () => {
    const route = internalTokenRoutes.get('GET /api/vms/internal/public-ports')
    expect(route).toBe('service:vm-port-routes')
    expect(matchesInternalTokenRoute({ headers: { authorization: 'Bearer sync-token' } } as never, route!)).toBe(true)
    expect(matchesInternalTokenRoute({ headers: { authorization: 'Bearer wrong-token' } } as never, route!)).toBe(false)
    expect(matchesInternalTokenRoute({ headers: { authorization: 'Bearer host-token' } } as never, route!)).toBe(true)
})
