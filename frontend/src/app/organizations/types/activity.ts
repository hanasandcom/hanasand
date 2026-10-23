
export type CollectionRequest = {
    requestId: string
    status: 'queued' | 'running' | 'completed' | 'failed' | string
    runIds?: string[]
    captureCount?: number
    alertCount?: number
    alertIds?: string[]
    createdAt?: string
    updatedAt?: string
    completedAt?: string
    errors?: string[]
}

export type ScopedAlert = {
    id: string
    title?: string
    status?: string
    severity?: string
    reviewState?: string
    watchlistItemId?: string
    watchlistIds?: string[]
    watchlistItemIds?: string[]
    organizationId?: string
    firstSeenAt?: string
    alertedAt?: string
    updatedAt?: string
}

export type ScopedCase = {
    id: string
    title?: string
    status?: string
    assignedOwner?: string
    organizationId?: string
    createdAt?: string
    timeline?: Array<{
        timestamp?: string
        eventType?: string
        toStatus?: string
        workflowState?: { action?: string }
    }>
    updatedAt?: string
}

export type DwmAlertBridgeResult = {
    schemaVersion?: 'organization.watchlist_projection_receipt.v1'
    projection?: {
        status: 'synchronized' | 'unchanged' | 'pending' | 'failed'
        checkedAt: string | null
        source: 'identity'
        watchlistIds: string[]
        unresolvedItemIds: string[]
        reason?: string
        error?: { code: string, message: string }
    }
    alertRebuild?: { status: 'not_requested', reason: 'projection_only' }
    ok?: boolean
    skipped?: boolean
    reason?: string
    savedAlertCount?: number
    alertIds?: string[]
    sourceFamilies?: string[]
    matchedTerms?: string[]
    firstAlert?: {
        id?: string
        detailRoute?: string
        sourceFamily?: string
        matchedTerm?: string
        recommendedRoute?: string
        evidenceCount?: number
        lastSeenAt?: string
    }
}

export type ActivityItem = {
    id: string
    at: string
    title: string
    detail: string
    ok: boolean
    organizationId?: string
    source?: 'session'
    subjectType?: ActivitySubjectType
    subjectId?: string
    relatedSubjectIds?: string[]
    metadata?: Array<{ label: string, value: string }>
}

export type RowMessage = {
    ok: boolean
    text: string
}

export type ActivitySubjectType = 'organization' | 'invite' | 'member' | 'watchlist' | 'destination' | 'alert' | 'case'

export type ActivitySubject = {
    type: ActivitySubjectType
    id: string
}

export type ApiError = Error & { status?: number, code?: string }
