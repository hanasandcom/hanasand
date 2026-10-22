import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { hasVmAccess, requireVmAccess } from '#utils/vms/access.ts'
import config from '#constants'
import hasVmPortRouteToken from '#utils/auth/vmPortRouteToken.ts'

const maxPortsPerVm = 1000
const routeTypes = ['minecraft-java', 'tls', 'http'] as const
// Keep one-label hosts owned by the OpenResty site reserved for first-party services.
const reservedHostnames = new Set([
    'api', 'api-browsers', 'browsers', 'cashflow', 'cdn', 'git', 'hanasand', 'idk', 'idk-api',
    'identity', 'internal', 'logs', 'mail', 'name-pending', 'np', 'status', 'support', 'www',
])

function serviceHostname(name: string, shortHostname: boolean) {
    const hostLabel = shortHostname ? name : `port-${name}`
    return `${hostLabel}.hanasand.com`
}

type RouteBody = { name?: unknown, type?: unknown, port?: unknown }

export async function getVmPublicPorts(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const viewer = await requireVmAccess(req, res, id)
    if (!viewer) return
    const result = await run(`SELECT id, name, route_type, guest_port, short_hostname, created_at
        FROM vm_public_ports WHERE vm_name = $1 ORDER BY created_at`, [viewer.name])
    const services = result.rows.map(row => ({
        id: String(row.id), name: row.name, type: row.route_type, port: Number(row.guest_port),
        hostname: serviceHostname(row.name, row.short_hostname === true), createdAt: row.created_at,
    }))
    return res.send({ services, canManage: viewer.admin || await hasVmAccess(viewer.name, viewer.id, true) })
}

export async function postVmPublicPort(req: FastifyRequest<{ Body: RouteBody }>, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const viewer = await requireVmAccess(req, res, id, false, true)
    if (!viewer) return
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().toLowerCase() : ''
    const type = req.body?.type
    const port = req.body?.port
    if (!/^[a-z0-9](?:[a-z0-9-]{0,39}[a-z0-9])?$/.test(name) || !routeTypes.includes(type as typeof routeTypes[number]) || typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
        return res.code(400).send({ error: 'Use a short service name, choose a supported service type, and enter a guest port from 1 to 65535.' })
    }
    if (name.startsWith('port-')) return res.code(400).send({ error: 'Service names cannot start with port-.' })
    const routeType = type as typeof routeTypes[number]
    if (reservedHostnames.has(name)) return res.code(409).send({ error: 'That service name is reserved by Hanasand.' })
    const hostnameCollision = await run('SELECT 1 FROM vms WHERE LOWER(name) = $1 LIMIT 1', [name])
    if (hostnameCollision.rows.length) return res.code(409).send({ error: 'That public address matches an existing VM hostname.' })
    const count = await run('SELECT COUNT(*)::int AS total FROM vm_public_ports WHERE vm_name = $1', [viewer.name])
    if (Number(count.rows[0]?.total) >= maxPortsPerVm) return res.code(409).send({ error: `A VM can have up to ${maxPortsPerVm} public services.` })
    try {
        const result = await run(`INSERT INTO vm_public_ports (vm_name, name, route_type, guest_port, created_by, short_hostname)
            VALUES ($1, $2, $3, $4, $5, TRUE)
            RETURNING id, name, route_type, guest_port, short_hostname, created_at`, [viewer.name, name, routeType, port, viewer.id])
        const row = result.rows[0]
        return res.code(201).send({ id: String(row.id), name: row.name, type: row.route_type, port: Number(row.guest_port), hostname: serviceHostname(row.name, row.short_hostname === true), createdAt: row.created_at })
    } catch (error) {
        if ((error as { code?: string }).code === '23505') return res.code(409).send({ error: 'That service name is already in use.' })
        req.log.error({ err: error }, 'Unable to create VM public service.')
        return res.code(500).send({ error: 'Unable to create the public service.' })
    }
}

export async function deleteVmPublicPort(req: FastifyRequest, res: FastifyReply) {
    const { id, routeId } = req.params as { id: string, routeId: string }
    const viewer = await requireVmAccess(req, res, id, false, true)
    if (!viewer) return
    const result = await run('DELETE FROM vm_public_ports WHERE id = $1 AND vm_name = $2 RETURNING id', [routeId, viewer.name])
    if (!result.rows.length) return res.code(404).send({ error: 'Public service not found.' })
    return res.send({ ok: true })
}

export async function getInternalVmPublicPorts(req: FastifyRequest, res: FastifyReply) {
    if (!hasVmPortRouteToken(req)) return res.code(404).send({ error: 'Not found.' })
    const result = await run(`SELECT p.name, p.route_type, p.guest_port, p.short_hostname, v.name AS vm_name, d.device_eth0_ipv4_address AS vm_ip
        FROM vm_public_ports p JOIN vms v ON v.name = p.vm_name
        JOIN vm_details d ON d.name = v.name
        WHERE v.deleted_at IS NULL AND v.primary_host = $1
        ORDER BY p.created_at`, [config.vm_host_id])
    return res.send(result.rows.map(row => ({
        hostname: serviceHostname(row.name, row.short_hostname === true),
        type: row.route_type,
        vmName: row.vm_name, vmIp: row.vm_ip, port: Number(row.guest_port),
    })))
}
