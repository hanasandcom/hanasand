import type { PublicTiOrgSourceFamily } from './organizationRelevance'
import type { PublicTiReadinessBlocker } from './actionability'

export type PublicTiActorEnrichmentCoverageExport = {
    schemaVersion: 'ti.public_actor.actor_enrichment_coverage_export.v1'
    sourceContractSchemaVersion: 'ti.source_provenance_actor_enrichment_coverage_export.v1'
    query: string
    actorId: string
    generatedAt: string
    publicTiRoute: string
    receiptState: 'derived_from_public_ti' | 'backed_receipt'
    coverageRows: PublicTiActorEnrichmentCoverageRow[]
    blockers: PublicTiActorEnrichmentCoverageBlocker[]
    summary: {
        fieldCount: number
        coveredFieldCount: number
        blockedFieldCount: number
        retryableFieldCount: number
        alertableFamilyCount: number
        sourceFamilies: PublicTiOrgSourceFamily[]
        nextRetryAt?: string
    }
    consumers: Array<{
        consumer: 'publicTI' | 'alertGeneration' | 'sourceOps'
        ready: boolean
        requiredFields: string[]
        route: {
            method: 'GET' | 'POST'
            path: string
            body?: Record<string, unknown>
            dryRunSupported: true
            liveNetworkFetch: false
        }
    }>
    safeOutput: {
        rawTargetsExposed: false
        restrictedMetadataLeaked: false
        privateTelegramContentExposed: false
        liveNetworkScrapeStarted: false
    }
}

export type PublicTiActorEnrichmentCoverageRow = {
    rowId: string
    field: string
    sourceFamily: PublicTiOrgSourceFamily
    coverageState: 'covered' | 'pending' | 'retry' | 'blocked'
    parserStatus: string
    lastSuccessAt?: string
    nextRetryAt?: string
    alertableCandidates: number
    blockerCodes: PublicTiActorEnrichmentCoverageBlocker['code'][]
    provenance: {
        sourceHealthRowId: string
        sourceEnrichmentIntakeItemIds: string[]
        sourceHealthProofIds: string[]
        sourceId?: string
        sourceRequestId?: string
        captureId?: string
    }
}

export type PublicTiActorEnrichmentCoverageBlocker = {
    code: 'missing_candidate' | 'parser_retry' | 'policy_blocked' | 'coverage_pending'
    ownerLane: 'source' | 'parser' | 'policy' | 'publicTI'
    field: string
    sourceFamily: PublicTiOrgSourceFamily
    nextAction: 'request_candidate' | 'retry_parser' | 'request_policy_approval' | 'inspect_source_health'
    nextRetryAt?: string
    provenanceRef: string
}

export type PublicTiAlertGenerationReadinessExport = {
    schemaVersion: 'ti.public_actor.alert_generation_readiness_export.v1'
    sourceSchemaVersion: 'dwm.alert_generation_readiness.v1'
    query: string
    generatedAt: string
    route: '/api/findings/alerts/generation-readiness'
    sourceRoute: '/v1/dwm/alerts/generation-readiness'
    state: 'ready' | 'review' | 'blocked'
    readyForCustomerDelivery: boolean
    candidateCount: number
    captureRefCount: number
    matchedCandidateCount: number
    missingRouteCandidateCount: number
    generationEvidenceWindowReady: boolean
    generationEvidenceWindowCaptureCount: number
    generationEvidenceWindowSourceFamilies: PublicTiOrgSourceFamily[]
    latestEvidenceAt?: string
    blockers: Array<{
        code: string
        ownerLane: PublicTiReadinessBlocker['ownerLane'] | PublicTiActorEnrichmentCoverageBlocker['ownerLane']
        detail: string
    }>
    provenance: {
        watchlistTermCount: number
        watchlistMatchCount: number
        coverageExportSchemaVersion: PublicTiActorEnrichmentCoverageExport['schemaVersion']
        coverageRows: number
        sourceHealthRows: number
        sourceRequestCount: number
    }
    safeOutput: {
        metadataOnly: true
        rawEvidenceExposed: false
        webhookSecretExposed: false
        liveNetworkFetch: false
    }
}

export type PublicTiActorEnrichmentConsumerReadinessReceipt = {
    schemaVersion: 'ti.public_actor.actor_enrichment_consumer_readiness_receipt.v1'
    sourceContractSchemaVersion: 'ti.source_provenance_actor_enrichment_consumer_readiness_receipt.v1'
    query: string
    actorId: string
    generatedAt: string
    publicTiRoute: string
    actorEnrichmentCoverageSchemaVersion: PublicTiActorEnrichmentCoverageExport['schemaVersion']
    rows: PublicTiActorEnrichmentConsumerReadinessRow[]
    blockerSummary: PublicTiActorEnrichmentConsumerReadinessBlocker[]
    sourceHealth: {
        sourceFamilies: PublicTiOrgSourceFamily[]
        parserStatuses: string[]
        coveredFieldCount: number
        pendingFieldCount: number
        retryableFieldCount: number
        blockedFieldCount: number
        alertableFieldCount: number
        nextRetryAt?: string
    }
    payloadShape: string[]
    safeOutput: {
        rawTargetsExposed: false
        restrictedMetadataLeaked: false
        privateTelegramContentExposed: false
        liveNetworkScrapeStarted: false
        crossOrgDataIncluded: false
    }
}

export type PublicTiActorEnrichmentConsumerReadinessRow = {
    consumer: 'publicTI' | 'alertGeneration' | 'sourceOps'
    ready: boolean
    state: 'ready' | 'blocked' | 'action_required'
    route: string
    sourceFamilies: PublicTiOrgSourceFamily[]
    parserStatuses: string[]
    coverageCounts: {
        covered: number
        pending: number
        retryable: number
        blocked: number
        alertable: number
    }
    retry: {
        retryable: boolean
        nextRetryAt?: string
        retryFields: string[]
    }
    blockerCodes: PublicTiActorEnrichmentCoverageBlocker['code'][]
    provenanceIds: {
        actorEnrichmentCoverageSchemaVersion: PublicTiActorEnrichmentCoverageExport['schemaVersion']
        coverageRowIds: string[]
        sourceHealthProofIds: string[]
        sourceEnrichmentIntakeItemIds: string[]
    }
}

export type PublicTiActorEnrichmentConsumerReadinessBlocker = {
    code: PublicTiActorEnrichmentCoverageBlocker['code']
    consumer: PublicTiActorEnrichmentConsumerReadinessRow['consumer']
    field: string
    ownerLane: PublicTiActorEnrichmentCoverageBlocker['ownerLane']
    action: PublicTiActorEnrichmentCoverageBlocker['nextAction']
    nextRetryAt?: string
    provenanceRef: string
}
