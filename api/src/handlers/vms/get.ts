import { withShareManagement } from '#utils/vms/shareManagement.ts'
import { withLiveVmStatus, withLiveVmStatuses } from '#utils/vms/status.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { loadSQL } from '#utils/loadSQL.ts'
import { vmViewer, requireVmAccess } from '#utils/vms/access.ts'
import { contentOrganizationAccess, requestedContentOrganization } from '#utils/contentOrganization.ts'

export default async function getVM(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'private, no-store')
    const { id, user } = req.params as { id?: string; user?: string }
    const viewer = id ? await requireVmAccess(req, res, id, true) : await vmViewer(req, res)
    if (!viewer) return
    if (user && !viewer.admin && user !== viewer.id) return res.status(403).send({ error: 'Forbidden.' })

    const organizationId = requestedContentOrganization(req)
    if (!id && organizationId && !await contentOrganizationAccess(organizationId, viewer.id)) {
        return res.status(403).send({ error: 'You do not have access to this organization’s content.' })
    }

    try {
        let result
        if (id) {
            const query = await loadSQL(organizationId ? 'getVmByIdInOrganization.sql' : 'getVmById.sql')
            result = await run(query, organizationId ? [id, organizationId] : [id])
        } else if (organizationId) {
            const query = await loadSQL('getVmsByOrganization.sql')
            result = await run(query, [organizationId, viewer.id])
        } else {
            // A request without organization context represents the viewer's
            // personal workspace. Never fall back to the global inventory for
            // administrators: that list includes organization-owned VMs.
            const query = await loadSQL('getVmsByUser.sql')
            result = await run(query, [user || viewer.id])
        }

        if (result.rows.length === 0) {
            if (id) {
                return res.status(404).send({ error: 'VM not found' })
            }

            return res.status(200).send([])
        }

        const rows = (await withShareManagement(result.rows)).map(row => ({ ...row, can_assign_organization: !row.organization_id && !row.deleted_at && (viewer.admin || row.owner === viewer.id) }))
        return res.send(id
            ? [await withLiveVmStatus(rows[0])]
            : await withLiveVmStatuses(rows))
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: 'Internal server error' })
    }
}
