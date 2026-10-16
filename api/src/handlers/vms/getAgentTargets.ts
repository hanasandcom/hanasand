import { withLiveVmStatus } from '#utils/vms/status.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { buildAgentTarget } from '#utils/vms/buildAgentTarget.ts'
import type { AgentTargetVmRow } from '#utils/vms/agentTargetQuery.ts'
import { agentTargetSelect } from '#utils/vms/agentTargetQuery.ts'

export default async function getAgentTargets(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { valid: isAdmin } = await hasHanasandInternalRouteAccess(req)

    try {
        const result = isAdmin
            ? await run(`
                ${agentTargetSelect}
                ORDER BY v.name ASC
            `)
            : await run(`
                ${agentTargetSelect}
                WHERE vm_user_has_access(v.name, $1)
                ORDER BY v.name ASC
            `, [id])

        const targets = await Promise.all(result.rows.map(async (row) => buildAgentTarget({
            vm: await withLiveVmStatus(row as AgentTargetVmRow),
            currentUserId: id,
            canManage: isAdmin,
        })))

        return res.send({
            scope: isAdmin ? 'all' : 'accessible',
            count: targets.length,
            targets,
            missingPlatformCapabilities: [
                'remote shell command execution',
                'remote file writes',
                'interactive shell streaming',
                'VM-targeted repo sync',
            ],
        })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Unable to load VM agent targets.' })
    }
}
