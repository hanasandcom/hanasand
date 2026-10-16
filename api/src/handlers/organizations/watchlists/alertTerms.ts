import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import {
    normalizeWatchlistRequestId,
    organizationVisibilityDecision,
    organizationWatchlistAlertTermsExport,
    organizationWatchlistAlertTermsExportDenial,
    toOrganization,
    type OrganizationWatchlistRow,
} from '#utils/organizations.ts'
import { logOrganizationEvent, sendOrganizationAccessDenial } from '../audit.ts'
import { loadOrganizationMemberRequest } from '../requestContext.ts'

type OrganizationParams = { id: string }
type Query = { requestId?: string; request_id?: string }

export async function getOrganizationWatchlistAlertTerms(req: FastifyRequest<{ Params: OrganizationParams, Querystring: Query }>, res: FastifyReply) {
    const requestContext = await loadOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext
    if (!organization) {
        return sendOrganizationAccessDenial(req, res, {
            organizationId: req.params.id,
            actorId: userId,
            route: 'GET /api/organizations/:id/watchlists/alert-terms',
        })
    }

    const requestId = normalizeWatchlistRequestId(req.query?.requestId ?? req.query?.request_id)
    const visibility = organizationVisibilityDecision({
        role: organization.role,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy,
    })
    if (!visibility.allowed) {
        const deniedExport = organizationWatchlistAlertTermsExportDenial({
            organizationId: organization.id,
            tenantId: organization.id,
            member: {
                userId,
                role: organization.role ?? 'viewer',
            },
            visibility,
            requestId,
        })
        logOrganizationEvent(req, 'organization_watchlist_alert_terms_export_denied', req.params.id, userId, {
            requestId,
            role: organization.role,
            alertVisibilityPolicy: visibility.alertVisibilityPolicy,
            allowedRoles: visibility.allowedRoles,
            denialReason: visibility.reason,
            blockerCodes: deniedExport.blockerCodes,
        })
        return res.status(403).send({
            error: 'Organization alert visibility does not allow this member to export alert terms.',
            organization: toOrganization(organization),
            alertTermsExportDenial: deniedExport,
        })
    }

    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE organization_id = $1
        ORDER BY status ASC, kind ASC, value ASC
    `, [req.params.id])
    const watchlistItems = result.rows as OrganizationWatchlistRow[]
    const exportContract = organizationWatchlistAlertTermsExport(organization, watchlistItems, {
        userId,
        role: organization.role ?? 'viewer',
    })

    logOrganizationEvent(req, 'organization_watchlist_alert_terms_exported', req.params.id, userId, {
        requestId,
        activeTermCount: exportContract.activeTerms.length,
        pausedCount: exportContract.excluded.pausedCount,
        archivedCount: exportContract.excluded.archivedCount,
        canGenerateAlerts: exportContract.canGenerateAlerts,
    })

    return res.send({
        organization: toOrganization(organization),
        alertTermsExport: exportContract,
    })
}
