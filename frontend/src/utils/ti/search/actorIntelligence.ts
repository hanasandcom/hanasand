import type { TiBusinessModelAssessment } from './businessModel'

export interface TiActorIntelligenceContract {
    actorClass?: string
    attribution?: string
    firstSeen?: string
    lastSeen?: string
    motivation?: string[]
    malwareTools?: string[]
    campaigns?: string[]
    infrastructure?: string[]
    indicators?: string[]
    targetSectors?: string[]
    geographies?: string[]
    confidence?: number
    confidenceReasoning?: string[]
    sourceProvenance?: string[]
    missingFields?: string[]
    businessModel?: TiBusinessModelAssessment
    attributionEvidence?: {
        sourceId?: string
        sourceName: string
        provenance: string
        reportDate?: string
        captureId?: string
    }
    updateTimeline?: Array<{
        updatedAt: string
        changes: Array<{
            field: string
            previousValue?: unknown
            newValue?: unknown
            sourceId?: string
            captureId?: string
            publishedAt?: string
            collectedAt?: string
            assertionKind?: 'extracted' | 'inferred' | string
            confidence?: number
        }>
        sourceId?: string
        sourceName?: string
        sourceUrl?: string
        captureIds?: string[]
        confidence?: number
        assertionKind?: 'extracted' | 'inferred' | string
    }>
    structuredProvenance?: Array<{
        sourceId?: string
        sourceName: string
        provenance: string
        reportDate?: string
        captureId?: string
        sourceRequestId?: string
        sourceFamily?: 'actor_profile' | 'source_capture' | 'watchlist' | 'alert' | 'case' | 'geography' | 'indicator' | 'vendor_disclosure' | 'webhook' | 'public_ti'
        parserStatus?: 'parsed' | 'partial' | 'queued' | 'failed' | 'missing_capture' | 'public_reference'
        lastCollectedAt?: string
        confidence?: number
        shownBecause: string
    }>
}
