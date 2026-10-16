import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import {
    organizationInviteListContract,
    sendInviteManagementDenial,
} from './shared.ts'
import { loadRequiredOrganizationMemberRequest } from '../requestContext.ts'
import { roleCanManageOrganization, toInvite, type OrganizationInviteRow } from '#utils/organizations.ts'

type OrganizationParams = { id: string }

export async function getOrganizationInvites(req: FastifyRequest<{ Params: OrganizationParams, Querystring: { requestId?: string, request_id?: string } }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext

    if (!roleCanManageOrganization(organization.role)) {
        return sendInviteManagementDenial(req, res, organization, userId, {
            action: 'list_invites',
            requestId: typeof req.query?.requestId === 'string' ? req.query.requestId : typeof req.query?.request_id === 'string' ? req.query.request_id : null,
            message: 'Only organization owners and admins can view invites.',
        })
    }

    const result = await run(`
        SELECT *
        FROM organization_invites
        WHERE organization_id = $1
          AND status = 'pending'
          AND expires_at > NOW()
        ORDER BY status ASC, created_at DESC
    `, [req.params.id])

    const invites = result.rows as OrganizationInviteRow[]

    return res.send({
        invites: invites.map(toInvite),
        inviteLifecycleContract: organizationInviteListContract(organization, invites),
    })
}
