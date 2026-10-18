import config from '#constants'
import { refreshLocalLxdDetails } from '#utils/vms/lxd.ts'
import { withLiveVmStatus } from '#utils/vms/status.ts'
import { requireVmAccess } from '#utils/vms/access.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

export default async function getVMDetails(req: FastifyRequest, res: FastifyReply) {
    const { name } = req.params as { name: string }
    const viewer = await requireVmAccess(req, res, name)
    if (!viewer) return

    const refresh = (req.query as { refresh?: string }).refresh === '1'
    res.header('Cache-Control', 'no-store')
    try {
        if (refresh) {
            const host = await run('SELECT primary_host FROM vms WHERE name = $1', [viewer.name])
            if (host.rows[0]?.primary_host !== config.vm_host_id) {
                return res.status(503).send({ error: 'This VM’s host is unavailable for refresh. The previous details are still shown.' })
            }
            await refreshLocalLxdDetails(viewer.name, true)
        }
        const result = await run(`
            SELECT details.*, vm.primary_host
            FROM vm_details details
            JOIN vms vm ON LOWER(vm.name) = LOWER(details.name)
            WHERE LOWER(details.name) = LOWER($1)
            LIMIT 1
        `, [viewer.name])
        if (result.rows.length === 0) {
            return res.status(200).send([])
        }

        return res.send(await withLiveVmStatus(result.rows[0]))
    } catch (error) {
        console.log(error)
        return res.status(refresh ? 503 : 500).send({ error: refresh ? 'Unable to refresh details from the VM host. The previous details are still shown. Please try again.' : 'Internal server error' })
    }
}
