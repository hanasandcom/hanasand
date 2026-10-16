import type { TiResultState } from './resultState'

export interface TiOperationalStatus {
    state: 'idle' | 'queued' | 'searching' | 'partial' | 'ready' | 'blocked' | 'degraded' | 'metadata_review' | 'needs_source_activation'
    headline: string
    queue: {
        selectedTasks: number
        queuedTasks: number
        leasedTasks: number
        reviewTasks: number
        maxAgeSeconds: number
        p95AgeSeconds: number
        nextPollSeconds?: number
        backpressureState?: string
        cursorContinuity?: string
    }
    workers: {
        leaseState: string
        retryDebt: number
        deadLetters: number
        backoffState: string
        concurrency: string
        fairness: string
        memoryPressure?: number
    }
    budgets: Array<{
        workClass: string
        queued: number
        leased: number
        budgetSlots: number
        maxAgeSeconds: number
        retryDebt: number
        action: string
    }>
    fairness: {
        ok: boolean
        worstGroup?: string
        worstShare: number
    }
    aging: Array<{
        label: string
        seconds: number
        tone: 'ok' | 'watch' | 'bad'
    }>
    controls: Array<{
        action: string
        scenario?: string
        warningCodes: string[]
        queueDelta: number
        workerDelta: number
        rollback: string
    }>
    notes: string[]
}

export interface TiAnalystLoop {
    resultState: TiResultState
    headline: string
    nextSteps: Array<{
        state: 'queued' | 'metadata_review' | 'blocked_unsafe_target' | 'needs_source_activation' | 'ready'
        label: string
        detail: string
        tone: 'ok' | 'watch' | 'bad'
    }>
    runStatusClarity: {
        queuedTasks: number
        reviewTasks: number
        rejectedSources: number
        blockedUnsafeTargets: number
        meaningfulWorkCount: number
        summary: string
    }
    metadataReviewInbox: TiMetadataReviewItem[]
    sourceActivationWorkflow: {
        required: boolean
        dryRunOnly: boolean
        actions: Array<{
            action: 'request_approval' | 'restore_source' | 'enable_metadata_only_queue' | 'keep_blocked'
            sourceId?: string
            reason: string
            execution: 'dry_run' | 'human_approval_required' | 'blocked'
        }>
    }
    victimNotificationPacket?: TiVictimNotificationPacket
}

export interface TiMetadataReviewItem {
    id: string
    company?: string
    victim?: string
    affectedAccounts?: string
    accountSubjects?: string
    datasetSize?: string
    actorStatement?: string
    claimedDate?: string
    sourceHash?: string
    provenance?: string
    confidence: number
    status: 'needs_review' | 'queued_metadata_only' | 'duplicate' | 'escalated'
    allowedActions: Array<'notify_company' | 'mark_duplicate' | 'request_approval' | 'escalate'>
}

export interface TiVictimNotificationPacket {
    company?: string
    claimSummary: string
    affectedAccounts?: string
    datasetSize?: string
    actorStatement?: string
    sourceHash?: string
    confidence: number
    whatWasNotAccessed: string[]
    recommendedAction: string
}
