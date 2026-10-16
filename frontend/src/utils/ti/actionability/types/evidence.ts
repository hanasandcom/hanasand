import type { WatchlistCandidate, PublicTiReadinessBlocker } from './actionability'

export type GeographyHandoff = {
    code: string
    country: string
    role: 'operator' | 'target'
    observationCount: number
    watchlistTerm?: { kind: WatchlistCandidate['kind']; value: string; reason: string }
    enrichmentTask: string
    provenanceSummary: string
    evidenceRows: Array<{
        victim: string
        source: string
        sourceIds: string[]
        provenanceRefs: string[]
        reportDate?: string
        confidence: number
    }>
}

export type SourceCluster = {
    sourceName: string
    provenance: string
    captureId?: string
    confidence?: number
    watchlistTerm?: { kind: WatchlistCandidate['kind']; value: string; reason: string }
    enrichmentTask: string
}

export type PublicTiEvidencePriority = {
    schemaVersion: 'ti.public_actor.evidence_priority.v1'
    rowId: string
    label: string
    score: number
    state: 'ready' | 'review' | 'blocked'
    reasons: string[]
    nextAction: string
    route?: string
    sourceIds: string[]
    captureIds: string[]
    alertIds: string[]
    casePaths: string[]
    watchlistTerms: string[]
    blockers: PublicTiReadinessBlocker[]
}
