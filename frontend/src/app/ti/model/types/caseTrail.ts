import type { TiSafeOutputMetadata } from '../safeOutput'

export type CaseActionTrailPayload = {
    schemaVersion: 'ti.public_actor.case_action_trail.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    events: CaseActionTrailEvent[]
    summary: {
        total: number
        ready: number
        blocked: number
        sessionLocal: boolean
        replayable: boolean
    }
    safeOutput: TiSafeOutputMetadata
}

export type CaseActionTrailEvent = {
    id: string
    at: string
    label: string
    detail: string
    state: 'ready' | 'review' | 'blocked' | 'local'
    route?: string
    blockers: string[]
    replayExportRoute?: string
    evidenceRowId?: string
    provenance: {
        sourceIds: string[]
        captureIds: string[]
        alertIds: string[]
        caseId?: string
        confidence?: number
        reportDate?: string
        source?: string
    }
}
