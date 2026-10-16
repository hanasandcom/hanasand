import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type WatchlistIntersectionRow } from './source'

export type SelectedWatchlistPlan = {
    schemaVersion: 'ti.public_actor.selected_watchlist_plan.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    state: TiActionabilityModel['watchlistRelevance']['state']
    ready: boolean
    route: string
    nextAction: string
    terms: Array<{
        kind: 'company' | 'domain' | 'vendor'
        value: string
        matched: boolean
        notes: string
    }>
    relevanceRows: Array<{
        kind: 'company' | 'domain' | 'vendor'
        value: string
        fit: 'matched' | 'near' | 'blocked'
        alertable: boolean
        route: string
        evidenceRefs: string[]
        sourceFamilies: string[]
        evidenceRows: Array<{
            sourceName: string
            sourceId?: string
            provenance: string
            reportDate?: string
            captureId?: string
            sourceRequestId?: string
            sourceFamily?: string
            parserStatus?: string
            lastCollectedAt?: string
            confidence?: number
            shownBecause: string
        }>
        handoffRows: Array<{
            rowId: string
            kind: TiActionabilityModel['orgRelevance']['handoffRows'][number]['kind']
            state: TiActionabilityModel['orgRelevance']['handoffRows'][number]['state']
            ownerLane: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']
            label: string
            action: string
            route: string
            sourceFamily: string
            blockerCount: number
        }>
        blockers: string[]
        blockerOwners: TiActionabilityModel['readiness']['blockers'][number]['ownerLane'][]
        nextAction: string
    }>
    intersections: Array<{
        intersectionId: string
        kind: WatchlistIntersectionRow['kind']
        value: string
        state: WatchlistIntersectionRow['state']
        route: string
        organizationId?: string
        watchlistId?: string
        watchlistItemId?: string
        alertIds: string[]
        casePaths: string[]
        captureIds: string[]
        sourceEvidenceRefs: string[]
        recommendedAction: WatchlistIntersectionRow['recommendedAction']
        blockers: WatchlistIntersectionRow['blockers']
    }>
    sourceRefs: {
        sourceIds: string[]
        captureIds: string[]
        alertIds: string[]
        casePaths: string[]
    }
    blockers: string[]
    handoff: {
        ready: boolean
        route: string
        blocked: boolean
        missing: string[]
    }
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}
