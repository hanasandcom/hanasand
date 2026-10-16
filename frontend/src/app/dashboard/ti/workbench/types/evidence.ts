export type WorkbenchEvidence = {
    id: string
    sourceName: string
    sourceFamily: string
    captureMode: string
    redactionState: string
    contentHash: string
    excerpt: string
    observedAt?: string
    provenance?: string
    confidence?: number
    metadata?: Array<{ label: string, value: string }>
}

export type WorkbenchTimelineItem = {
    id: string
    at: string
    title: string
    body: string
}

export type WorkbenchWorkflowStep = {
    id: string
    label: string
    status: 'ready' | 'needs_action' | 'blocked'
    owner: string
    source: string
    detail: string
    entityId?: string
    href?: string
}

export type WorkbenchAction = {
    id: string
    label: string
    method: 'GET' | 'POST' | 'PATCH'
    href: string
    body?: Record<string, unknown>
    disabledReason?: string
}

export type WorkbenchHandoffAction = 'create_watchlist' | 'rebuild_alerts' | 'open_case' | 'queue_enrichment'

export type WorkbenchPublicTiActionReadiness = {
    action: WorkbenchHandoffAction
    route?: string
    endpoint?: string
    backedRoute?: string
    ready: boolean
    missing: string[]
    blockerCodes: string[]
    ownerLane: 'org' | 'alert' | 'case' | 'source'
    selected: boolean
    sourceRequestCount: number
}

export type WorkbenchHandoffPayload = {
    schemaVersion?: string
    query?: string
    generatedAt?: string
    route?: string
    method?: 'POST'
    endpoint?: string
    backedRoute?: string
    blocked?: boolean
    missing?: string[]
    body?: Record<string, unknown>
    provenance?: Array<{ sourceName?: string, provenance?: string, captureId?: string, confidence?: number }>
}

export type WorkbenchPublicTiHandoff = {
    decodeStatus: 'ready' | 'blocked'
    decodeError?: string
    action?: WorkbenchHandoffAction
    artifactId?: string
    query?: string
    generatedAt?: string
    orgRequired?: boolean
    sourceRequired?: boolean
    stale?: boolean
    missing: string[]
    blockers: Array<{ code: string, detail: string }>
    sourceRequests: Array<{ sourceName: string, provenance: string, captureId?: string, confidence?: number, missing: string[] }>
    artifact?: {
        id?: string
        kind?: string
        label?: string
        confidence?: number
        freshness?: string
        evidence?: string[]
        provenance?: string[]
        watchlistTerms?: Array<{ kind?: string, value?: string, notes?: string }>
        enrichmentTasks?: string[]
        readiness?: { state?: string, label?: string, blockers?: string[] }
    }
    selectedPayload?: WorkbenchHandoffPayload
    actionPayloads?: {
        watchlist?: WorkbenchHandoffPayload
        alertRebuild?: WorkbenchHandoffPayload
        case?: WorkbenchHandoffPayload
        enrichment?: WorkbenchHandoffPayload
    }
    actionReadiness?: WorkbenchPublicTiActionReadiness[]
}

export type WorkbenchCaseMutationAction = 'assign' | 'note' | 'review' | 'escalate' | 'suppress' | 'close' | 'reopen' | 'false_positive'

export type WorkbenchCaseMutationPayload = {
    action: WorkbenchCaseMutationAction
    actor: string
    note?: string
    assignedOwner?: string
    idempotencyKey?: string
}

export type WorkbenchInvitePayload = {
    email: string
    role: string
    invitedBy: string
}

export type WorkbenchWatchlistUpsertPayload = {
    id?: string
    organizationId?: string
    tenantId?: string
    name: string
    terms: Array<{ value: string, kind?: string }>
    status?: string
    webhookDestinationId?: string
}

export type WorkbenchDeliveryEvidence = {
    id: string
    alertId: string
    status: string
    deliveryKind?: string
    attemptedAt: string
    webhookDestinationId?: string
    endpointHash: string
    payloadHash: string
    httpStatus?: number
    error?: string
}

export type WorkbenchKeyboardState = {
    selectedId: string
    focusedRegion: 'queue' | 'detail-actions'
    lastKey: 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'ArrowRight' | 'Enter'
}

export type WorkbenchActionOutcome = {
    ok: boolean
    text: string
    source?: 'case_mutation' | 'dwm_action' | 'org_action' | 'watchlist_action' | 'session_local'
}

export type OperatorActionRailRow = {
    id: string
    label: string
    detail: string
    tone: WorkbenchWorkflowStep['status']
    href?: string
    action?: WorkbenchAction
    copyPayload?: unknown
    customerNotification?: boolean
    disabledReason?: string
}

export type HandoffTerm = { value: string, kind: string, notes?: string }
