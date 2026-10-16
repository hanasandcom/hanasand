import type { TiActorIdentityMatch } from './actorIdentity'
import type { TiActorIntelligenceContract } from './actorIntelligence'
import type { TiActorCaseStudyCatalog } from './actorCaseStudies'
import type { TiResultState } from './resultState'
import type { TiClaimAssessment, TiIncidentAssessment, TiEvidenceAssessment } from './evidence'
import type { TiActionabilityContract } from './actionability'
import type { TiCollectionStrategy } from './collectionStrategy'
import type { TiOperationalStatus, TiAnalystLoop } from './operations'

export interface TiSearchResponse {
    query: string
    queryKind?: 'actor' | 'domain' | 'cve' | 'indicator' | 'organization' | 'free_text'
    generatedAt: string
    mode: 'scraper' | 'seeded' | 'live_search' | 'unavailable'
    cacheStatus?: 'hit' | 'miss'
    status?: TiResultState
    runId?: string
    refreshAfterSeconds?: number
    summary: string
    confidence: number
    lastSeen?: string
    aliases: string[]
    recentActivity: Array<{
        date: string
        title: string
        detail: string
        confidence: number
        sourceIds: string[]
        url?: string
        claimType?: 'campaign' | 'victim_claim' | 'malware_activity' | 'vulnerability_exploitation' | 'infrastructure_activity' | 'general_activity'
        victimName?: string
        affectedSectors?: string[]
        countries?: string[]
        impact?: string
        firstReportedAt?: string
        lastReportedAt?: string
        publisherCount?: number
        corroboratingSourceIds?: string[]
        contradictingSourceIds?: string[]
        assertionKind?: 'source_claim'
        reviewState?: string
        corroborationState?: string
        observationSummary?: string
    }>
    claims?: TiClaimAssessment[]
    incidents?: TiIncidentAssessment[]
    evidenceAssessment?: TiEvidenceAssessment
    targets: Array<{
        sector: string
        regions: string[]
        rationale: string
        confidence: number
    }>
    ttps: Array<{
        name: string
        attackId?: string
        tactic: string
        detail: string
        confidence: number
        sourceIds?: string[]
        captureIds?: string[]
        reviewState?: string
        extractionMethod?: string
        extractorVersion?: string
    }>
    datasets: Array<{
        name: string
        type: string
        coverage: string
        status: string
        url?: string
    }>
    sources: Array<{
        id: string
        name: string
        type: string
        provenance?: string
        url?: string
        captureId?: string
        sourceRequestId?: string
        sourceFamily?: NonNullable<NonNullable<TiActionabilityContract['sourceProvenance']>[number]['sourceFamily']>
        parserStatus?: NonNullable<NonNullable<TiActionabilityContract['sourceProvenance']>[number]['parserStatus']>
        reportDate?: string
        lastCollectedAt?: string
    }>
    notes: string[]
    operationalStatus?: TiOperationalStatus
    analystLoop?: TiAnalystLoop
    collectionStrategy?: TiCollectionStrategy
    actorIntelligence?: TiActorIntelligenceContract
    actorCaseStudies?: TiActorCaseStudyCatalog
    actorIdentity?: TiActorIdentityMatch
    actionability?: TiActionabilityContract
}
