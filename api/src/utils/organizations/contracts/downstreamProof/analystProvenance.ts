import type { OrganizationAlertCaseRole, OrganizationSharedWatchlistAnalystPortalAction, OrganizationSharedWatchlistAuditEventAction, OrganizationSharedWatchlistProvenanceSourceFamily } from '../../inputTypes.ts'
import type { OrganizationRole } from '../../../organizationRoles.ts'

export type OrganizationSharedWatchlistDownstreamProofAnalystProvenance = {
    analystPortalWorkflow: {
        schemaVersion: 'organization.shared_watchlist_analyst_portal_workflow.v1'
        organizationId: string
        tenantId: string
        sourceFamily: 'organization_watchlist'
        expectedAdapter: 'organizationSharedWatchlistAnalystPortalWorkflow'
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
        queueContract: {
            route: 'GET /v1/dwm/alerts'
            requiredQueryFields: Array<'organizationId'>
            storageModule: 'scraper/src/storage/dwmAlertRepository.ts'
            itemFields: Array<'alertId' | 'organizationId' | 'watchlistItemIds' | 'severity' | 'status' | 'casePath' | 'updatedAt' | 'allowedActions'>
            state: 'ready' | 'blocked'
            blockerCodes: string[]
        }
        detailContract: {
            route: 'GET /v1/dwm/alerts/:id'
            evidenceFields: Array<'capturedAt' | 'source' | 'watchlistItemIds' | 'alertGeneratorKeys' | 'casePath' | 'workflowEvents' | 'audit.eventBridge'>
            redactedFields: Array<'activeTerms[].term' | 'activeTerms[].value' | 'case.evidence.rawContent' | 'destination.secret'>
            containsRawTerms: false
        }
        actionContracts: Array<{
            action: OrganizationSharedWatchlistAnalystPortalAction
            route: string
            method: 'GET' | 'POST' | 'PATCH'
            requiredRoles: OrganizationAlertCaseRole[]
            allowed: boolean
            requiredPayloadFields: string[]
            auditEventActions: OrganizationSharedWatchlistAuditEventAction[]
            blockerCodes: string[]
        }>
        roleGate: {
            actorRole: OrganizationRole
            readAlertsAllowed: boolean
            mutateAllowed: boolean
            caseActionsAllowed: boolean
            webhookDeliveryAllowed: boolean
        }
        blockerCodes: string[]
    }
    enrichmentProvenance: {
        schemaVersion: 'organization.shared_watchlist_enrichment_provenance.v1'
        organizationId: string
        tenantId: string
        sourceFamily: 'organization_watchlist'
        expectedAdapter: 'organizationSharedWatchlistEnrichmentProvenance'
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
        sourceCoverage: {
            requiredFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[]
            activeFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[]
            optionalFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[]
            sourceHealthRoute: 'GET /v1/dwm/sources/health'
            state: 'ready' | 'needs_source_coverage'
            blockerCodes: Array<'source_coverage_required' | 'capture_provenance_missing'>
        }
        sourceHealth: {
            schemaVersion: 'organization.shared_watchlist_source_coverage_health.v1'
            expectedAdapter: 'organizationSharedWatchlistSourceCoverageHealth'
            route: 'GET /v1/dwm/sources/health'
            ownerLane: 'source_operations'
            state: 'ready' | 'needs_source_coverage'
            rows: Array<{
                sourceFamily: OrganizationSharedWatchlistProvenanceSourceFamily
                required: boolean
                active: boolean
                status: 'covered' | 'optional' | 'missing'
                requiredEvidenceFields: Array<'sourceFamily' | 'captureIds' | 'sourceIds' | 'capturedAt' | 'contentHash'>
                blockerCodes: Array<'source_coverage_required' | 'capture_provenance_missing'>
            }>
            redaction: {
                containsRawContent: false
                safeFields: Array<'sourceFamily' | 'active' | 'status' | 'captureIds' | 'sourceIds' | 'contentHash'>
                redactedFields: Array<'rawContent' | 'activeTerms[].term' | 'destination.secret'>
            }
            blockerCodes: Array<'source_coverage_required' | 'capture_provenance_missing'>
        }
        provenanceFields: {
            alert: Array<'provenance.captureIds' | 'provenance.sourceIds' | 'provenance.generatedAt' | 'provenance.matchBasis' | 'sourceFamily'>
            workflowContext: Array<'captureIds' | 'selectedCaptureIds' | 'sourceFamily' | 'alertGeneratorKeys' | 'watchlistTermContexts'>
            caseEvidence: Array<'evidence.provenance.captureIds' | 'evidence.provenance.sourceIds' | 'evidence.provenance.matchBasis' | 'watchlistItemIds'>
            webhookPayload: Array<'captureIds' | 'sourceFamily' | 'casePath' | 'watchlistItemIds' | 'auditEventContracts'>
        }
        propagation: {
            alertRepository: 'scraper/src/storage/dwmAlertRepository.ts'
            caseRoute: 'scraper/src/api/caseRoutes.ts'
            webhookRoute: 'scraper/src/api/dwmWorkflowRoutes.ts'
            requiredCorrelationFields: Array<'organizationId' | 'tenantId' | 'watchlistItemIds' | 'alertGeneratorKeys' | 'captureIds' | 'sourceIds' | 'casePath'>
        }
        redaction: {
            containsRawContent: false
            safeFields: Array<'organizationId' | 'tenantId' | 'sourceFamily' | 'captureIds' | 'sourceIds' | 'watchlistItemIds' | 'casePath'>
            redactedFields: Array<'activeTerms[].term' | 'activeTerms[].value' | 'evidence.rawContent' | 'destination.secret'>
        }
        watchlistScope: {
            watchlistItemIds: string[]
            alertGeneratorKeys: string[]
            crossTenantCollisionAllowed: false
        }
        blockerCodes: Array<'source_coverage_required' | 'capture_provenance_missing'>
    }

}
