import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import {
    organizationMemberAccessContract,
    toMember,
    toOrganization,
    type OrganizationMemberRow,
} from '#utils/organizations.ts'
import { organizationMembershipIdentityColumns } from '#utils/organizations/membershipIdentityColumns.ts'
import { loadRequiredOrganizationMemberRequest } from '../requestContext.ts'

type OrganizationParams = { id: string }

export async function getOrganizationMembers(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { organization } = requestContext

    const result = await run(`
        SELECT
            ${organizationMembershipIdentityColumns('u')}
        FROM organization_members om
        JOIN users u ON u.id = om.user_id
        WHERE om.organization_id = $1
          AND om.status = 'active'
        ORDER BY
            CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END,
            om.joined_at ASC,
            om.user_id ASC
    `, [req.params.id])

    const members = result.rows as OrganizationMemberRow[]
    return res.send({
        organization: toOrganization(organization),
        members: members.map(toMember),
        memberAccessContract: organizationMemberAccessContract(organization, members),
    })
}
