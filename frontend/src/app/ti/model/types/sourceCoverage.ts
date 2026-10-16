import { type AnalystWorkItem } from './core'

export type SourceCoverageWorkbenchRow = {
    id: string
    sourceName: string
    family: string
    provenance: string
    href?: string
    newestAt?: string
    parserStatus: string
    state: 'ready' | 'review' | 'blocked'
    confidenceValues: number[]
    artifactTypes: string[]
    evidenceItems: AnalystWorkItem[]
    captureId?: string
    sourceRequestId?: string
    sourceId?: string
    missing: string[]
    nextAction: string
    queueFilter?: string
    payload: Record<string, unknown>
}
