import type { OrganizationRole } from '../../organizationRoles.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationRolesFor } from '../authorization/roleActions.ts'

export function organizationWatchlistMutationDenial(input: {
    organizationId: string
    actorId: string
    actorRole?: OrganizationRole | null
    action: 'create_watchlist' | 'update_watchlist' | 'archive_watchlist' | 'watchlist_lifecycle_action' | 'cleanup_watchlists'
    itemId?: string | null
    requestId?: string | null
    reason?: string | null
    message: string
}) {
    return {
        schemaVersion: 'organization.watchlist_mutation_denial.v1' as const,
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        action: input.action,
        itemId: input.itemId ?? null,
        denialReason: 'role_not_allowed' as const,
        message: input.message,
        statusCode: 403,
        allowedRoles: input.action === 'cleanup_watchlists'
            ? organizationRolesFor('managers')
            : organizationRolesFor('watchlistEditors'),
        readRoles: organizationRolesFor('sharedWatchlistReaders'),
        memberCanReadSharedWatchlists: true,
        memberCanMutateSharedWatchlists: false,
        viewerCanReadSharedWatchlists: true,
        viewerCanMutateSharedWatchlists: false,
        downstreamRefs: {
            sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1' as const,
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1' as const,
            alertCasePersistence: 'organization.alert_case_bridge_persistence_receipt.v1' as const,
            webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1' as const,
        },
        deniedMutationDoesNotAffectActiveTerms: true,
        activeExportRemainsAvailableToAllowedRoles: true,
        noLeakFields: [
            'activeTerms[].term',
            'otherOrg.watchlistItemIds',
            'otherOrg.alertGeneratorKeys',
            'destination.secret',
            'case.evidence.rawContent',
        ],
        nonmemberEnumeration: false as const,
        serviceLogAction: 'organization_watchlist_mutation_denied' as const,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}
