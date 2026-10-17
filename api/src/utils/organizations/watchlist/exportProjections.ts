import type { OrganizationWatchlistAlertGenerationContract } from '../contracts/alertGeneration.ts'
import type { OrganizationWatchlistAlertTermsExport } from '../contracts/watchlistExport.ts'
import type { OrganizationRow, OrganizationWatchlistRow } from '../rowTypes.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationWatchlistAlertReference } from './itemProjection.ts'
import { organizationWatchlistAlertGenerationRef } from './generationReferences.ts'

export function buildOrganizationActiveWatchlistTerms(alertGeneration: OrganizationWatchlistAlertGenerationContract): OrganizationWatchlistAlertTermsExport['activeTerms'] {
    return alertGeneration.activeWatchlistTerms.map(term => {
        const alertGenerationRef = organizationWatchlistAlertGenerationRef(term)
        const alertGeneratorKey = alertGenerationRef.dedupe.key
        return {
            ...term,
            source: 'organization_shared_watchlist' as const,
            alertGeneratorKey,
            alertGenerationRef,
            ownerContext: {
                schemaVersion: 'organization.watchlist_term_owner_context.v1' as const,
                ...organizationTenantIdentity(term.organizationId, term.tenantId),
                ownerOrganizationId: term.organizationId,
                watchlistItemId: term.watchlistItemId,
                itemId: term.itemId,
                createdBy: term.createdBy,
                updatedBy: term.updatedBy,
                visibilityPolicy: alertGeneration.visibilityPolicy,
                allowedViewerRoles: alertGeneration.allowedViewerRoles,
                webhookDestinationOrgField: 'destination.org_id' as const,
                alertGeneratorKey,
            },
            alertGenerationReference: organizationWatchlistAlertReference({
                organizationId: term.organizationId,
                tenantId: term.tenantId,
                watchlistItemId: term.watchlistItemId,
                kind: term.termFamily,
                term: term.term,
                status: 'active',
                enabled: true,
                disabledReason: null,
            }),
        }
    })
}

export function buildOrganizationTermLifecycle(organization: Pick<OrganizationRow, 'id'>, activeItems: OrganizationWatchlistRow[], pausedItems: OrganizationWatchlistRow[], archivedItems: OrganizationWatchlistRow[]): OrganizationWatchlistAlertTermsExport['termLifecycle'] {
    return {
        schemaVersion: 'organization.watchlist_term_lifecycle.v1',
        ...organizationTenantIdentity(organization.id, organization.id),
        activeItemIds: activeItems.map(item => item.id),
        pausedItemIds: pausedItems.map(item => item.id),
        archivedItemIds: archivedItems.map(item => item.id),
        deletedTermIds: archivedItems.map(item => item.id),
        deletedTermCount: archivedItems.length,
        deletedTermSource: 'DELETE /api/organizations/:organizationId/watchlists/:itemId',
        cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
        alertMatchingEligibleStatuses: ['active'],
        exportExcludesDeletedTerms: true,
        excludedFromAlertMatching: [
            ...pausedItems.map(item => ({ item, status: 'paused' as const })),
            ...archivedItems.map(item => ({ item, status: 'archived' as const })),
        ].map(({ item, status }) => {
            return {
                watchlistItemId: item.id,
                itemId: item.id,
                status,
                blockerCode: status === 'paused' ? 'watchlist_paused' : 'watchlist_archived',
                deletedByArchive: status === 'archived',
                archivedAt: item.archived_at ?? null,
                lifecycleReason: item.lifecycle_reason ?? null,
                lifecycleRequestId: item.lifecycle_request_id ?? null,
            }
        }),
        downstreamRefs: {
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
            alertReadiness: 'GET /api/organizations/:id/alert-readiness',
            webhookDestinationOrgField: 'destination.org_id',
            casePathTemplate: '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId',
        },
    }
}
