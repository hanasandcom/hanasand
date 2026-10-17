import type { OrganizationWatchlistAlertTermsExport } from '../contracts/watchlistExport.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { buildOrganizationMatchingInputReceipt, type BuildOrganizationAlertGenerationConsumerInput } from './matchingInputReceipt.ts'

export function buildOrganizationAlertGenerationConsumer(input: BuildOrganizationAlertGenerationConsumerInput): OrganizationWatchlistAlertTermsExport['alertGenerationConsumer'] {
    const { organization, activeTerms, termLifecycle, alertGeneration, sharedWatchlistAlertQueueVisibility } = input
    return {
        schemaVersion: 'organization.watchlist_alert_generation_consumer.v1',
        ...organizationTenantIdentity(organization.id, organization.id),
        repositoryAdapter: 'organizationWatchlistAlertTermsExport',
        sourceFamily: 'organization_watchlist',
        route: 'GET /api/organizations/:id/watchlists/alert-terms',
        requiredQueryFields: ['organizationId'],
        requiredPersistedFields: [
            'organizationId',
            'tenantId',
            'watchlistItemId',
            'watchlistItemIds',
            'workflowContext.organizationId',
            'workflowContext.alertGeneratorKeys',
            'workflowContext.visibilityDecision',
        ],
        activeTerms: activeTerms.map(term => ({
            ...organizationTenantIdentity(term.organizationId, term.tenantId),
            watchlistItemId: term.watchlistItemId,
            itemId: term.itemId,
            termFamily: term.termFamily,
            category: term.category,
            term: term.term,
            normalizedTerm: term.alertGenerationRef.normalizedTerm,
            status: 'active',
            alertGeneratorKey: term.alertGeneratorKey,
            alertGenerationRef: term.alertGenerationRef,
        })),
        lifecycleExclusions: termLifecycle,
        scopeGuardrails: {
            partitionKey: 'organizationId',
            tenantIdField: 'tenantId',
            watchlistScope: 'organization_owned',
            crossOrgReadAllowed: false,
            userLocalFallbackAllowed: false,
            nonmemberEnumeration: false,
        },
        roleGates: {
            exportTerms: sharedWatchlistAlertQueueVisibility.visibility.allowedRoles,
            mutateWatchlists: ['owner', 'admin', 'editor'],
            readSharedWatchlists: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
        },
        denialContract: {
            nonmember: 'organization.access_denial.v1',
            roleDenied: 'organization.watchlist_alert_terms_export_denial.v1',
            removedMember: 'member_revoked',
            noLeakFields: [
                'activeTerms[]',
                'activeWatchlistTerms[]',
                'watchlistScope.alertGeneratorKeys',
                'otherOrg.watchlistItemIds',
            ],
        },
        matchingInputReceipt: buildOrganizationMatchingInputReceipt(input),
        canGenerateAlerts: alertGeneration.canGenerateAlerts,
        blockerCodes: Array.from(new Set([
            ...alertGeneration.blockedReasons,
            ...termLifecycle.excludedFromAlertMatching.map(item => item.blockerCode),
        ])),
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
}
