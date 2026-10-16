import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import {
    organizationVisibilityDecision,
    organizationWatchlistOwnerContext,
    normalizeOptionalWatchlistKind,
    normalizeOptionalWatchlistStatus,
    toOrganization,
    toWatchlistItem,
    type OrganizationWatchlistRow,
} from '#utils/organizations.ts'
import { sendOrganizationAccessDenial } from '../audit.ts'
import { loadOrganizationMemberRequest, loadRequiredOrganizationMemberRequest } from '../requestContext.ts'
import { organizationSharedWatchlistContract } from './readContract.ts'
import { sendWatchlistLookupDenial } from './lookupDenial.ts'

type OrganizationParams = { id: string }
type WatchlistParams = { organizationId: string; itemId: string }
type WatchlistQuery = { kind?: string; status?: string; includeArchived?: string; include_archived?: string }

export async function getOrganizationWatchlists(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const requestContext = await loadOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext
    if (!organization) {
        return sendOrganizationAccessDenial(req, res, {
            organizationId: req.params.id,
            actorId: userId,
            route: 'GET /api/organizations/:id/watchlists',
        })
    }

    const query = req.query as WatchlistQuery | undefined
    const kind = normalizeOptionalWatchlistKind(query?.kind)
    const status = normalizeOptionalWatchlistStatus(query?.status)
    const includeArchived = status === 'archived' || query?.includeArchived === 'true' || query?.include_archived === 'true'
    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND ($2::boolean IS TRUE OR archived_at IS NULL)
          AND ($3::text IS NULL OR kind = $3)
          AND ($4::text IS NULL OR status = $4)
        ORDER BY status ASC, kind ASC, value ASC
    `, [req.params.id, includeArchived, kind, status])
    const watchlistItems = result.rows as OrganizationWatchlistRow[]

    return res.send({
        organization: toOrganization(organization),
        watchlistItems: watchlistItems.map(toWatchlistItem),
        sharedWatchlistContract: organizationSharedWatchlistContract(organization, watchlistItems),
    })
}

export async function getOrganizationWatchlist(req: FastifyRequest<{ Params: WatchlistParams }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.organizationId)
    if (!requestContext) return
    const { userId, organization } = requestContext

    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE id = $1
          AND organization_id = $2
        LIMIT 1
    `, [req.params.itemId, req.params.organizationId])

    if (!result.rows.length) {
        return sendWatchlistLookupDenial(req, res, organization, userId, {
            action: 'read_watchlist',
            itemId: req.params.itemId,
        })
    }

    const watchlistItem = toWatchlistItem(result.rows[0] as OrganizationWatchlistRow)
    const visibility = organizationVisibilityDecision({
        role: organization.role,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy,
    })

    return res.send({
        organization: toOrganization(organization),
        watchlistItem,
        watchlistReadContract: {
            schemaVersion: 'organization.watchlist_item_read.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            ownerOrganizationId: organization.id,
            watchlistItemId: watchlistItem.id,
            watchlistId: watchlistItem.id,
            member: {
                userId,
                role: organization.role ?? 'viewer',
                status: 'active',
            },
            visibility: {
                canReadSharedWatchlist: true,
                alertVisibilityAllowed: visibility.allowed,
                alertVisibilityPolicy: visibility.alertVisibilityPolicy,
                allowedAlertViewerRoles: visibility.allowedRoles,
                alertVisibilityDenialReason: visibility.reason,
            },
            ownerContext: organizationWatchlistOwnerContext({
                organization,
                watchlistItemId: watchlistItem.id,
                actorId: userId,
                visibility,
            }),
            alertBridge: {
                activeTermsExportRoute: 'GET /api/organizations/:id/watchlists/alert-terms',
                alertGenerationReference: watchlistItem.alertGenerationReference,
                requiredPersistedFields: [
                    'organizationId',
                    'tenantId',
                    'watchlistItemIds',
                    'workflowContext.alertGenerationRefs',
                    'workflowContext.alertGeneratorKeys',
                    'workflowContext.visibilityDecision',
                ],
            },
            webhookBridge: {
                route: 'POST /v1/dwm/webhooks/deliver',
                requiredDestinationOrgId: organization.id,
                selectedDestinationOrgField: 'destination.org_id',
                selectedDestinationIdField: 'webhookDestinationIds[]',
                nonmemberDestinationEnumeration: false,
                noLeakFields: ['destination.secret', 'otherOrg.destinationIds'],
            },
            lifecycle: {
                status: watchlistItem.status,
                enabled: watchlistItem.enabled,
                disabledReason: watchlistItem.disabledReason,
                alertGenerationEligible: watchlistItem.enabled,
            },
            termLifecycle: {
                schemaVersion: 'organization.watchlist_item_term_lifecycle.v1',
                organizationId: organization.id,
                tenantId: organization.id,
                watchlistItemId: watchlistItem.id,
                itemId: watchlistItem.id,
                status: watchlistItem.status,
                activeForAlertMatching: watchlistItem.enabled,
                deletedByArchive: watchlistItem.status === 'archived',
                alertMatchingEligibleStatuses: ['active'],
                blockerCode: watchlistItem.disabledReason,
                lifecycleReason: watchlistItem.lifecycleReason,
                lifecycleRequestId: watchlistItem.lifecycleRequestId,
                downstreamRefs: {
                    alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
                    alertReadiness: 'GET /api/organizations/:id/alert-readiness',
                    webhookDestinationOrgField: 'destination.org_id',
                    casePathTemplate: '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId',
                },
                noLeakFields: [
                    'otherOrg.watchlistItemIds',
                    'otherOrg.alertGeneratorKeys',
                    'destination.secret',
                ],
            },
            noLeakFields: [
                'otherOrg.watchlistItemIds',
                'otherOrg.alertGeneratorKeys',
                'otherOrg.destinationIds',
                'destination.secret',
            ],
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
    })
}
