import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import {
    organizationAnalystPortalVisibilityAdapter,
    organizationAlertCaseWorkflowState,
    organizationSharedWatchlistProjection,
    organizationVisibilityDecision,
    toOrganization,
    type OrganizationWatchlistRow,
} from '#utils/organizations.ts'
import { logOrganizationEvent, sendOrganizationAccessDenial } from './organizations/audit.ts'
import { buildOrganizationAlertCaseVisibilityDenial } from './organizations/watchlists/caseVisibilityDenial.ts'
import { buildOrganizationAlertCaseVisibilityProjection } from './organizations/watchlists/caseVisibilityProjection.ts'
import {
    loadOrganizationMemberRequest,
} from './organizations/requestContext.ts'
export { getOrganization, postOrganization } from './organizations/core.ts'
export { deleteOrganizationApiKey, getOrganizationApiKeys, postOrganizationApiKey } from './organizations/apiKeys.ts'
export { getOrganizationSettings } from './organizations/settingsRead.ts'
export { putOrganizationSettings } from './organizations/settingsUpdate.ts'
export { postOrganizationOwnershipTransfer } from './organizations/ownershipTransfer.ts'
export { getOrganizationInvites } from './organizations/invites/read.ts'
export { postOrganizationInvites } from './organizations/invites/create.ts'
export { postOrganizationInviteAction } from './organizations/invites/action.ts'
export { postOrganizationInviteAccept } from './organizations/invites/accept.ts'
export { getOrganizationMembers } from './organizations/members/read.ts'
export { deleteOrganizationMember } from './organizations/members/remove.ts'
export { patchOrganizationMemberRole } from './organizations/members/role.ts'
export { getOrganizationWatchlists, getOrganizationWatchlist } from './organizations/watchlists/read.ts'
export { getOrganizationAlertReadiness } from './organizations/watchlists/alertReadiness.ts'
export { getOrganizationWatchlistAlertTerms } from './organizations/watchlists/alertTerms.ts'
export { postOrganizationWatchlistReconcile } from './organizations/watchlists/reconcile.ts'
export { postOrganizationWatchlistCleanup } from './organizations/watchlists/cleanup.ts'
export { postOrganizationWatchlist } from './organizations/watchlists/create.ts'
export { putOrganizationWatchlist } from './organizations/watchlists/update.ts'
export { deleteOrganizationWatchlist } from './organizations/watchlists/archive.ts'
export { postOrganizationWatchlistAction } from './organizations/watchlists/action.ts'

type OrganizationParams = {
    id: string
}
export async function getOrganizationAlertCaseVisibility(req: FastifyRequest<{ Params: OrganizationParams, Querystring: { requestId?: string, request_id?: string } }>, res: FastifyReply) {
    const requestContext = await loadOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext
    if (!organization) {
        return sendOrganizationAccessDenial(req, res, {
            organizationId: req.params.id,
            actorId: userId,
            route: 'GET /api/organizations/:id/alert-case-visibility',
            requestId: req.query?.requestId ?? req.query?.request_id ?? (req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null),
        })
    }

    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND archived_at IS NULL
        ORDER BY status ASC, kind ASC, value ASC
    `, [req.params.id])
    const watchlistItems = result.rows as OrganizationWatchlistRow[]
    const sharedProjection = organizationSharedWatchlistProjection(organization, watchlistItems, {
        userId,
        role: organization.role ?? 'viewer',
    })
    const downstreamAuthorization = sharedProjection.downstreamAuthorization
    const downstreamProof = sharedProjection.sharedWatchlistDownstreamProof
    const visibility = organizationVisibilityDecision({
        role: organization.role,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy,
    })

    if (!visibility.allowed) {
        const requestId = typeof req.query?.requestId === 'string' ? req.query.requestId : typeof req.query?.request_id === 'string' ? req.query.request_id : null
        logOrganizationEvent(req, 'organization_alert_case_visibility_denied', organization.id, userId, {
            requestId,
            role: organization.role ?? 'viewer',
            allowedRoles: visibility.allowedRoles,
            denialReason: visibility.reason ?? 'role_not_allowed',
            blockerCodes: [visibility.reason ?? 'role_not_allowed'],
        })
        return res.status(403).send({
            error: 'Organization alert visibility does not allow this member to list org alerts or cases.',
            organization: toOrganization(organization),
            alertCaseVisibility: buildOrganizationAlertCaseVisibilityDenial({ organization, userId, visibility, requestId }),
        })
    }

    const analystPortalAdapter = organizationAnalystPortalVisibilityAdapter(downstreamProof, downstreamAuthorization)
    const alertCaseWorkflowState = organizationAlertCaseWorkflowState(downstreamProof, downstreamAuthorization, analystPortalAdapter)
    return res.send({
        organization: toOrganization(organization),
        alertCaseVisibility: buildOrganizationAlertCaseVisibilityProjection({
            organization,
            userId,
            visibility,
            downstreamAuthorization,
            downstreamProof,
            analystPortalAdapter,
            alertCaseWorkflowState,
        }),
    })
}
