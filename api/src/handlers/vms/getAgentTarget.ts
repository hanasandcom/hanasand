import { hasVmAccess } from '#utils/vms/access.ts'
import { withLiveVmStatus } from '#utils/vms/status.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { buildAgentTarget } from '#utils/vms/buildAgentTarget.ts'
import { loadAgentTargetVm } from '#utils/vms/agentTargetQuery.ts'
import recordLog from '#utils/logs/recordLog.ts'

export default async function getAgentTarget(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing VM id.' })
    }

    const { valid: isAdmin } = await hasHanasandInternalRouteAccess(req)

    try {
        const vm = await loadAgentTargetVm(id)
        if (!vm) {
            return res.status(404).send({ error: 'VM not found.' })
        }

        const canAccess =
            isAdmin || await hasVmAccess(vm.name, userId)

        if (!canAccess) {
            return res.status(403).send({ error: 'Forbidden.' })
        }

        return res.send(buildAgentTarget({
            vm: await withLiveVmStatus(vm),
            currentUserId: userId,
            canManage: isAdmin,
        }))
    } catch (error) {
        req.log.error(error)
        void recordLog({
            level: 'warn',
            message: `Terminal agent target lookup failed for ${id}: ${error instanceof Error ? error.message : String(error)}`,
            metadata: {
                category: 'terminal_failure',
                vmName: id,
            },
        }).catch(() => {})
        return res.status(500).send({ error: 'Unable to load VM agent target.' })
    }
}
