import { type TiActionabilityModel } from '@/utils/ti/actionability'
import type { PublicActorContext } from './publicActorContext'

export type AnalystWorkItem = {
    id: string
    kind: 'activity' | 'exposure' | 'victim' | 'tradecraft' | 'collection'
    severity: 'critical' | 'high' | 'medium' | 'low'
    status: string
    title: string
    subtitle: string
    detail: string
    timestamp: string
    source: string
    provenance: string
    confidence: number
    assertionKind: 'observed' | 'source_claim' | 'inferred' | 'extracted'
    reviewState?: string
    corroborationState?: string
    observationSummary?: string
    href?: string
    evidence: string[]
    nextActions: string[]
    priority?: TiActionabilityModel['evidencePriority'][number]
}

export type LocalDecision = {
    status: 'reviewing' | 'assigned' | 'escalated' | 'suppressed' | 'closed' | 'reopened'
    reason: string
    decidedAt: string
}

export type LocalRelevanceMark = {
    state: 'customer_relevant' | 'context_only' | 'needs_source' | 'not_relevant'
    rationale: string
    watchTerms: string[]
    caseIntent: 'case_candidate' | 'watchlist_context' | 'source_review' | 'no_case'
    markedAt: string
}

export type WatchlistRelevance = {
    terms: string[]
    matchedTerms: string[]
    organizations: string[]
    sectors: string[]
    countries: string[]
    domains: string[]
    rationale: string
}

export type WatchlistWorkbenchRow = {
    id: string
    kind: string
    value: string
    matched: boolean
    state: 'ready' | 'review' | 'blocked'
    confidenceValues: number[]
    newestAt?: string
    evidenceItems: AnalystWorkItem[]
    artifactIds: string[]
    sourceCount: number
    route?: string
    casePath?: string
    detail: string
    blockers: string[]
    payload: Record<string, unknown>
}

export type SectionOverviewItem = {
    label: 'Overview' | 'Activity' | 'Targets' | 'Infrastructure' | 'Sources' | 'Evidence' | 'Watchlist relevance' | 'Related alerts/cases' | 'Source questions' | 'Actions'
    value: string
    state: 'ready' | 'review' | 'blocked'
}

export type AlertPacket = {
    title: string
    customerValue: string
    watchTerms: string[]
    evidenceBasis: string[]
    routing: string
    blockedUntil: string[]
}

export type SelectedTriageBrief = {
    whatHappened: string
    whyItMatters: string
    nextAction: string
    evidenceStatus: string
    evidenceTone: 'ready' | 'review' | 'blocked'
    safetyBoundary: string
    labels: Array<{ label: string; value: string }>
}

export type SelectedReviewHandoff = PublicActorContext & {
    schemaVersion: 'ti.public_actor.selected_review_handoff.v1'
    selectedItem: Pick<AnalystWorkItem, 'id' | 'kind' | 'severity' | 'title' | 'timestamp' | 'source' | 'provenance' | 'confidence' | 'href' | 'evidence' | 'nextActions'>
    localReview: {
        status: LocalDecision['status'] | 'not_recorded'
        rationale: string
        decidedAt?: string
    }
    localRelevance: {
        state: LocalRelevanceMark['state'] | 'not_marked'
        rationale: string
        watchTerms: string[]
        caseIntent: LocalRelevanceMark['caseIntent'] | 'not_set'
        markedAt?: string
    }
    watchlist: {
        terms: string[]
        matchedTerms: string[]
        organizations: string[]
    }
    caseHandoff: {
        ready: boolean
        endpoint: string
        backedRoute?: string
        missing: string[]
    }
    alertHandoff: {
        ready: boolean
        endpoint: string
        backedRoute?: string
        missing: string[]
    }
    evidenceBasis: string[]
    blockers: string[]
}
