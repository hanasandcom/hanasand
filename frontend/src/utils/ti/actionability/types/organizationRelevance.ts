import type { PublicTiReadinessBlocker } from './actionability'

export type PublicTiOrgRelevanceProof = {
    schemaVersion: 'ti.public_actor.org_relevance.v1'
    state: 'ready' | 'review' | 'blocked'
    actorId: string
    query: string
    generatedAt: string
    freshness: {
        generatedAt: string
        lastSeen: string
        stale: boolean
        reason: string
    }
    actorIdentity: PublicTiActorIdentity
    sourceCoverage: PublicTiOrgSourceCoverage[]
    enrichmentGaps: PublicTiOrgRelevanceEnrichmentGap[]
    watchlistIntersections: PublicTiOrgWatchlistIntersection[]
    organizationRefs: Array<{
        tenantId?: string
        organizationId?: string
        watchlistId?: string
        watchlistItemId?: string
        kind: 'company' | 'domain' | 'vendor'
        value: string
        route?: string
        casePath?: string
    }>
    candidateTerms: Array<{
        kind: 'company' | 'domain' | 'vendor'
        value: string
        notes: string
        matched: boolean
        sourceEvidenceRefs: string[]
    }>
    sourceEvidence: Array<{
        sourceId?: string
        sourceName: string
        provenance: string
        reportDate?: string
        captureId?: string
        sourceRequestId?: string
        sourceFamily?: PublicTiOrgSourceFamily
        parserStatus?: string
        lastCollectedAt?: string
        confidence?: number
        supportsTerms: string[]
        shownBecause: string
    }>
    alertCaseRefs: Array<{
        alertId: string
        casePath?: string
        caseIdCandidate?: string
        organizationId?: string
        tenantId?: string
        captureIds: string[]
        webhookDestinationIds: string[]
    }>
    affectedEntities: {
        vendors: PublicTiAffectedEntity[]
        domains: PublicTiAffectedEntity[]
        regions: PublicTiAffectedEntity[]
    }
    handoffRows: PublicTiOrgRelevanceRow[]
    handoffRoutes: {
        watchlist: '/v1/dwm/watchlists'
        alertRebuild: '/v1/dwm/alerts/rebuild'
        case: '/v1/cases'
        webhookDelivery: '/v1/dwm/webhooks/deliver'
    }
    blockers: PublicTiReadinessBlocker[]
}

export type PublicTiOrgSourceFamily = 'actor_profile' | 'source_capture' | 'watchlist' | 'alert' | 'case' | 'geography' | 'indicator' | 'vendor_disclosure' | 'webhook' | 'public_ti'

export type PublicTiActorIdentity = {
    canonicalName: string
    aliases: string[]
    actorClass: string
    sectors: string[]
    regions: string[]
    motivations: string[]
}

export type PublicTiOrgSourceCoverage = {
    sourceId?: string
    sourceName: string
    sourceFamily: PublicTiOrgSourceFamily
    provenance: string
    captureId?: string
    sourceRequestId?: string
    parserStatus?: string
    confidence?: number
    status: 'capture_ready' | 'public_reference' | 'missing_capture'
    lastCollectedAt?: string
    supportsTerms: string[]
}

export type PublicTiOrgRelevanceEnrichmentGap = {
    code: 'missing_actor_aliases' | 'missing_target_sectors' | 'missing_target_regions' | 'missing_source_coverage' | 'missing_provenance' | 'stale_evidence'
    ownerLane: PublicTiReadinessBlocker['ownerLane']
    field: string
    detail: string
    route: string
    sourceFamily: PublicTiOrgSourceFamily
    recoverable: boolean
}

export type PublicTiOrgWatchlistIntersection = {
    intersectionId: string
    kind: 'company' | 'domain' | 'vendor'
    value: string
    state: 'ready' | 'review' | 'blocked'
    tenantId?: string
    organizationId?: string
    watchlistId?: string
    watchlistItemId?: string
    route: string
    casePath?: string
    sourceEvidenceRefs: string[]
    sourceFamilies: PublicTiOrgSourceFamily[]
    alertIds: string[]
    caseIds: string[]
    casePaths: string[]
    captureIds: string[]
    webhookDestinationIds: string[]
    recommendedAction: 'open_watchlist_item' | 'persist_watchlist_item' | 'rebuild_alerts' | 'open_case' | 'attach_source_evidence'
    blockers: PublicTiReadinessBlocker[]
}

export type PublicTiAffectedEntity = {
    kind: 'vendor' | 'domain' | 'region'
    value: string
    matched: boolean
    sourceFamily: PublicTiOrgSourceFamily
    provenanceRefs: string[]
    watchlistItemIds: string[]
    alertIds: string[]
}

export type PublicTiOrgRelevanceEvidence = {
    sourceId?: string
    sourceName?: string
    provenance?: string
    reportDate?: string
    captureId?: string
    sourceRequestId?: string
    sourceFamily?: PublicTiOrgSourceFamily
    parserStatus?: string
    lastCollectedAt?: string
    confidence?: number
    summary: string
}

export type PublicTiOrgRelevanceRow = {
    rowId: string
    kind: 'watchlist_match' | 'candidate_term' | 'source_evidence' | 'alert_case' | 'webhook_delivery' | 'enrichment_gap'
    state: 'ready' | 'review' | 'blocked'
    ownerLane: PublicTiReadinessBlocker['ownerLane']
    label: string
    action: string
    route: string
    sourceFamily: PublicTiOrgSourceFamily
    provenanceRefs: string[]
    tenantId?: string
    organizationId?: string
    watchlistId?: string
    watchlistItemId?: string
    alertId?: string
    casePath?: string
    captureIds: string[]
    webhookDestinationIds: string[]
    evidence: PublicTiOrgRelevanceEvidence
    blockers: PublicTiReadinessBlocker[]
}
