import type { ReadinessProofContext } from './context.ts'
import { organizationPersistedAlertFields } from '../watchlist/dwmAlertReference.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationWatchlistAlertGenerationRef } from '../watchlist/generationReferences.ts'


export function alertUiProofSections(context: ReadinessProofContext) {
    const { input, blockers, proofOrganizationLifecycleBlockerPrefix } = context
    return {
        alertGenerationHandoff: {
            schemaVersion: 'organization.watchlist_alert_generation_handoff.v1',
            sourceContract: 'organization.watchlist_alert_generation_consumer.v1',
            route: 'organization_watchlist',
            exportRoute: 'GET /api/organizations/:id/watchlists/alert-terms',
            cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
            ...organizationTenantIdentity(input.downstreamAuthorization.organizationId, input.downstreamAuthorization.tenantId),
            activeTermCount: input.alertGenerationBridge.activeWatchlistTerms.length,
            watchlistItemIds: input.alertGenerationBridge.activeWatchlistTerms.map(term => term.watchlistItemId),
            alertGeneratorKeys: input.alertGenerationBridge.activeWatchlistTerms.map(term => organizationWatchlistAlertGenerationRef(term).dedupe.key),
            matchingInputFields: [
                'organizationId',
                'tenantId',
                'watchlistItemId',
                'termFamily',
                'normalizedTerm',
                'alertGenerationRef',
            ],
            expectedPersistedAlertFields: [...organizationPersistedAlertFields],
            expectedCaseFields: [
                'organizationId',
                'tenantId',
                'casePath',
                'watchlistItemIds',
                'allowedActions',
            ],
            dedupeKeyFields: [
                'organizationId',
                'watchlistItemId',
                'termFamily',
                'normalizedTerm',
            ],
            replaySteps: [
                'export_alert_terms',
                'match_retained_capture',
                'persist_org_alert',
                'verify_case_visibility',
                'deliver_webhook',
                'archive_cleanup',
            ],
            readinessRefs: {
                alertQueue: 'organization.alert_queue_visibility_proof.v1',
                caseAssignment: 'organization.case_assignment_readiness.v1',
                destinationOwnership: 'organization.webhook_destination_ownership_readiness.v1',
                sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1',
            },
            lifecycleBlockers: [
                ...proofOrganizationLifecycleBlockerPrefix(),
                'watchlist_paused',
                'watchlist_archived',
                'no_active_terms',
                'role_not_allowed',
            ],
            blockerCodes: Array.from(new Set([
                ...blockers,
                input.alertGenerationBridge.activeWatchlistTerms.length > 0 ? undefined : 'no_active_terms',
            ].filter(Boolean).map(String))).sort(),
            crossOrgDedupeAllowed: false,
            nonmemberEnumeration: false,
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        uiProof: {
            safeFields: [
                'organizationId',
                'tenantId',
                'counts',
                'readiness',
                'routes',
                'alertQueueProof',
                'webhookDeliveryProof',
                'memberLifecycleProof',
                'inviteLifecycleProof',
                'blockers',
                'uiProof.nonmemberEnumeration',
            ] as string[],
            redactedFields: [
                'activeTerms[].term',
                'activeTerms[].value',
                'member.userId',
                'alertGenerationRef.lifecycle.createdBy',
            ] as string[],
            nonmemberEnumeration: false,
        },
        cleanupProof: {
            cleanupIdempotent: true,
            cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
            cleanupRequiredBlocker: 'cleanup_required',
        },
    } as const
}
