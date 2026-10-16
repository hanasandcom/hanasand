import { type CaseReviewIntakeItem, type SelectedCaseSourceRow } from './source'
import { type SelectedWatchlistPlan } from './watchlistPlan'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import type { TiSafeOutputMetadata } from '../safeOutput'

export type SelectedCaseCreateRequest = {
    schemaVersion: 'ti.public_actor.selected_case_create_request.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    ready: boolean
    state: 'ready' | 'review' | 'blocked'
    route: string
    nextAction: string
    request: {
        method: 'POST'
        path: string
        body: Record<string, unknown>
    }
    sourceRows: SelectedCaseSourceRow[]
    refs: {
        alertIds: string[]
        captureIds: string[]
        casePaths: string[]
        sourceIds: string[]
        watchTerms: string[]
    }
    actorContext: {
        actorClass: string
        attribution: string
        aliases: string[]
        motivation: string[]
        targetSectors: string[]
        geographies: string[]
        malwareTools: string[]
        campaigns: string[]
        infrastructure: string[]
        indicators: string[]
        confidence: number
        confidenceReasoning: string[]
        freshness: TiActorIntelligenceProfile['freshness']
        sourceCoverage: Pick<TiActorIntelligenceProfile['sourceCoverage'], 'totalRows' | 'datedRows' | 'captureRows' | 'latestReportDate' | 'stale' | 'missing'>
        techniques: Array<{
            attackId?: string
            name: string
            tactic: string
            confidence: number
            freshness: TiActorIntelligenceProfile['techniqueCoverage'][number]['freshness']
            sourceIds: string[]
            captureIds: string[]
            provenanceRefs: string[]
            missing: string[]
        }>
        campaignTimeline: Array<{
            title: string
            firstReportedAt: string
            confidence: number
            freshness: TiActorIntelligenceProfile['campaignTimeline'][number]['freshness']
            sourceIds: string[]
            provenanceRefs: string[]
            affectedSectors: string[]
            countries: string[]
            missing: string[]
        }>
        enrichmentGaps: Array<{
            id: string
            title: string
            severity: TiActionabilityModel['enrichmentGapQueue'][number]['severity']
            route: string
            sourceFamily: TiActionabilityModel['enrichmentGapQueue'][number]['sourceFamily']
            requestedFields: string[]
        }>
        sourceRefs: {
            sourceIds: string[]
            captureIds: string[]
            provenanceRefs: string[]
            sourceRequestIds: string[]
        }
    }
    watchlistBasis: {
        state: SelectedWatchlistPlan['state']
        ready: boolean
        route: string
        matchReason: string
        terms: Array<{
            kind: SelectedWatchlistPlan['terms'][number]['kind']
            value: string
            matched: boolean
        }>
        relevanceRows: Array<{
            kind: SelectedWatchlistPlan['relevanceRows'][number]['kind']
            value: string
            fit: SelectedWatchlistPlan['relevanceRows'][number]['fit']
            alertable: boolean
            route: string
            evidenceRefs: string[]
            sourceFamilies: string[]
            blockerOwners: SelectedWatchlistPlan['relevanceRows'][number]['blockerOwners']
            nextAction: string
        }>
        intersections: Array<{
            intersectionId: string
            value: string
            state: SelectedWatchlistPlan['intersections'][number]['state']
            route: string
            organizationId?: string
            watchlistId?: string
            watchlistItemId?: string
            alertIds: string[]
            casePaths: string[]
            captureIds: string[]
            sourceEvidenceRefs: string[]
            recommendedAction: SelectedWatchlistPlan['intersections'][number]['recommendedAction']
        }>
        blockers: string[]
    }
    actionReplay: {
        schemaVersion: TiActionabilityModel['caseReplayReadiness']['schemaVersion']
        sourceSchemaVersion: string
        routeTemplate: TiActionabilityModel['caseReplayReadiness']['routeTemplate']
        ready: boolean
        rows: Array<{
            caseReviewIntakeItemId: string
            evidenceRowId: string
            ready: boolean
            exportRoute?: string
            caseId?: string
            alertIds: string[]
            captureIds: string[]
            sourceIds: string[]
            blockerCodes: string[]
            provenanceFingerprints: string[]
        }>
    }
    caseReviewRows: Array<{
        id: string
        evidenceRowId: string
        title: string
        priority: CaseReviewIntakeItem['priority']
        state: CaseReviewIntakeItem['state']
        route: string
        ownerLane: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']
        nextAction: string
        recommendedAction: CaseReviewIntakeItem['recommendedAction']
        reasons: string[]
        alertIds: string[]
        captureIds: string[]
        casePaths: string[]
        sourceIds: string[]
        provenanceRefs: string[]
        provenanceFingerprints: string[]
        blockers: string[]
        replay: {
            ready: boolean
            state: TiActionabilityModel['caseReplayReadiness']['rows'][number]['state']
            exportRoute?: string
            caseId?: string
            blockerCodes: string[]
        }
    }>
    blockers: string[]
    consumerStage?: {
        state: string
        request?: string
        missing: string[]
    }
    safeOutput: TiSafeOutputMetadata
}
