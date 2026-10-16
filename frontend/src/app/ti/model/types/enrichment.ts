import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type AnalystWorkItem } from './core'

export type EnrichmentTask = {
    title: string
    status: 'ready' | 'needs_api' | 'needs_review' | 'watch'
    detail: string
    route?: string
    sourceFamily?: string
    requestedFields?: string[]
    ownerLane?: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']
}

export type EnrichmentGapWorkbenchRow = {
    id: string
    type: string
    label: string
    entity: string
    state: 'ready' | 'review' | 'blocked'
    confidenceValues: number[]
    newestAt?: string
    source: string
    impact: string
    route?: string
    evidenceItems: AnalystWorkItem[]
    artifactIds: string[]
    missing: string[]
    payload: Record<string, unknown>
}
