import { type TiActionabilityModel } from '@/utils/ti/actionability'
import type { TiSafeOutputMetadata } from '../safeOutput'
import type { SelectedPublicActorContext } from './publicActorContext'

export type SelectedAlertActionPlan = SelectedPublicActorContext & {
    schemaVersion: 'ti.public_actor.selected_alert_action_plan.v1'
    state: TiActionabilityModel['alertGenerationReadiness']['state']
    ready: boolean
    route: string
    sourceRoute: string
    nextAction: string
    readiness: Pick<TiActionabilityModel['alertGenerationReadiness'], 'schemaVersion' | 'readyForCustomerDelivery' | 'candidateCount' | 'matchedCandidateCount' | 'captureRefCount' | 'generationEvidenceWindowReady' | 'latestEvidenceAt' | 'provenance'>
    watchlist: {
        terms: string[]
        matchedTerms: string[]
        organizations: string[]
    }
    sourceRefs: {
        sourceIds: string[]
        captureIds: string[]
        alertIds: string[]
        sourceFamilies: string[]
    }
    evidenceRows: Array<{
        rowId: string
        kind: TiActionabilityModel['orgRelevance']['handoffRows'][number]['kind']
        state: TiActionabilityModel['orgRelevance']['handoffRows'][number]['state']
        ownerLane: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']
        label: string
        action: string
        route: string
        sourceFamily: string
        provenanceRefs: string[]
        alertId?: string
        casePath?: string
        captureIds: string[]
        evidence: {
            summary: string
            sourceName?: string
            provenance?: string
            reportDate?: string
            captureId?: string
            parserStatus?: string
            confidence?: number
        }
        blockers: string[]
    }>
    replayRows: Array<{
        id: string
        ready: boolean
        state: TiActionabilityModel['caseReplayReadiness']['rows'][number]['state']
        exportRoute?: string
        caseId?: string
        alertIds: string[]
        captureIds: string[]
        sourceIds: string[]
        blockerCodes: string[]
    }>
    blockers: TiActionabilityModel['alertGenerationReadiness']['blockers']
    handoff: {
        ready: boolean
        endpoint: string
        route?: string
        missing: string[]
    }
    safeOutput: TiSafeOutputMetadata
}
