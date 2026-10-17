import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationRow } from '../rowTypes.ts'
import type { OrganizationWatchlistAlertTermsExport } from '../contracts/watchlistExport.ts'
import type { OrganizationWatchlistAlertGenerationContract } from '../contracts/alertGeneration.ts'
import type { OrganizationSharedWatchlistIntegrationGuardrails } from '../contracts/integrationGuardrails.ts'
import type { organizationAlertCaseWorkflowState } from './caseWorkflowState.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationWatchlistMatchProvenanceHash, organizationWatchlistMatchProjection } from './generationReferences.ts'

export type BuildOrganizationAlertGenerationConsumerInput = {
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'status' | 'member_count' | 'owner_count' | 'admin_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy' | 'role'>
    member: { userId: string, role: OrganizationRole }
    activeTerms: OrganizationWatchlistAlertTermsExport['activeTerms']
    termLifecycle: OrganizationWatchlistAlertTermsExport['termLifecycle']
    alertGeneration: OrganizationWatchlistAlertGenerationContract
    sharedWatchlistAlertQueueVisibility: OrganizationWatchlistAlertTermsExport['sharedWatchlistAlertQueueVisibility']
    sharedWatchlistIntegrationGuardrails: OrganizationSharedWatchlistIntegrationGuardrails
    webhookDestinationAccessDecision: OrganizationWatchlistAlertTermsExport['webhookDestinationAccessDecision']
    webhookDestinationOwnership: ReturnType<typeof organizationAlertCaseWorkflowState>['webhookDestinationOwnership']
    canManageWebhookDestinations: boolean
}

export function buildOrganizationMatchingInputReceipt(input: BuildOrganizationAlertGenerationConsumerInput): OrganizationWatchlistAlertTermsExport['alertGenerationConsumer']['matchingInputReceipt'] {
    const { organization, member, activeTerms, termLifecycle, alertGeneration, sharedWatchlistIntegrationGuardrails, webhookDestinationAccessDecision, webhookDestinationOwnership, canManageWebhookDestinations } = input
    return {
        schemaVersion: 'organization.watchlist_alert_matching_input.v1',
        ...organizationTenantIdentity(organization.id, organization.id),
        sourceFamily: 'organization_watchlist',
        matchingRoute: 'organization_watchlist',
        termCount: activeTerms.length,
        requiredMatcherFields: [
            'organizationId',
            'tenantId',
            'watchlistId',
            'watchlistItemId',
            'termFamily',
            'normalizedTerm',
            'watchedEntity',
            'matchReason',
            'actorRef',
            'sourceRefs',
            'provenanceHash',
            'provenance',
            'workflowReadiness',
            'destinationReadiness',
            'alertGeneratorKey',
            'alertGenerationRef',
        ],
        dedupeKeyFields: ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'],
        terms: activeTerms.map(term => {
            const provenanceHash = organizationWatchlistMatchProvenanceHash(term)
            const workflowBlockerCodes = Array.from(new Set([
                ...alertGeneration.blockedReasons,
                ...sharedWatchlistIntegrationGuardrails.caseSafety.blockerCodes,
                ...webhookDestinationAccessDecision.blockerCodes,
            ].map(String)))
            const matchProjection = organizationWatchlistMatchProjection(term, member)

            return {
                ...organizationTenantIdentity(term.organizationId, term.tenantId),
                watchlistId: term.watchlistItemId,
                watchlistItemId: term.watchlistItemId,
                termFamily: term.termFamily,
                watchedEntity: matchProjection.watchedEntity,
                matchReason: {
                    kind: 'shared_watchlist_term',
                    code: 'organization_watchlist_term_match',
                    field: 'watchedEntity.normalizedValue',
                },
                actorRef: matchProjection.actorRef,
                sourceRefs: matchProjection.sourceRefs,
                normalizedTerm: term.alertGenerationRef.normalizedTerm,
                alertGeneratorKey: term.alertGeneratorKey,
                provenanceHash,
                status: 'active',
                workflowReadiness: {
                    schemaVersion: 'organization.watchlist_match_workflow_readiness.v1',
                    alertGenerationReady: alertGeneration.canGenerateAlerts,
                    caseReplayReady: sharedWatchlistIntegrationGuardrails.caseSafety.ok,
                    destinationDeliveryReady: webhookDestinationAccessDecision.blockerCodes.length === 0,
                    route: 'organization_watchlist',
                    caseVisibilityRoute: 'GET /api/organizations/:id/alert-case-visibility',
                    blockerCodes: workflowBlockerCodes,
                },
                destinationReadiness: {
                    schemaVersion: 'organization.watchlist_match_destination_readiness.v1',
                    webhookDestinationOwnership: webhookDestinationOwnership.schemaVersion,
                    webhookDestinationAccessDecision: webhookDestinationAccessDecision.schemaVersion,
                    selectedDestinationOrgField: webhookDestinationOwnership.selectedDestinationOrgField,
                    selectedDestinationIdField: webhookDestinationOwnership.selectedDestinationIdField,
                    dryRunVisibility: {
                        allowed: canManageWebhookDestinations,
                        allowedRoles: ['owner', 'admin'],
                        deniedRoles: ['reader', 'member', 'viewer'],
                        redactedFields: ['destination.secret', 'destination.endpoint'],
                    },
                    blockerCodes: webhookDestinationAccessDecision.blockerCodes,
                },
                provenance: {
                    schemaVersion: 'organization.watchlist_match_provenance.v1',
                    ...organizationTenantIdentity(term.organizationId, term.tenantId),
                    watchlistId: term.watchlistItemId,
                    watchlistItemId: term.watchlistItemId,
                    alertGeneratorKey: term.alertGeneratorKey,
                    provenanceHash,
                    createdBy: term.createdBy,
                    updatedBy: term.updatedBy,
                    lifecycleRequestId: term.lifecycleRequestId,
                    matchBasis: 'normalized_watchlist_term',
                    caseReplayFields: [
                        'organizationId',
                        'tenantId',
                        'watchlistId',
                        'watchlistItemId',
                        'watchedEntity',
                        'matchReason',
                        'alertGeneratorKey',
                        'provenanceHash',
                        'provenance',
                        'workflowReadiness',
                        'destinationReadiness',
                    ],
                },
                alertGenerationRef: term.alertGenerationRef,
            }
        }),
        lifecycleExclusions: {
            pausedItemIds: termLifecycle.pausedItemIds,
            archivedItemIds: termLifecycle.archivedItemIds,
            deletedTermIds: termLifecycle.deletedTermIds,
            excludedStatuses: ['paused', 'archived'],
        },
        scopeGuardrails: {
            partitionKey: 'organizationId',
            crossOrgReadAllowed: false,
            userLocalFallbackAllowed: false,
            nonmemberEnumeration: false,
        },
        noLeakFields: [
            'otherOrg.watchlistItemIds',
            'otherOrg.alertGeneratorKeys',
            'destination.secret',
        ],
    }
}
