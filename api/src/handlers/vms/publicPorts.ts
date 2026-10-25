import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import { hasVmAccess, requireVmAccess } from '#utils/vms/access.ts'
import config from '#constants'
import hasVmPortRouteToken from '#utils/auth/vmPortRouteToken.ts'

const maxPortsPerVm = 1000
const routeTypes = ['minecraft-java', 'tls', 'http'] as const
const reservedServiceHostnames = ['api', 'api-browsers', 'browsers', 'cashflow', 'cdn', 'cobbleverse', 'git', 'hanasand', 'idk', 'idk-api', 'identity', 'internal', 'logs', 'mail', 'name-pending', 'np', 'status', 'support', 'turn', 'www', '67']

type RouteBody = { name?: unknown, type?: unknown, port?: unknown }

export async function getVmPublicPorts(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const viewer = await requireVmAccess(req, res, id)
    if (!viewer) return
    const result = await run(`SELECT id, name, route_type, guest_port, created_at,
            (LOWER(name) = ANY($2::text[]) OR name ~ '^[0-9]+-[a-z0-9-]+$'
             OR EXISTS (SELECT 1 FROM vms WHERE LOWER(vms.name) = LOWER(vm_public_ports.name))) AS hostname_unavailable
        FROM vm_public_ports WHERE vm_name = $1 ORDER BY created_at`, [viewer.name, reservedServiceHostnames])
    const services = result.rows.map(row => ({
        id: String(row.id), name: row.name, type: row.route_type, port: Number(row.guest_port),
        hostname: row.hostname_unavailable ? null : `${row.name}.hanasand.com`, hostnameUnavailable: Boolean(row.hostname_unavailable), createdAt: row.created_at,
    }))
    const vmName = viewer.name.toLowerCase()
    return res.send({ services, canManage: viewer.admin || await hasVmAccess(viewer.name, viewer.id, true),
        hostname: `${vmName}.hanasand.com`, portAlias: `<port>-${vmName}.hanasand.com` })
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
    const routeType = type as typeof routeTypes[number]
    if (reservedServiceHostnames.includes(name)) return res.code(409).send({ error: 'That hostname is reserved for a Hanasand service.' })
    if (/^\d+-[a-z0-9-]+$/.test(name)) return res.code(409).send({ error: 'That hostname conflicts with a legacy VM port address.' })
    const hostnameCollision = await run('SELECT 1 FROM vms WHERE LOWER(name) = $1 LIMIT 1', [name])
    if (hostnameCollision.rows.length) return res.code(409).send({ error: 'That hostname matches an existing VM.' })
    try {
        const result = await withTransaction(async query => {
            // Serialize additions per VM so concurrent requests cannot exceed the cap.
            await query('SELECT pg_advisory_xact_lock(hashtext($1))', [`vm-public-ports:${viewer.name}`])
            const count = await query('SELECT COUNT(*)::int AS total FROM vm_public_ports WHERE vm_name = $1', [viewer.name])
            if (Number(count.rows[0]?.total) >= maxPortsPerVm) return { atLimit: true, rows: [] }
            return query(`INSERT INTO vm_public_ports (vm_name, name, route_type, guest_port, created_by)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, name, route_type, guest_port, created_at`, [viewer.name, name, routeType, port, viewer.id])
        })
        if ('atLimit' in result && result.atLimit) return res.code(409).send({ error: `A VM can have up to ${maxPortsPerVm} public services.` })
        const row = result.rows[0]
        return res.code(201).send({ id: String(row.id), name: row.name, type: row.route_type, port: Number(row.guest_port), hostname: `${row.name}.hanasand.com`, createdAt: row.created_at })
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
    const vmResult = await run(`SELECT v.name AS vm_name, d.device_eth0_ipv4_address AS vm_ip
        FROM vms v JOIN vm_details d ON d.name = v.name
        WHERE v.deleted_at IS NULL AND v.primary_host = $1
          AND LOWER(v.name) <> ALL($2::text[])
          AND NULLIF(BTRIM(d.device_eth0_ipv4_address), '') IS NOT NULL
        ORDER BY v.name`, [config.vm_host_id, reservedServiceHostnames])
    const servicesResult = await run(`SELECT p.name, p.route_type, p.guest_port, v.name AS vm_name, d.device_eth0_ipv4_address AS vm_ip
        FROM vm_public_ports p JOIN vms v ON v.name = p.vm_name
        JOIN vm_details d ON d.name = v.name
        WHERE v.deleted_at IS NULL AND v.primary_host = $1
          AND NULLIF(BTRIM(d.device_eth0_ipv4_address), '') IS NOT NULL
          AND LOWER(p.name) <> ALL($2::text[])
          AND p.name !~ '^[0-9]+-[a-z0-9-]+$'
          AND NOT EXISTS (SELECT 1 FROM vms named_vm WHERE LOWER(named_vm.name) = LOWER(p.name))
        ORDER BY p.created_at`, [config.vm_host_id, reservedServiceHostnames])
    const vmRoutes = vmResult.rows.map(row => {
        const vmName = String(row.vm_name).toLowerCase()
        return { hostname: `${vmName}.hanasand.com`, vmName, vmIp: row.vm_ip }
    })
    const serviceRoutes = servicesResult.rows.map(row => ({
        name: row.name, hostname: `${row.name}.hanasand.com`, type: row.route_type,
        vmName: row.vm_name, vmIp: row.vm_ip, port: Number(row.guest_port),
    }))
    return res.send([...vmRoutes, ...serviceRoutes])
}
