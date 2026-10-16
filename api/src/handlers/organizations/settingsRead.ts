import type { FastifyReply, FastifyRequest } from 'fastify'
import { organizationLifecycleReadiness, organizationSettingsFromRow, toOrganization } from '#utils/organizations.ts'
import { organizationSettingsPermissions } from './lifecycle.ts'
import { loadRequiredOrganizationMemberRequest } from './requestContext.ts'

type OrganizationParams = { id: string }

export async function getOrganizationSettings(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { organization } = requestContext

    return res.send({
        organization: toOrganization(organization),
        settings: organizationSettingsFromRow(organization),
        permissions: organizationSettingsPermissions(organization.role),
        lifecycleReadiness: organizationLifecycleReadiness(organization),
    })
}
