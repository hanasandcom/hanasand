import type { OrganizationSharedWatchlistDownstreamProof } from '../contracts/downstreamProof.ts'
import type { OrganizationSharedWatchlistProvenanceSourceFamily } from '../inputTypes.ts'
import { organizationTenantIdentity } from '../identity.ts'

export function organizationSharedWatchlistEnrichmentProvenance(input: {
    organizationId: string
    activeWatchlistItemIds: string[]
    alertGeneratorKeys: string[]
    alertBlockers: string[]
}): OrganizationSharedWatchlistDownstreamProof['enrichmentProvenance'] {
    const hasWatchlistScope = input.activeWatchlistItemIds.length > 0 && input.alertGeneratorKeys.length > 0
    const requiredFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[] = ['organization_watchlist']
    const optionalFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[] = ['darkweb_metadata', 'telegram_public', 'rss_news', 'public_ti']
    const activeFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[] = hasWatchlistScope ? ['organization_watchlist'] : []
    const blockerCodes: OrganizationSharedWatchlistDownstreamProof['enrichmentProvenance']['blockerCodes'] = [
        ...(hasWatchlistScope ? [] : ['capture_provenance_missing' as const]),
        ...(input.alertBlockers.includes('no_active_terms') ? ['source_coverage_required' as const] : []),
    ]

    return {
        schemaVersion: 'organization.shared_watchlist_enrichment_provenance.v1',
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        sourceFamily: 'organization_watchlist',
        expectedAdapter: 'organizationSharedWatchlistEnrichmentProvenance',
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        sourceCoverage: {
            requiredFamilies,
            activeFamilies,
            optionalFamilies,
            sourceHealthRoute: 'GET /v1/dwm/sources/health',
            state: blockerCodes.length === 0 ? 'ready' : 'needs_source_coverage',
            blockerCodes,
        },
        sourceHealth: organizationSharedWatchlistSourceCoverageHealth({
            requiredFamilies,
            activeFamilies,
            optionalFamilies,
            blockerCodes,
        }),
        provenanceFields: {
            alert: ['provenance.captureIds', 'provenance.sourceIds', 'provenance.generatedAt', 'provenance.matchBasis', 'sourceFamily'],
            workflowContext: ['captureIds', 'selectedCaptureIds', 'sourceFamily', 'alertGeneratorKeys', 'watchlistTermContexts'],
            caseEvidence: ['evidence.provenance.captureIds', 'evidence.provenance.sourceIds', 'evidence.provenance.matchBasis', 'watchlistItemIds'],
            webhookPayload: ['captureIds', 'sourceFamily', 'casePath', 'watchlistItemIds', 'auditEventContracts'],
        },
        propagation: {
            alertRepository: 'scraper/src/storage/dwmAlertRepository.ts',
            caseRoute: 'scraper/src/api/caseRoutes.ts',
            webhookRoute: 'scraper/src/api/dwmWorkflowRoutes.ts',
            requiredCorrelationFields: ['organizationId', 'tenantId', 'watchlistItemIds', 'alertGeneratorKeys', 'captureIds', 'sourceIds', 'casePath'],
        },
        redaction: {
            containsRawContent: false,
            safeFields: ['organizationId', 'tenantId', 'sourceFamily', 'captureIds', 'sourceIds', 'watchlistItemIds', 'casePath'],
            redactedFields: ['activeTerms[].term', 'activeTerms[].value', 'evidence.rawContent', 'destination.secret'],
        },
        watchlistScope: {
            watchlistItemIds: input.activeWatchlistItemIds,
            alertGeneratorKeys: input.alertGeneratorKeys,
            crossTenantCollisionAllowed: false,
        },
        blockerCodes,
    }
}

function organizationSharedWatchlistSourceCoverageHealth(input: {
    requiredFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[]
    activeFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[]
    optionalFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[]
    blockerCodes: OrganizationSharedWatchlistDownstreamProof['enrichmentProvenance']['blockerCodes']
}): OrganizationSharedWatchlistDownstreamProof['enrichmentProvenance']['sourceHealth'] {
    const requiredEvidenceFields: OrganizationSharedWatchlistDownstreamProof['enrichmentProvenance']['sourceHealth']['rows'][number]['requiredEvidenceFields'] = [
        'sourceFamily',
        'captureIds',
        'sourceIds',
        'capturedAt',
        'contentHash',
    ]
    const families = [...new Set([...input.requiredFamilies, ...input.optionalFamilies])]
    return {
        schemaVersion: 'organization.shared_watchlist_source_coverage_health.v1',
        expectedAdapter: 'organizationSharedWatchlistSourceCoverageHealth',
        route: 'GET /v1/dwm/sources/health',
        ownerLane: 'source_operations',
        state: input.blockerCodes.length === 0 ? 'ready' : 'needs_source_coverage',
        rows: families.map(sourceFamily => {
            const required = input.requiredFamilies.includes(sourceFamily)
            const active = input.activeFamilies.includes(sourceFamily)
            return {
                sourceFamily,
                required,
                active,
                status: active ? 'covered' : required ? 'missing' : 'optional',
                requiredEvidenceFields,
                blockerCodes: active || !required ? [] : input.blockerCodes,
            }
        }),
        redaction: {
            containsRawContent: false,
            safeFields: ['sourceFamily', 'active', 'status', 'captureIds', 'sourceIds', 'contentHash'],
            redactedFields: ['rawContent', 'activeTerms[].term', 'destination.secret'],
        },
        blockerCodes: input.blockerCodes,
    }
}
