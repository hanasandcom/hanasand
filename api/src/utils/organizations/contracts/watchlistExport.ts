import type { OrganizationAlertVisibilityPolicy } from '../../organizationVisibility.ts'
import type { OrganizationDownstreamAuthorizationExport } from './downstreamAuthorization.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationSharedWatchlistAlertQueueVisibility } from './alertQueueVisibility.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from './downstreamProof.ts'
import type { OrganizationSharedWatchlistIntegrationGuardrails } from './integrationGuardrails.ts'
import type { OrganizationWatchlistAlertBridgeContract } from './alertBridge.ts'
import type { OrganizationWatchlistAlertGenerationRef, OrganizationWatchlistTerm } from './alertGeneration.ts'
import type { OrganizationWebhookDestinationAccessDecision } from './webhookDestinationAccess.ts'
import type { OrganizationWebhookDestinationOwnershipContract } from './webhookDestinationOwnership.ts'
import type { OrganizationSharedWatchlistConsumerReadiness } from './consumerAdapters.ts'
import type { WatchlistKind } from '../inputTypes.ts'
import type {
    OrganizationWatchlistAlertCasePersistenceReceipt,
    OrganizationWatchlistReadinessExport,
    OrganizationWatchlistTermExportDeltaReceipt,
} from './watchlistExport/receipts.ts'
import type { OrganizationWatchlistAlertGenerationConsumer } from './watchlistExport/consumer.ts'

export type OrganizationWatchlistAlertTermsExport = {
    schemaVersion: 'organization.watchlist_alert_terms_export.v1'
    organizationId: string
    tenantId: string
    ownerOrganizationId: string
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    visibilityPolicy: OrganizationAlertVisibilityPolicy
    allowedViewerRoles: OrganizationRole[]
    recommendedDownstreamRoute: 'organization_watchlist'
    alertBridgeContract: OrganizationWatchlistAlertBridgeContract
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport
    sharedWatchlistDownstreamProof: OrganizationSharedWatchlistDownstreamProof
    sharedWatchlistIntegrationGuardrails: OrganizationSharedWatchlistIntegrationGuardrails
    sharedWatchlistAlertQueueVisibility: OrganizationSharedWatchlistAlertQueueVisibility
    webhookDestinationOwnership: OrganizationWebhookDestinationOwnershipContract
    webhookDestinationAccessDecision: OrganizationWebhookDestinationAccessDecision
    consumerReadiness: OrganizationSharedWatchlistConsumerReadiness
    alertGenerationConsumer: OrganizationWatchlistAlertGenerationConsumer
    termExportDeltaReceipt: OrganizationWatchlistTermExportDeltaReceipt
    alertCasePersistenceReceipt: OrganizationWatchlistAlertCasePersistenceReceipt
    readinessExport: OrganizationWatchlistReadinessExport
    activeTerms: Array<OrganizationWatchlistTerm & {
        source: 'organization_shared_watchlist'
        alertGeneratorKey: string
        alertGenerationRef: OrganizationWatchlistAlertGenerationRef
        ownerContext: {
            schemaVersion: 'organization.watchlist_term_owner_context.v1'
            organizationId: string
            tenantId: string
            ownerOrganizationId: string
            watchlistItemId: string
            itemId: string
            createdBy: string
            updatedBy: string | null
            visibilityPolicy: OrganizationAlertVisibilityPolicy
            allowedViewerRoles: OrganizationRole[]
            webhookDestinationOrgField: 'destination.org_id'
            alertGeneratorKey: string
        }
        alertGenerationReference: {
            schemaVersion: 'organization.watchlist_item_alert_reference.v1'
            organizationId: string
            tenantId: string
            watchlistItemId: string
            itemId: string
            termFamily: WatchlistKind
            category: WatchlistKind
            term: string
            status: 'active'
        }
    }>
    activeWatchlistTerms: OrganizationWatchlistTerm[]
    termFamilies: WatchlistKind[]
    excluded: {
        pausedCount: number
        archivedCount: number
        inactiveCount: number
    }
    termLifecycle: {
        schemaVersion: 'organization.watchlist_term_lifecycle.v1'
        organizationId: string
        tenantId: string
        activeItemIds: string[]
        pausedItemIds: string[]
        archivedItemIds: string[]
        deletedTermIds: string[]
        deletedTermCount: number
        deletedTermSource: 'DELETE /api/organizations/:organizationId/watchlists/:itemId'
        cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup'
        alertMatchingEligibleStatuses: Array<'active'>
        exportExcludesDeletedTerms: true
        excludedFromAlertMatching: Array<{
            watchlistItemId: string
            itemId: string
            status: 'paused' | 'archived'
            blockerCode: 'watchlist_paused' | 'watchlist_archived'
            deletedByArchive: boolean
            archivedAt: string | null
            lifecycleReason: string | null
            lifecycleRequestId: string | null
        }>
        downstreamRefs: {
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms'
            alertReadiness: 'GET /api/organizations/:id/alert-readiness'
            webhookDestinationOrgField: 'destination.org_id'
            casePathTemplate: '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId'
        }
    }
    blockedReasons: string[]
    canGenerateAlerts: boolean
}
