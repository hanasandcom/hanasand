import type { FastifyReply, FastifyRequest } from 'fastify'
import config from '#constants'
import run from '#db'
import hasInternalToken from '#utils/auth/internalToken.ts'
import { canUseLocalLxd, getLocalLxdInstance, setLocalLxdInstanceState } from '#utils/vms/lxd.ts'
import { supportedHost } from '#utils/vms/hostTransport.ts'

export default async function actionInternalVm(req: FastifyRequest, res: FastifyReply) {
    if (!hasInternalToken(req)) return res.status(401).send({ error: 'Unauthorized.' })
    const { name, action } = req.params as { name: string, action: string }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/.test(name || '') || !['start', 'stop', 'restart'].includes(action)) {
        return res.status(400).send({ error: 'Invalid VM action.' })
    }

    const host = String(config.vm_host_id).toLowerCase()
    if (!supportedHost(host)) return res.status(503).send({ error: 'VM host is not supported.' })
    try {
        const result = await run('SELECT primary_host FROM vms WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL LIMIT 1', [name])
        const vm = result.rows[0] as { primary_host: string | null } | undefined
        if (!vm) return res.status(404).send({ error: 'Active VM not found.' })
        if (vm.primary_host?.toLowerCase() !== host) return res.status(409).send({ error: 'VM is assigned to another host.' })
        if (!await canUseLocalLxd()) return res.status(503).send({ error: 'Local LXD is unavailable.' })

        try {
            await getLocalLxdInstance(name)
        } catch (error) {
            if (error instanceof Error && /not found/i.test(error.message)) {
                return res.status(404).send({ error: 'The VM instance is missing from its assigned host. Its disk cannot be started here.' })
            }
            throw error
        }
        const details = await setLocalLxdInstanceState(name, action as 'start' | 'stop' | 'restart', { tolerateAlready: true })
        return res.send({ ok: true, name, status: details.status, message: `${action === 'start' ? 'Started' : action === 'stop' ? 'Stopped' : 'Restarted'} ${name}.` })
    } catch (error) {
        req.log.error({ err: error, vmName: name, action }, 'Unable to perform VM action on its assigned host.')
        return res.status(503).send({ error: error instanceof Error ? error.message : 'VM host operation failed.' })
    }
}
