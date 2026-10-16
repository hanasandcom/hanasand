import { type CaseReviewIntakeItem } from './source'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import type { TiSafeOutputMetadata } from '../safeOutput'
import type { SelectedPublicActorContext } from './publicActorContext'

export type SelectedCaseOwnershipPlan = SelectedPublicActorContext & {
    schemaVersion: 'ti.public_actor.selected_case_ownership.v1'
    state: 'ready' | 'review' | 'blocked'
    route: string
    nextAction: string
    owner: {
        lane: string
        label: string
    }
    summary: {
        caseCandidates: number
        replayReady: number
        relatedAlerts: number
        relatedCases: number
        captures: number
        blockers: number
    }
    caseReviewItems: Array<{
        id: string
        evidenceRowId: string
        title: string
        priority: CaseReviewIntakeItem['priority']
        state: CaseReviewIntakeItem['state']
        route: string
        alertIds: string[]
        casePaths: string[]
        captureIds: string[]
        sourceIds: string[]
        watchlistTerms: string[]
        reasons: string[]
        recommendedAction: CaseReviewIntakeItem['recommendedAction']
        nextAction: string
        blockers: string[]
    }>
    replayRows: Array<{
        id: string
        evidenceRowId: string
        ready: boolean
        state: TiActionabilityModel['caseReplayReadiness']['rows'][number]['state']
        exportRoute?: string
        caseId?: string
        alertIds: string[]
        captureIds: string[]
        sourceIds: string[]
        blockerCodes: string[]
    }>
    related: {
        alerts: Array<{
            id: string
            status?: string
            casePath?: string
            captureIds: string[]
            recommendedRoute?: string
        }>
        cases: Array<{
            id: string
            path?: string
            status?: string
            title?: string
        }>
    }
    sourceRefs: {
        alertIds: string[]
        captureIds: string[]
        casePaths: string[]
        sourceIds: string[]
    }
    consumerStage?: {
        id: string
        state: string
        request?: string
        blockers: string[]
    }
    blockers: string[]
    safeOutput: TiSafeOutputMetadata
}
