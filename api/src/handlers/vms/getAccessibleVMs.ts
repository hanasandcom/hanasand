import { withLiveVmStatuses } from '#utils/vms/status.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { vmViewer } from '#utils/vms/access.ts'
import { contentOrganizationAccess, requestedContentOrganization } from '#utils/contentOrganization.ts'

export default async function getAccessibleVMs(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'private, no-store')
    const { user } = req.params as { user: string }
    const viewer = await vmViewer(req, res)
    if (!viewer) return
    if (user !== viewer.id && !viewer.admin) return res.status(403).send({ error: 'Forbidden.' })

    if (!user) {
        return res.status(400).send({ error: 'Missing user.' })
    }

    const organizationId = requestedContentOrganization(req)
    if (organizationId && !await contentOrganizationAccess(organizationId, viewer.id)) {
        return res.status(403).send({ error: 'You do not have access to this organization’s content.' })
    }

    try {
        const result = organizationId
            ? await run(
                `SELECT *
                 FROM vms
                 WHERE organization_id = $1 AND vm_user_has_access(name, $2)`,
                [organizationId, viewer.id]
            )
            : await run(
                `SELECT *
                 FROM vms
                 WHERE organization_id IS NULL
                   AND vm_user_has_access(name, $1)`,
                [user]
            )

        if (result.rows.length === 0) {
            return res.status(200).send([])
        }

        return res.send(await withLiveVmStatuses(result.rows))
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: 'Internal server error' })
    }
}
