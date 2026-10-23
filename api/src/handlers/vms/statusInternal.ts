import type { FastifyReply, FastifyRequest } from 'fastify'
import config from '#constants'
import run from '#db'
import hasInternalToken from '#utils/auth/internalToken.ts'
import { getLocalProvisionState } from '#utils/vms/localProvisionState.ts'
import { localVmStatus } from '#utils/vms/status.ts'
import { supportedHost } from '#utils/vms/hostTransport.ts'

export default async function getInternalVmStatus(req: FastifyRequest, res: FastifyReply) {
    if (!hasInternalToken(req)) return res.status(401).send({ error: 'Unauthorized.' })
    const { name } = req.params as { name: string }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/.test(name || '')) return res.status(400).send({ error: 'Invalid VM name.' })
    const host = String(config.vm_host_id).toLowerCase()
    if (!supportedHost(host)) return res.status(503).send({ error: 'VM status host is not supported.' })
    try {
        const result = await run('SELECT primary_host FROM vms WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL LIMIT 1', [name])
        const vm = result.rows[0] as { primary_host: string | null } | undefined
        if (!vm) return res.status(404).send({ error: 'Active VM not found.' })
        if (vm.primary_host?.toLowerCase() !== host) return res.status(409).send({ error: 'VM is assigned to another host.' })
        const provisionState = getLocalProvisionState(name)
        if (provisionState) return res.send(provisionState)
        // This endpoint is the source queried by localVmStatus during worker setup.
        // Disable that probe in the fallback to avoid a request loop when no queued
        // state remains in memory.
        return res.send(await localVmStatus(name, { allowHostWorkerProbe: false }))
    } catch (error) {
        req.log.warn({ err: error, vmName: name }, 'Unable to read VM state from its assigned host.')
        return res.status(503).send({ error: 'VM host is not responding.' })
    }
}
