import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import {
    buildOrganizationBridgeContext,
    buildOrganizationDwmAlertReference,
    organizationLifecycleReadiness,
    organizationReadinessProof,
    organizationSharedWatchlistProjection,
    toOrganization,
    type OrganizationWatchlistRow,
} from '#utils/organizations.ts'
import { sendOrganizationAccessDenial } from '../audit.ts'
import { loadOrganizationMemberRequest } from '../requestContext.ts'
import { organizationTeamOnboardingReadiness } from './readContract.ts'

type OrganizationParams = { id: string }

export async function getOrganizationAlertReadiness(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const requestContext = await loadOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext
    if (!organization) {
        return sendOrganizationAccessDenial(req, res, {
            organizationId: req.params.id,
            actorId: userId,
            route: 'GET /api/organizations/:id/alert-readiness',
        })
    }

    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND archived_at IS NULL
          AND status = 'active'
        ORDER BY kind ASC, value ASC
    `, [req.params.id])
    const watchlistItems = result.rows as OrganizationWatchlistRow[]
    const bridgeContext = buildOrganizationBridgeContext({
        ...organization,
        shared_watchlist_count: watchlistItems.length,
    })
    const bridgeOrganization = {
        ...organization,
        shared_watchlist_count: bridgeContext.sharedWatchlistCount,
    }
    const generatedAlertReferences = watchlistItems.map(item => buildOrganizationDwmAlertReference(bridgeOrganization, item))
    const teamOnboardingReadiness = organizationTeamOnboardingReadiness(bridgeContext)
    const sharedProjection = organizationSharedWatchlistProjection(bridgeOrganization, watchlistItems, {
        userId,
        role: organization.role ?? 'viewer',
    })
    const alertGenerationBridge = sharedProjection.alertGeneration
    const downstreamAuthorization = sharedProjection.downstreamAuthorization
    const lifecycleReadiness = organizationLifecycleReadiness(bridgeOrganization)
    const readinessProof = organizationReadinessProof({
        lifecycleReadiness,
        alertGenerationBridge,
        downstreamAuthorization,
    })
    const sharedWatchlistDownstreamProof = sharedProjection.sharedWatchlistDownstreamProof

    return res.send({
        organization: toOrganization(organization),
        alertReadiness: {
            schemaVersion: 'organization.dwm_alert_readiness.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            defaultWebhookPolicy: bridgeContext.defaultWebhookPolicy,
            alertVisibilityPolicy: bridgeContext.alertVisibilityPolicy,
            memberCount: bridgeContext.memberCount,
            activeMemberCount: bridgeContext.activeMemberCount,
            ownerCount: bridgeContext.ownerCount,
            allowedViewerRoles: bridgeContext.allowedViewerRoles,
            removedMemberDenialReason: bridgeContext.removedMemberDenialReason,
            deactivatedMemberDenialReason: bridgeContext.deactivatedMemberDenialReason,
            pendingInviteCount: bridgeContext.pendingInviteCount,
            sharedWatchlistCount: bridgeContext.sharedWatchlistCount,
            readinessStatus: bridgeContext.readinessStatus,
            ready: generatedAlertReferences.length > 0,
            teamOnboardingReadiness,
            lifecycleReadiness,
            readinessProof,
            sharedWatchlistDownstreamProof,
            alertGenerationBridge,
            downstreamAuthorization,
            watchlistItemCount: generatedAlertReferences.length,
            generatedAlertReferences,
            downstreamFields: [
                'organizationId',
                'tenantId',
                'watchlistItemId',
                'watchlist.id',
                'watchlist.terms',
                'watchlist.status',
                'watchlist.createdBy',
                'watchlist.updatedBy',
                'matchedTerm',
                'route',
                'casePath',
                'dedupeKey',
                'defaultWebhookPolicy',
                'alertVisibilityPolicy',
                'memberCount',
                'activeMemberCount',
                'ownerCount',
                'allowedViewerRoles',
                'removedMemberDenialReason',
                'deactivatedMemberDenialReason',
                'pendingInviteCount',
                'sharedWatchlistCount',
                'readinessStatus',
                'teamOnboardingReadiness',
                'lifecycleReadiness',
                'readinessProof',
                'readinessProof.routes',
                'readinessProof.worker3Proof',
                'readinessProof.uiProof',
                'readinessProof.blockers',
                'alertGenerationBridge',
                'alertGenerationBridge.activeWatchlistTerms',
                'alertGenerationBridge.activeWatchlistTerms.status',
                'alertGenerationBridge.activeWatchlistTerms.createdBy',
                'alertGenerationBridge.activeWatchlistTerms.updatedBy',
                'alertGenerationBridge.termFamilies',
                'alertGenerationBridge.blockedReasons',
                'downstreamAuthorization.organizationId',
                'downstreamAuthorization.member.role',
                'downstreamAuthorization.watchlists.states',
                'downstreamAuthorization.allowedActions',
                'downstreamAuthorization.downstream.alertGeneration.blockerCodes',
            ],
        },
    })
}
