import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { requireVmAccess } from '#utils/vms/access.ts'
import config from '#constants'
import hasVmPortRouteToken from '#utils/auth/vmPortRouteToken.ts'

// The gateway resolves a VM identity to its private address. Leave first-party
// OpenResty names exclusively in the gateway's static virtual hosts.
const reservedVmHostnames = [
    'api', 'api-browsers', 'browsers', 'cashflow', 'cdn', 'git', 'hanasand', 'idk', 'idk-api',
    'identity', 'internal', 'logs', 'mail', 'name-pending', 'np', 'status', 'support', 'turn', 'www', '67',
]

export async function getVmPublicPorts(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const viewer = await requireVmAccess(req, res, id)
    if (!viewer) return
    const vmName = viewer.name.toLowerCase()
    return res.send({
        hostname: `${vmName}.hanasand.com`,
        portAlias: `<port>-${vmName}.hanasand.com`,
        note: 'Configure listeners and service routing inside the VM. Public traffic arrives through the shared 443 gateway; a numeric hostname prefix selects the guest port.',
    })
}

export async function getInternalVmPublicPorts(req: FastifyRequest, res: FastifyReply) {
    if (!hasVmPortRouteToken(req)) return res.code(404).send({ error: 'Not found.' })
    const result = await run(`SELECT v.name AS vm_name, d.device_eth0_ipv4_address AS vm_ip
        FROM vms v JOIN vm_details d ON d.name = v.name
        WHERE v.deleted_at IS NULL AND v.primary_host = $1
          AND LOWER(v.name) <> ALL($2::text[])
          AND NULLIF(BTRIM(d.device_eth0_ipv4_address), '') IS NOT NULL
        ORDER BY v.name`, [config.vm_host_id, reservedVmHostnames])
    return res.send(result.rows.map(row => {
        const vmName = String(row.vm_name).toLowerCase()
        return { hostname: `${vmName}.hanasand.com`, vmName, vmIp: row.vm_ip }
    }))
}
