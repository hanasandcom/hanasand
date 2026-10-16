import type { TiSearchResponse } from './search'

export type TiActorSourceProvenance = {
    sourceId?: string
    sourceName: string
    provenance: string
    reportDate?: string
    captureId?: string
    sourceRequestId?: string
    sourceFamily?: string
    parserStatus?: string
    lastCollectedAt?: string
    confidence?: number
    shownBecause: string
}

export type TiActorSourceCoverage = {
    totalRows: number
    datedRows: number
    captureRows: number
    sourceIds: string[]
    sourceFamilies: Array<{ family: string; count: number }>
    latestReportDate?: string
    stale: boolean
    missing: string[]
}

export type TiActorTechniqueCoverage = {
    attackId?: string
    name: string
    tactic: string
    detail: string
    confidence: number
    sourceIds: string[]
    captureIds: string[]
    provenanceRefs: string[]
    freshness: 'ready' | 'review'
    missing: string[]
}

export type TiActorCampaignTimelineItem = {
    title: string
    firstReportedAt: string
    sourceIds: string[]
    provenanceRefs: string[]
    affectedSectors: string[]
    countries: string[]
    confidence: number
    freshness: 'ready' | 'review'
    missing: string[]
}

export type TiActorIntelligenceProfile = {
    actorClass: string
    attribution: string
    firstSeen: string
    lastSeen: string
    motivation: string[]
    malwareTools: string[]
    campaigns: string[]
    campaignTimeline: TiActorCampaignTimelineItem[]
    infrastructure: string[]
    indicators: string[]
    techniqueCoverage: TiActorTechniqueCoverage[]
    targetSectors: string[]
    geographies: string[]
    confidence: number
    confidenceReasoning: string[]
    sourceProvenance: string[]
    updateTimeline: NonNullable<NonNullable<TiSearchResponse['actorIntelligence']>['updateTimeline']>
    provenanceRows: TiActorSourceProvenance[]
    sourceCoverage: TiActorSourceCoverage
    freshness: { generatedAt: string; lastSeen: string; stale: boolean; reason: string }
}
