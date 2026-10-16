import type { PublicTiEvidencePriority } from './evidence'
import type { PublicTiReadinessBlocker } from './actionability'

export type PublicTiCaseReviewIntake = {
    schemaVersion: 'ti.public_actor.case_review_intake.v1'
    query: string
    generatedAt: string
    route: '/v1/cases'
    items: PublicTiCaseReviewIntakeItem[]
    summary: {
        total: number
        ready: number
        review: number
        blocked: number
        alerts: number
        caseRoutes: number
        captures: number
    }
}

export type PublicTiCaseReviewIntakeItem = {
    schemaVersion: 'ti.public_actor.case_review_intake_item.v1'
    id: string
    evidenceRowId: string
    title: string
    score: number
    state: PublicTiEvidencePriority['state']
    route: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    alertIds: string[]
    casePaths: string[]
    captureIds: string[]
    sourceIds: string[]
    watchlistTerms: string[]
    reasons: string[]
    blockedBy: PublicTiReadinessBlocker[]
    recommendedAction: 'open_case' | 'open_alert' | 'rebuild_alert' | 'attach_capture' | 'refresh_evidence'
    nextAction: string
}

export type PublicTiCaseReplayReadinessExport = {
    schemaVersion: 'ti.public_actor.case_action_replay_readiness.v1'
    sourceContractSchemaVersion: 'dwm.case_action_replay_export.v1'
    query: string
    generatedAt: string
    routeTemplate: '/v1/cases/:caseId/action-replay-export'
    rows: PublicTiCaseReplayReadinessRow[]
    summary: {
        total: number
        ready: number
        blocked: number
        replayable: boolean
        alertIds: number
        caseRoutes: number
        captures: number
    }
    safeOutput: {
        metadataOnly: true
        rawEvidenceExposed: false
        webhookSecretExposed: false
        liveMutation: false
    }
}

export type PublicTiCaseReplayReadinessRow = {
    schemaVersion: 'ti.public_actor.case_action_replay_readiness_row.v1'
    id: string
    caseReviewIntakeItemId: string
    evidenceRowId: string
    title: string
    ready: boolean
    state: 'ready' | 'blocked'
    exportRoute?: string
    caseId?: string
    alertIds: string[]
    captureIds: string[]
    sourceIds: string[]
    blockerCodes: Array<'missing_case_route' | 'missing_alert' | 'missing_capture' | 'stale_provenance' | 'missing_source_provenance'>
    blockedBy: PublicTiReadinessBlocker[]
    replayPlan: {
        actionId: 'alertReplay'
        eventAction: 'handoff_alert_replay'
        replayable: boolean
        metadataOnly: true
    }
    provenance: {
        casePaths: string[]
        watchlistTerms: string[]
        reasons: string[]
    }
}
