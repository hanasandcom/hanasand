import { type AnalystWorkItem } from './core'
import { type TiActionabilityModel } from '@/utils/ti/actionability'

export type SelectedSourceDrilldown = {
    schemaVersion: 'ti.public_actor.selected_source_drilldown.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItem: Pick<AnalystWorkItem, 'id' | 'kind' | 'title' | 'timestamp' | 'source' | 'provenance' | 'confidence' | 'href'>
    rows: SelectedSourceDrilldownRow[]
    alertHandoff: {
        ready: boolean
        endpoint: string
        route?: string
        missing: string[]
    }
    caseHandoff: {
        ready: boolean
        endpoint: string
        route?: string
        missing: string[]
    }
    blockers: string[]
}

export type SelectedSourceDrilldownRow = {
    rowId: string
    sourceName: string
    sourceId?: string
    provenance: string
    href?: string
    captureId?: string
    reportDate?: string
    confidence?: number
    state: 'ready' | 'needs_capture' | 'needs_source'
    ownerLane: 'source' | 'public-ti' | 'alert' | 'case'
    route: string
    missing: string[]
    handoff: string
}

export type SelectedCaseSourceRow = {
    sourceName: string
    sourceId?: string
    provenance: string
    captureId?: string
    reportDate?: string
    confidence?: number
    state: SelectedSourceDrilldownRow['state']
    missing: string[]
    provenanceRefs: string[]
    provenanceFingerprint: string
}

export type SourceHealthRow = TiActionabilityModel['sourceHealthQueue']['rows'][number]

export type WatchlistIntersectionRow = TiActionabilityModel['orgRelevance']['watchlistIntersections'][number]

export type CaseReviewIntakeItem = TiActionabilityModel['caseReviewIntake']['items'][number]
