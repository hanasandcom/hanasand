import { type TiActionabilityModel } from '@/utils/ti/actionability'

export type EnrichmentTask = {
    title: string
    status: 'ready' | 'needs_api' | 'needs_review' | 'watch'
    detail: string
    route?: string
    sourceFamily?: string
    requestedFields?: string[]
    ownerLane?: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']
}
