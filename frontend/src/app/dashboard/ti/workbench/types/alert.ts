import type { CaseTimelineItem } from './case'
import type { WorkbenchDeliveryEvidence } from './evidence'

export type AlertDetailState =
    | { status: 'loading' }
    | { status: 'error', error: string }
    | { status: 'ready', detail: AlertDetailPayload }

export type AlertDetailPayload = {
    generatedAt?: string
    alert?: {
        id?: string
        reviewState?: string
        workflowStatus?: string
        deliveryState?: string
        assignedOwner?: string
        caseId?: string
        caseIdCandidate?: string
        organizationId?: string
        sourceCount?: number
        firstSeenAt?: string
        updatedAt?: string
        workflowContext?: {
            organizationId?: string
            caseIdCandidate?: string
            watchlistIds?: string[]
            webhookDestinationIds?: string[]
        }
        webhookContext?: {
            hasWebhookRoute?: boolean
            webhookDestinationIds?: string[]
            missingRouteCandidateCount?: number
        }
        evidence?: Array<{
            id?: string
            sourceName?: string
            sourceFamily?: string
            captureMode?: string
            redactionState?: string
            contentHash?: string
            excerpt?: string
            observedAt?: string
            firstSeenAt?: string
            provenance?: { sourceId?: string, captureId?: string, captureMode?: string } | string
        }>
        replayCount?: number
        lastReplayedAt?: string
    }
    workflowExecutionReadiness?: {
        schemaVersion?: string
        ready?: boolean
        action?: string
        currentWorkflowEventCount?: number
        expectedWorkflowEventCount?: number
        currentUpdatedAt?: string
        expectedUpdatedAt?: string
        idempotencyKey?: string
        blockerCodes?: string[]
        blockers?: Array<{ code?: string, field?: string, detail?: string, retryable?: boolean }>
        createdEventDispatch?: { ready?: boolean, eventId?: string, idempotencyKey?: string, blockerCodes?: string[] }
    }
    analystWorkflowContract?: {
        mutationRoute?: string
        replayRoute?: string
        idempotency?: { workflowEventCount?: number, updatedAt?: string, staleVersionBlocker?: string }
        current?: { status?: string, assignedOwner?: string, caseId?: string, casePath?: string, replayCount?: number }
    }
    downstreamHandoff?: {
        ready?: boolean
        blockerCodes?: string[]
        deliverySelection?: { ready?: boolean, selectedWebhookDestinationId?: string, blockerCodes?: string[] }
        customerStatus?: { ready?: boolean, blockerCodes?: string[] }
    }
    customerStatusHandoff?: {
        ready?: boolean
        blockerCodes?: string[]
        evidenceCount?: number
        deliveryReady?: boolean
        deliveryState?: string
        selectedCaptureIds?: string[]
    }
    nextBestAction?: {
        action?: string
        label?: string
        reason?: string
        requiresRationale?: boolean
        route?: string
        casePath?: string
        webhookReady?: boolean
    }
    deliveryReadiness?: {
        ready?: boolean
        state?: string
        blocker?: string | null
        blockerCodes?: string[]
        evidenceCount?: number
        lastDeliveryStatus?: string
        lastDeliveryAt?: string
        deliveryHistoryRefs?: string[]
        selectedCaptureIds?: string[]
    }
    evidenceFreshness?: {
        newestEvidenceAt?: string
        evidenceCount?: number
        sourceCount?: number
        sourceFamily?: string
        captureIds?: string[]
    }
    provenanceFreshness?: {
        matchBasis?: string
        captureIds?: string[]
        sourceIds?: string[]
    }
    timeline?: CaseTimelineItem[]
    error?: { message?: string }
}

export type WorkbenchApiPayload = {
    error?: { message?: string }
    attemptedCount?: number
    savedAlertCount?: number
    testedAt?: string
    invites?: Array<{ id?: string, email?: string, role?: string }>
    deliveredAt?: string
    delivery?: Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }
    deliveries?: Array<Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }>
    latestDelivery?: Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }
    deliveryEvidence?: Array<Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }>
    deliveryStatus?: {
        latestDelivery?: Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }
        deliveries?: Array<Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }>
    }
    deliveryProof?: {
        latestDelivery?: Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }
        deliveries?: Array<Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }>
    }
    testResult?: {
        delivery?: Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }
        deliveries?: Array<Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }>
    }
    alert?: { id?: string, replayCount?: number, lastReplayedAt?: string, updatedAt?: string }
    workflowExecutionReadiness?: { ready?: boolean, action?: string, blockerCodes?: string[] }
    downstreamHandoff?: { blockerCodes?: string[] }
    case?: { id?: string, status?: string, organizationId?: string }
    receipt?: { id?: string, deliveryMode?: string, webhookDeliveryId?: string }
    watchlist?: { id?: string, status?: string }
}
