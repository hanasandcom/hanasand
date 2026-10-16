import type { TiActionabilityContract } from '../../search'
import type { EnrichmentGapQueueItem, PublicTiSourceHealthQueue, PublicTiSourceEnrichmentIntake } from './sourceEnrichment'
import type { GeographyHandoff, SourceCluster, PublicTiEvidencePriority } from './evidence'
import type { PublicTiActorEnrichmentCoverageExport, PublicTiActorEnrichmentConsumerReadinessReceipt, PublicTiAlertGenerationReadinessExport } from './actorReadiness'
import type { PublicTiCaseReviewIntake, PublicTiCaseReplayReadinessExport } from './caseReadiness'
import type { PublicTiOrgRelevanceProof } from './organizationRelevance'
import type { WorkflowHandoffContract, ConsumerReadinessContract } from './readiness'

export type TiActionabilityModel = {
    alertDisposition: 'ready_for_alert_review' | 'watchlist_required' | 'case_ready' | 'not_alertable' | 'needs_enrichment'
    shouldAlert: boolean
    rationale: string
    watchlist: {
        state: 'backed_matches' | 'candidate_handoff' | 'missing_terms'
        candidates: WatchlistCandidate[]
        matches: NonNullable<TiActionabilityContract['watchlistMatches']>
        endpoint: string
        payloads: Array<{ kind: WatchlistCandidate['kind']; value: string; notes: string }>
        blockers: string[]
    }
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    enrichmentGaps: NonNullable<TiActionabilityContract['enrichmentGaps']>
    enrichmentGapQueue: EnrichmentGapQueueItem[]
    geographyHandoffs: GeographyHandoff[]
    sourceClusters: SourceCluster[]
    evidencePriority: PublicTiEvidencePriority[]
    sourceHealthQueue: PublicTiSourceHealthQueue
    sourceEnrichmentIntake: PublicTiSourceEnrichmentIntake
    actorEnrichmentCoverage: PublicTiActorEnrichmentCoverageExport
    actorEnrichmentConsumerReadiness: PublicTiActorEnrichmentConsumerReadinessReceipt
    alertGenerationReadiness: PublicTiAlertGenerationReadinessExport
    caseReviewIntake: PublicTiCaseReviewIntake
    caseReplayReadiness: PublicTiCaseReplayReadinessExport
    watchlistRelevance: WatchlistRelevanceContract
    orgRelevance: PublicTiOrgRelevanceProof
    createAlertHandoff: WorkflowHandoffContract
    caseHandoff: WorkflowHandoffContract
    webhookDeliveryHandoff: WorkflowHandoffContract
    consumerReadiness: ConsumerReadinessContract
    readiness: PublicTiReadinessContract
    actionPayloads: PublicTiActionPayloadSet
    exportPayloads: {
        watchlist: TiHandoffExportPayload
        alertRebuild: TiHandoffExportPayload
        case: TiHandoffExportPayload
        webhookDelivery: TiHandoffExportPayload
        enrichment: TiHandoffExportPayload
        blockers: TiHandoffExportPayload
    }
    handoffs: {
        watchlistEndpoint: string
        alertRebuildEndpoint: string
        caseEndpoint: string
        webhookDeliveryEndpoint: string
        casePayload?: { alertId: string; title?: string; priority?: string; note?: string }
        caseBlockers: string[]
    }
}

export type PublicTiReadinessContract = {
    schemaVersion: 'ti.public_actor.readiness.v1'
    state: 'ready' | 'review' | 'degraded' | 'blocked'
    generatedAt: string
    backedIds: {
        tenantIds: string[]
        organizationIds: string[]
        watchlistIds: string[]
        watchlistItemIds: string[]
        alertIds: string[]
        caseIds: string[]
        casePaths: string[]
        captureIds: string[]
        webhookDestinationIds: string[]
    }
    blockers: PublicTiReadinessBlocker[]
}

export type PublicTiReadinessBlocker = {
    schemaVersion: 'ti.public_actor.readiness_blocker.v1'
    code: 'missing_org' | 'missing_org_watchlist' | 'missing_capture' | 'missing_alert' | 'missing_case_route' | 'missing_webhook_destination' | 'stale_provenance' | 'entitlement_blocked' | 'missing_source_provenance' | 'unavailable_contract'
    stage: 'watchlist' | 'alert' | 'case' | 'webhook' | 'source' | 'entitlement' | 'public_ti'
    ownerLane: 'org' | 'alert' | 'case' | 'webhook' | 'source' | 'entitlement' | 'public-ti'
    field: string
    detail: string
    handoff: string
    route: string
    recoverable: boolean
    source: 'public_result' | 'consumer_readiness' | 'entitlement_readiness' | 'delivery_readiness'
}

export type PublicTiActionPayloadKind = 'watchlist_add' | 'case_handoff' | 'webhook_delivery' | 'analyst_handoff_bundle' | 'source_enrichment'

export type PublicTiActionPayloadSet = {
    schemaVersion: 'ti.public_actor.action_payloads.v1'
    actorId: string
    query: string
    generatedAt: string
    payloads: {
        watchlistAdd: PublicTiActionPayload<'watchlist_add'>
        caseHandoff: PublicTiActionPayload<'case_handoff'>
        webhookDelivery: PublicTiActionPayload<'webhook_delivery'>
        analystHandoffBundle: PublicTiActionPayload<'analyst_handoff_bundle'>
        sourceEnrichment: PublicTiActionPayload<'source_enrichment'>
    }
}

export type PublicTiActionPayload<K extends PublicTiActionPayloadKind = PublicTiActionPayloadKind> = {
    schemaVersion: 'ti.public_actor.action_payload.v1'
    kind: K
    label: string
    actorId: string
    query: string
    generatedAt: string
    method: 'POST'
    route: string
    backedRoute?: string
    ready: boolean
    unavailable: boolean
    blockedBy: PublicTiReadinessBlocker[]
    body: Record<string, unknown>
    provenance: TiHandoffExportPayload['provenance']
}

export type WatchlistRelevanceContract = {
    schemaVersion: 'ti.public_actor.watchlist_relevance.v1'
    state: TiActionabilityModel['watchlist']['state']
    endpoint: string
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    candidates: WatchlistCandidate[]
    terms: Array<{ kind: WatchlistCandidate['kind']; value: string; notes: string; matched: boolean }>
    blockers: string[]
    provenance: TiHandoffExportPayload['provenance']
}

export type WatchlistCandidate = {
    kind: 'company' | 'domain' | 'vendor'
    value: string
    reason: string
    confidence: number
}

export type TiHandoffExportPayload = {
    schemaVersion: 'ti.public_actor.watchlist_handoff.v1' | 'ti.public_actor.alert_rebuild_handoff.v1' | 'ti.public_actor.case_handoff.v1' | 'ti.public_actor.webhook_delivery_handoff.v1' | 'ti.public_actor.enrichment_queue.v1' | 'ti.public_actor.blockers.v1'
    query: string
    generatedAt: string
    route: 'watchlist' | 'alert_rebuild' | 'case' | 'webhook_delivery' | 'enrichment_queue' | 'blocked_dependencies'
    method?: 'POST'
    endpoint?: string
    backedRoute?: string
    blocked: boolean
    missing: string[]
    body: Record<string, unknown>
    provenance: Array<{ sourceName: string; provenance: string; captureId?: string; confidence?: number }>
}
