import type { PublicTiOrgSourceFamily } from './organizationRelevance'
import type { PublicTiReadinessBlocker } from './actionability'

export type EnrichmentGapQueueItem = {
    id: string
    title: string
    severity: 'high' | 'medium' | 'low'
    detail: string
    dependency: string
    route: string
    sourceFamily: 'actor_profile' | 'source_capture' | 'watchlist' | 'alert' | 'case' | 'geography' | 'indicator'
    requestedFields: string[]
}

export type PublicTiSourceHealthQueue = {
    schemaVersion: 'ti.public_actor.source_health_queue.v1'
    query: string
    generatedAt: string
    rows: PublicTiSourceHealthRow[]
    summary: {
        total: number
        ready: number
        review: number
        blocked: number
    }
}

export type PublicTiSourceHealthRow = {
    id: string
    sourceName: string
    sourceFamily: PublicTiOrgSourceFamily
    provenance: string
    timestamp: string
    parserStatus: string
    state: 'ready' | 'review' | 'blocked'
    confidence?: number
    captureId?: string
    sourceRequestId?: string
    sourceId?: string
    route: string
    requestedFields: string[]
    ownerLane: PublicTiReadinessBlocker['ownerLane']
    nextAction: string
}

export type PublicTiSourceEnrichmentIntake = {
    schemaVersion: 'ti.public_actor.source_enrichment_intake.v1'
    query: string
    generatedAt: string
    route: '/ti/profiles'
    items: PublicTiSourceEnrichmentIntakeItem[]
    summary: {
        total: number
        ready: number
        review: number
        blocked: number
        sourceRequests: number
        captures: number
    }
}

export type PublicTiSourceEnrichmentIntakeItem = {
    schemaVersion: 'ti.public_actor.source_enrichment_intake_item.v1'
    id: string
    sourceHealthRowId: string
    sourceName: string
    sourceFamily: PublicTiOrgSourceFamily
    state: PublicTiSourceHealthRow['state']
    route: string
    ownerLane: PublicTiReadinessBlocker['ownerLane']
    sourceId?: string
    sourceRequestId?: string
    captureId?: string
    requestedFields: string[]
    evidence: {
        provenance: string
        timestamp: string
        confidence?: number
        parserStatus: string
    }
    blockedBy: PublicTiReadinessBlocker[]
    recommendedAction: 'inspect_capture' | 'track_source_request' | 'attach_capture' | 'refresh_source' | 'queue_enrichment'
    nextAction: string
}
