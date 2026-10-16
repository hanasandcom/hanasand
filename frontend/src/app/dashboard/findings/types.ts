import type { DwmAlert } from '@/utils/dwm/product'

export type PortalAlert = DwmAlert & {
    deliveryState?: string
    workflowNote?: string
    assignedOwner?: string
    organizationId?: string
    caseId?: string
    caseIdCandidate?: string
    casePath?: string
    replayCount?: number
    lastReplayedAt?: string
    savedAt?: string
    deliveredAt?: string
    workflowContext?: {
        organizationId?: string
        watchlistIds?: string[]
        webhookDestinationIds?: string[]
        caseId?: string
        caseIdCandidate?: string
        casePath?: string
        captureIds?: string[]
    }
    webhookContext?: {
        hasWebhookRoute?: boolean
        webhookDestinationIds?: string[]
        caseId?: string
        caseIdCandidate?: string
        casePath?: string
        captureIds?: string[]
    }
    provenance?: { captureIds?: string[] }
    sourceProvenanceSummary?: {
        captureIds?: string[]
        generationEvidenceWindow?: { captureIds?: string[] }
    }
    workflowEvents?: Array<{
        id: string
        at: string
        actor?: string
        note?: string
        fromReviewState?: string
        toReviewState?: string
        fromDeliveryState?: string
        toDeliveryState?: string
        fromOwner?: string
        toOwner?: string
    }>
}

export type OperationsSnapshot = {
    counts: {
        sourceCount: number
        activeSourceCount: number
        telegramSourceCount: number
        darkwebMetadataSourceCount: number
        captureCount: number
        watchlistMatchCount: number
    }
    latestRun?: { status: string, updatedAt: string, captureCount: number, error?: string }
    latestCaptures: Array<{
        id: string
        sourceName: string
        family: string
        collectedAt: string
        redactionState: string
        contentHash: string
        safeExcerpt: string
        matchedWatchTerms: string[]
    }>
    sourceHealth: Array<{
        sourceId: string
        sourceName: string
        family: string
        status: string
        lastCollectedAt?: string
        lastSuccessAt?: string
        lastAttemptAt?: string
        collectionStatus?: 'succeeded' | 'failed' | 'degraded' | 'not_collected' | 'paused'
        approvedMetadataOnly: boolean
    }>
    zeroAlertExplanation: { message: string }
}

export type DeliveryItem = {
    id: string
    alertId: string
    organizationId?: string
    watchlistId?: string
    webhookDestinationId?: string
    destinationId?: string
    requestId?: string
    auditEventId?: string
    endpointHash: string
    endpointHint?: string
    dedupeKey: string
    attemptedAt: string
    dryRun?: boolean
    payloadHash: string
    status: string
    httpStatus?: number
    error?: string
    errorClass?: string
    attemptCount?: number | null
    nextRetryAt?: string | null
    deliveryKind?: string
}

export type CaseListItem = {
    id: string
    caseId?: string
    tenantId?: string
    organizationId?: string
    alertId?: string
    title: string
    summary?: string
    status: string
    priority?: string
    severity?: string
    assignedOwner?: string
    createdAt?: string
    updatedAt?: string
    firstSeenAt?: string
    reviewState?: string
    actor?: string
    victimName?: string
    company?: string
}

export type CasesState = { status: 'loading' | 'ready' | 'error', rows: CaseListItem[], total?: number, error?: string }
export type WatchlistItem = { id: string, name: string, terms: import('@/utils/dwm/product').DwmWatchTerm[], status: 'active' | 'paused' | string }
export type WatchlistOverview = {
    tenantId: string
    organizationId?: string
    watchlists: WatchlistItem[]
    watchlistCount: number
    watchedTermCount: number
    findingsCount: number
    caseCount?: number
    destinationsCount?: number
}
export type WatchlistOverviewState = { status: 'loading' | 'ready' | 'error', data?: WatchlistOverview, error?: string }
