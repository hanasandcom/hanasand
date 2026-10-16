import type { FastifyReply, FastifyRequest } from 'fastify'
import { type OrganizationRow, type OrganizationWatchlistAction } from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'

export function sendWatchlistLookupDenial(
    req: FastifyRequest,
    res: FastifyReply,
    organization: OrganizationRow,
    actorId: string,
    input: {
        action: 'read_watchlist' | 'update_watchlist' | 'archive_watchlist' | OrganizationWatchlistAction
        itemId: string
        requestId?: string | null
        reason?: string | null
    }
) {
    const denial = {
        schemaVersion: 'organization.watchlist_lookup_denial.v1' as const,
        organizationId: organization.id,
        tenantId: organization.id,
        actorId,
        actorRole: organization.role ?? null,
        action: input.action,
        itemId: input.itemId,
        blockerCode: 'watchlist_not_found_or_cross_org' as const,
        statusCode: 404,
        nonmemberEnumeration: false as const,
        crossOrgEnumerationAllowed: false as const,
        deniedReadDoesNotAffectActiveTerms: true as const,
        readinessRefs: {
            sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1' as const,
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1' as const,
            alertCasePersistence: 'organization.alert_case_bridge_persistence_receipt.v1' as const,
            caseVisibilityConsumer: 'organization.case_visibility_consumer.v1' as const,
            webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1' as const,
        },
        blockedConsumerContracts: [
            'organization.shared_watchlist_readiness_export.v1',
            'organization.watchlist_alert_generation_consumer.v1',
            'organization.case_visibility_consumer.v1',
            'organization.webhook_destination_access_decision.v1',
            'organization.webhook_alert_delivery_readiness.v1',
        ],
        message: 'Watchlist item not found.',
        safeFields: [
            'schemaVersion',
            'organizationId',
            'tenantId',
            'actorRole',
            'action',
            'itemId',
            'blockerCode',
            'requestId',
        ],
        noLeakFields: [
            'otherOrg.watchlistItemIds',
            'otherOrg.alertGeneratorKeys',
            'otherOrg.webhookDestinationIds',
            'otherOrg.caseIds',
            'activeTerms[]',
        ],
        serviceLogAction: 'organization_watchlist_lookup_denied' as const,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
    logOrganizationEvent(req, denial.serviceLogAction, organization.id, actorId, {
        requestId: denial.requestId,
        reason: denial.reason,
        action: denial.action,
        itemId: denial.itemId,
        actorRole: organization.role,
        blockerCode: denial.blockerCode,
    })
    return res.status(404).send({ error: denial.message, watchlistLookupDenial: denial })
}
