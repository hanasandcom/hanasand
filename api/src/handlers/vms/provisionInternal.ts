import type { FastifyReply, FastifyRequest } from 'fastify'
import config from '#constants'
import run from '#db'
import hasInternalToken from '#utils/auth/internalToken.ts'
import { canUseLocalLxd, provisionLocalLxdInstance } from '#utils/vms/lxd.ts'
import { clearLocalProvisionState, setLocalProvisionState } from '#utils/vms/localProvisionState.ts'
import { publicVmProvisioningFailureReason } from '#utils/vms/provisioningFailure.ts'
import { supportedHost } from '#utils/vms/hostTransport.ts'
import type { VmProvisionOptions } from '#utils/vms/provisionOnHost.ts'

type VmRow = { primary_host: string | null }

export default async function provisionInternalVm(req: FastifyRequest, res: FastifyReply) {
    if (!hasInternalToken(req)) return res.status(401).send({ error: 'Unauthorized.' })

    const { name } = req.params as { name: string }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/.test(name || '')) {
        return res.status(400).send({ error: 'Invalid VM name.' })
    }

    const localHost = config.vm_host_id
    if (!supportedHost(localHost)) {
        return res.status(503).send({ error: 'VM provisioning host is not supported.' })
    }

    try {
        const result = await run(`
            SELECT primary_host
            FROM vms
            WHERE LOWER(name) = LOWER($1)
              AND deleted_at IS NULL
            LIMIT 1
        `, [name])
        const vm = result.rows[0] as VmRow | undefined
        if (!vm) return res.status(404).send({ error: 'Active VM not found.' })
        if (vm.primary_host?.toLowerCase() !== localHost.toLowerCase()) {
            return res.status(409).send({ error: 'VM is assigned to another host.' })
        }
        if (!await canUseLocalLxd()) {
            return res.status(503).send({ error: 'Local LXD is unavailable.' })
        }

        const body = req.body as VmProvisionOptions | undefined
        setLocalProvisionState(name, { status: 'Provisioning', status_reason: 'Creating and preparing VM' })
        void provisionLocalLxdInstance(name, body).then(() => {
            clearLocalProvisionState(name)
        }).catch(error => {
            setLocalProvisionState(name, { status: 'Error', status_reason: publicVmProvisioningFailureReason(error) })
            req.log.error({ err: error, vmName: name }, 'Unable to provision VM on its assigned host.')
        })
        return res.status(202).send({ ok: true, name, host: localHost })
    } catch (error) {
        req.log.error({ err: error, vmName: name }, 'Unable to provision VM on its assigned host.')
        return res.status(500).send({ error: 'Unable to provision VM.' })
    }
}
