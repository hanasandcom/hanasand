import {
    organizationVisibilityDecision,
    organizationWatchlistOwnerContext,
    type OrganizationRow,
} from '#utils/organizations.ts'
import { organizationWatchlistOperationLifecycle } from './operationLifecycle.ts'

export function organizationWatchlistOperation(
    organization: OrganizationRow,
    input: {
        action: 'created' | 'updated' | 'disabled' | 'pause' | 'resume' | 'archive' | 'restore'
        watchlistItemId: string
        actorId: string
        requestId?: string
        reason?: string
        serviceLogAction: string
        existingItemId?: string | null
        duplicateTermMatched?: boolean
    }
) {
    const decision = organizationVisibilityDecision({
        role: organization.role,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy,
    })
    const nextLifecycle = organizationWatchlistOperationLifecycle(input.action)
    return {
        schemaVersion: 'organization.watchlist_operation.v1',
        action: input.action,
        organizationId: organization.id,
        tenantId: organization.id,
        ownerOrganizationId: organization.id,
        watchlistItemId: input.watchlistItemId,
        watchlistId: input.watchlistItemId,
        actorId: input.actorId,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        visibilityPolicy: decision.alertVisibilityPolicy,
        allowedViewerRoles: decision.allowedRoles,
        serviceLogAction: input.serviceLogAction,
        duplicateTermScope: 'organization' as const,
        ownerContext: organizationWatchlistOwnerContext({
            organization,
            watchlistItemId: input.watchlistItemId,
            actorId: input.actorId,
            visibility: decision,
        }),
        upsert: input.action === 'created' || input.action === 'updated'
            ? {
                schemaVersion: 'organization.watchlist_upsert.v1' as const,
                watchlistItemId: input.watchlistItemId,
                ownerOrganizationId: organization.id,
                idempotent: true,
                duplicateTermMatched: Boolean(input.duplicateTermMatched),
                existingItemId: input.existingItemId ?? null,
                actionTaken: input.duplicateTermMatched ? 'updated_existing_item' as const : 'created_new_item' as const,
                crossOrganizationDuplicateAllowed: true,
                sameOrganizationDuplicateCreatesNewItem: false,
                duplicateScopeKeyFields: ['organizationId', 'kind', 'normalizedValue'] as const,
                alertDedupeKeyFields: ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'] as const,
                webhookDestinationOrgField: 'destination.org_id' as const,
            }
            : null,
        lifecycleTransition: {
            schemaVersion: 'organization.watchlist_lifecycle_transition.v1',
            action: input.action,
            statusAfter: nextLifecycle.statusAfter,
            enabledAfter: nextLifecycle.enabledAfter,
            disabledReasonAfter: nextLifecycle.disabledReasonAfter,
            alertGenerationEligibleAfter: nextLifecycle.enabledAfter,
            activeTermsExportRoute: 'GET /api/organizations/:id/watchlists/alert-terms',
            cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
            blockerAfter: nextLifecycle.disabledReasonAfter,
            mutationAfterArchiveDeniedByLookup: nextLifecycle.statusAfter === 'archived',
            lookupDenialBlockerAfter: nextLifecycle.statusAfter === 'archived'
                ? 'watchlist_not_found_or_cross_org' as const
                : null,
        },
        mutationReceipt: {
            schemaVersion: 'organization.watchlist_mutation_receipt.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            ownerOrganizationId: organization.id,
            watchlistItemId: input.watchlistItemId,
            watchlistId: input.watchlistItemId,
            action: input.action,
            actorId: input.actorId,
            actorRole: organization.role ?? 'viewer',
            requestId: input.requestId ?? null,
            reason: input.reason ?? null,
            serviceLogAction: input.serviceLogAction,
            statusAfter: nextLifecycle.statusAfter,
            enabledAfter: nextLifecycle.enabledAfter,
            disabledReasonAfter: nextLifecycle.disabledReasonAfter,
            roleGates: {
                mutateWatchlists: ['owner', 'admin'],
                readSharedWatchlists: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
                exportAlertTerms: decision.allowedRoles,
                assignCases: ['owner', 'admin', 'editor'],
            },
            downstreamRoutes: {
                sharedWatchlists: 'GET /api/organizations/:id/watchlists',
                alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
                alertCaseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
                webhookOwnership: 'organization.shared_watchlist_webhook_ownership_hint.v1',
            },
            downstreamRefs: {
                alertGeneration: 'organization.watchlist_alert_generation_consumer.v1',
                caseVisibility: 'organization.case_visibility_consumer.v1',
                webhookOwnership: 'organization.shared_watchlist_webhook_ownership_hint.v1',
            },
            lifecycleBlockerAfter: nextLifecycle.disabledReasonAfter,
            activeTermsIncludedInExport: nextLifecycle.enabledAfter,
            archivedMutationDeniedByLookup: nextLifecycle.statusAfter === 'archived',
            duplicateTermMatched: Boolean(input.duplicateTermMatched),
            existingItemId: input.existingItemId ?? null,
            noEnumeration: true,
        },
        downstreamLifecycleReceipt: {
            schemaVersion: 'organization.watchlist_downstream_lifecycle_receipt.v1' as const,
            organizationId: organization.id,
            tenantId: organization.id,
            ownerOrganizationId: organization.id,
            watchlistItemId: input.watchlistItemId,
            watchlistId: input.watchlistItemId,
            actorId: input.actorId,
            actorRole: organization.role ?? 'viewer',
            action: input.action,
            requestId: input.requestId ?? null,
            reason: input.reason ?? null,
            statusAfter: nextLifecycle.statusAfter,
            enabledAfter: nextLifecycle.enabledAfter,
            lifecycleBlockerAfter: nextLifecycle.disabledReasonAfter,
            workflowStatus: nextLifecycle.enabledAfter ? 'ready_for_matching' as const : 'excluded_from_matching' as const,
            alertGenerationReadyAfter: nextLifecycle.enabledAfter,
            caseReplayReadyAfter: nextLifecycle.enabledAfter,
            webhookDeliveryReadyAfter: nextLifecycle.enabledAfter,
            destinationReadiness: {
                schemaVersion: 'organization.webhook_alert_delivery_readiness.v1' as const,
                destinationOwnerField: 'destination.org_id' as const,
                dryRunVisibilityContract: 'organization.webhook_destination_dry_run_visibility.v1' as const,
                deliveryBlockedByLifecycle: !nextLifecycle.enabledAfter,
                blockerCode: nextLifecycle.disabledReasonAfter,
            },
            matchProvenance: {
                matchReasonCode: 'organization_watchlist_term_match' as const,
                requiredFields: [
                    'organizationId',
                    'tenantId',
                    'watchlistItemId',
                    'watchlistId',
                    'watchedEntity',
                    'matchReason',
                    'actorRef',
                    'sourceRefs',
                    'provenanceHash',
                    'workflowStatus',
                ],
                provenanceHashScope: 'organization_watchlist_item' as const,
            },
            consumerContracts: {
                alertGeneration: 'organization.watchlist_alert_generation_consumer.v1' as const,
                caseVisibility: 'organization.case_visibility_consumer.v1' as const,
                alertCasePersistence: 'organization.alert_case_bridge_persistence_receipt.v1' as const,
                webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1' as const,
                webhookAlertDeliveryReadiness: 'organization.webhook_alert_delivery_readiness.v1' as const,
                dashboardReadiness: 'organization.worker3_ui_readiness_proof.v1' as const,
                helpdeskTimeline: 'organization.recovery_support_history_bridge.v1' as const,
            },
            lifecycleCleanup: {
                cleanupRequired: !nextLifecycle.enabledAfter,
                cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup' as const,
                archivedMutationDeniedByLookup: nextLifecycle.statusAfter === 'archived',
                lookupDenialBlockerAfter: nextLifecycle.statusAfter === 'archived'
                    ? 'watchlist_not_found_or_cross_org' as const
                    : null,
                noOrphanedAlertCaseLinks: true,
                noCrossOrgLeakage: true,
            },
            noLeakFields: [
                'otherOrg.watchlistItemIds',
                'otherOrg.alertGeneratorKeys',
                'destination.secret',
                'case.evidence.rawContent',
            ],
        },
    }
}
