import type { OrganizationRole } from '../../../organizationRoles.ts'
import type { OrganizationWatchlistAlertGenerationRef } from '../alertGeneration.ts'
import type { OrganizationWatchlistAlertTermsExport } from '../watchlistExport.ts'
import type { WatchlistKind } from '../../inputTypes.ts'

export type OrganizationWatchlistAlertGenerationConsumer = {
    schemaVersion: 'organization.watchlist_alert_generation_consumer.v1'
    organizationId: string
    tenantId: string
    repositoryAdapter: 'organizationWatchlistAlertTermsExport'
    sourceFamily: 'organization_watchlist'
    route: 'GET /api/organizations/:id/watchlists/alert-terms'
    requiredQueryFields: Array<'organizationId'>
    requiredPersistedFields: Array<'organizationId' | 'tenantId' | 'watchlistItemId' | 'watchlistItemIds' | 'workflowContext.organizationId' | 'workflowContext.alertGeneratorKeys' | 'workflowContext.visibilityDecision'>
    activeTerms: Array<{
        organizationId: string
        tenantId: string
        watchlistItemId: string
        itemId: string
        termFamily: WatchlistKind
        category: WatchlistKind
        term: string
        normalizedTerm: string
        status: 'active'
        alertGeneratorKey: string
        alertGenerationRef: OrganizationWatchlistAlertGenerationRef
    }>
    lifecycleExclusions: OrganizationWatchlistAlertTermsExport['termLifecycle']
    scopeGuardrails: {
        partitionKey: 'organizationId'
        tenantIdField: 'tenantId'
        watchlistScope: 'organization_owned'
        crossOrgReadAllowed: false
        userLocalFallbackAllowed: false
        nonmemberEnumeration: false
    }
    roleGates: {
        exportTerms: OrganizationRole[]
        mutateWatchlists: Array<'owner' | 'admin' | 'editor'>
        readSharedWatchlists: OrganizationRole[]
    }
    denialContract: {
        nonmember: 'organization.access_denial.v1'
        roleDenied: 'organization.watchlist_alert_terms_export_denial.v1'
        removedMember: 'member_revoked'
        noLeakFields: Array<'activeTerms[]' | 'activeWatchlistTerms[]' | 'watchlistScope.alertGeneratorKeys' | 'otherOrg.watchlistItemIds'>
    }
    matchingInputReceipt: {
        schemaVersion: 'organization.watchlist_alert_matching_input.v1'
        organizationId: string
        tenantId: string
        sourceFamily: 'organization_watchlist'
        matchingRoute: 'organization_watchlist'
        termCount: number
        requiredMatcherFields: Array<'organizationId' | 'tenantId' | 'watchlistId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm' | 'watchedEntity' | 'matchReason' | 'actorRef' | 'sourceRefs' | 'provenanceHash' | 'provenance' | 'workflowReadiness' | 'destinationReadiness' | 'alertGeneratorKey' | 'alertGenerationRef'>
        dedupeKeyFields: Array<'organizationId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm'>
        terms: Array<{
            organizationId: string
            tenantId: string
            watchlistId: string
            watchlistItemId: string
            termFamily: WatchlistKind
            watchedEntity: {
                type: WatchlistKind
                value: string
                normalizedValue: string
            }
            matchReason: {
                kind: 'shared_watchlist_term'
                code: 'organization_watchlist_term_match'
                field: 'watchedEntity.normalizedValue'
            }
            actorRef: {
                userId: string
                role: OrganizationRole
                source: 'organization_member'
            }
            sourceRefs: {
                sourceFamily: 'organization_watchlist'
                exportRoute: 'GET /api/organizations/:id/watchlists/alert-terms'
                caseVisibilityRoute: 'GET /api/organizations/:id/alert-case-visibility'
            }
            normalizedTerm: string
            alertGeneratorKey: string
            provenanceHash: string
            status: 'active'
            workflowReadiness: {
                schemaVersion: 'organization.watchlist_match_workflow_readiness.v1'
                alertGenerationReady: boolean
                caseReplayReady: boolean
                destinationDeliveryReady: boolean
                route: 'organization_watchlist'
                caseVisibilityRoute: 'GET /api/organizations/:id/alert-case-visibility'
                blockerCodes: string[]
            }
            destinationReadiness: {
                schemaVersion: 'organization.watchlist_match_destination_readiness.v1'
                webhookDestinationOwnership: 'organization.webhook_destination_ownership.v1'
                webhookDestinationAccessDecision: 'organization.webhook_destination_access_decision.v1'
                selectedDestinationOrgField: 'destination.org_id'
                selectedDestinationIdField: 'webhookDestinationIds[]'
                dryRunVisibility: {
                    allowed: boolean
                    allowedRoles: Array<'owner' | 'admin' | 'editor'>
                    deniedRoles: Array<'reader' | 'member' | 'viewer'>
                    redactedFields: Array<'destination.secret' | 'destination.endpoint'>
                }
                blockerCodes: string[]
            }
            provenance: {
                schemaVersion: 'organization.watchlist_match_provenance.v1'
                organizationId: string
                tenantId: string
                watchlistId: string
                watchlistItemId: string
                alertGeneratorKey: string
                provenanceHash: string
                createdBy: string
                updatedBy: string | null
                lifecycleRequestId: string | null
                matchBasis: 'normalized_watchlist_term'
                caseReplayFields: Array<'organizationId' | 'tenantId' | 'watchlistId' | 'watchlistItemId' | 'watchedEntity' | 'matchReason' | 'alertGeneratorKey' | 'provenanceHash' | 'provenance' | 'workflowReadiness' | 'destinationReadiness'>
            }
            alertGenerationRef: OrganizationWatchlistAlertGenerationRef
        }>
        lifecycleExclusions: {
            pausedItemIds: string[]
            archivedItemIds: string[]
            deletedTermIds: string[]
            excludedStatuses: Array<'paused' | 'archived'>
        }
        scopeGuardrails: {
            partitionKey: 'organizationId'
            crossOrgReadAllowed: false
            userLocalFallbackAllowed: false
            nonmemberEnumeration: false
        }
        noLeakFields: Array<'otherOrg.watchlistItemIds' | 'otherOrg.alertGeneratorKeys' | 'destination.secret'>
    }
    canGenerateAlerts: boolean
    blockerCodes: string[]
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
}
