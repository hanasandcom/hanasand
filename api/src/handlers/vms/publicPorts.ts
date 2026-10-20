import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { hasVmAccess, requireVmAccess } from '#utils/vms/access.ts'
import config from '#constants'
import { timingSafeEqual } from 'node:crypto'

const maxPortsPerVm = 5
const routeTypes = ['minecraft-java', 'tls'] as const

type RouteBody = { name?: unknown, type?: unknown, port?: unknown }

export async function getVmPublicPorts(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const viewer = await requireVmAccess(req, res, id)
    if (!viewer) return
    const result = await run(`SELECT id, name, route_type, guest_port, created_at
        FROM vm_public_ports WHERE vm_name = $1 ORDER BY created_at`, [viewer.name])
    const services = result.rows.map(row => ({
        id: String(row.id), name: row.name, type: row.route_type, port: Number(row.guest_port),
        hostname: `port-${row.name}.hanasand.com`, createdAt: row.created_at,
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
        return res.code(400).send({ error: 'Use a short service name, choose Minecraft Java or TLS, and enter a guest port from 1 to 65535.' })
    }
    const routeType = type as typeof routeTypes[number]
    const hostnameCollision = await run('SELECT 1 FROM vms WHERE LOWER(name) = $1 LIMIT 1', [`port-${name}`])
    if (hostnameCollision.rows.length) return res.code(409).send({ error: 'That public address matches an existing VM hostname.' })
    const count = await run('SELECT COUNT(*)::int AS total FROM vm_public_ports WHERE vm_name = $1', [viewer.name])
    if (Number(count.rows[0]?.total) >= maxPortsPerVm) return res.code(409).send({ error: `A VM can have up to ${maxPortsPerVm} public services.` })
    try {
        const result = await run(`INSERT INTO vm_public_ports (vm_name, name, route_type, guest_port, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, route_type, guest_port, created_at`, [viewer.name, name, routeType, port, viewer.id])
        const row = result.rows[0]
        return res.code(201).send({ id: String(row.id), name: row.name, type: row.route_type, port: Number(row.guest_port), hostname: `port-${row.name}.hanasand.com`, createdAt: row.created_at })
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
    const token = req.headers.authorization?.replace(/^Bearer /, '') || ''
    const expected = config.vm_port_route_token || ''
    if (req.headers['x-forwarded-for'] || !expected || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return res.code(404).send({ error: 'Not found.' })
    const result = await run(`SELECT p.name, p.route_type, p.guest_port, v.name AS vm_name, d.device_eth0_ipv4_address AS vm_ip
        FROM vm_public_ports p JOIN vms v ON v.name = p.vm_name
        JOIN vm_details d ON d.name = v.name
        WHERE v.deleted_at IS NULL AND v.primary_host = $1
        ORDER BY p.created_at`, [config.vm_host_id])
    return res.send(result.rows.map(row => ({
        hostname: `port-${row.name}.hanasand.com`, type: row.route_type,
        vmName: row.vm_name, vmIp: row.vm_ip, port: Number(row.guest_port),
    })))
}
