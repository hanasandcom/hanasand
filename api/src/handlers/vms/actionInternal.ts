import type { FastifyReply, FastifyRequest } from 'fastify'
import config from '#constants'
import run from '#db'
import hasInternalToken from '#utils/auth/internalToken.ts'
import { canUseLocalLxd, setLocalLxdInstanceState } from '#utils/vms/lxd.ts'
import { supportedHost } from '#utils/vms/hostTransport.ts'

type VmAction = 'start' | 'stop' | 'restart'
const allowedActions = new Set<VmAction>(['start', 'stop', 'restart'])

export default async function vmActionInternal(req: FastifyRequest, res: FastifyReply) {
    if (!hasInternalToken(req)) return res.status(401).send({ error: 'Unauthorized.' })

    const { name, action } = req.params as { name: string; action: string }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/.test(name || '') || !allowedActions.has(action as VmAction)) {
        return res.status(400).send({ error: 'Invalid VM action.' })
    }

    const localHost = String(config.vm_host_id).toLowerCase()
    if (!supportedHost(localHost)) return res.status(503).send({ error: 'VM action host is not supported.' })

    try {
        const result = await run(`
            SELECT primary_host
            FROM vms
            WHERE LOWER(name) = LOWER($1)
              AND deleted_at IS NULL
            LIMIT 1
        `, [name])
        const vm = result.rows[0] as { primary_host: string | null } | undefined
        if (!vm) return res.status(404).send({ error: 'Active VM not found.' })
        if (vm.primary_host?.toLowerCase() !== localHost) {
            return res.status(409).send({ error: 'VM is assigned to another host.' })
        }
        if (!await canUseLocalLxd()) return res.status(503).send({ error: 'Local LXD is unavailable.' })

        return res.send(await setLocalLxdInstanceState(name, action as VmAction))
    } catch (error) {
        req.log.error({ err: error, vmName: name, action }, 'Unable to perform VM action on its assigned host.')
        return res.status(503).send({ error: 'Unable to perform VM action on its assigned host.' })
    }
}
