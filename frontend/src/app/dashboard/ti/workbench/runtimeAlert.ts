import type { DwmAlert } from '@/utils/dwm/product'

export type RuntimeDwmAlert = DwmAlert & {
    tenantId?: string
    organizationId?: string
    workflowStatus?: string
    assignedOwner?: string
    workflowNote?: string
    workflowRationale?: string
    updatedAt?: string
    lastSeenAt?: string
    caseId?: string
    caseIdCandidate?: string
    casePath?: string
    alertDetailPath?: string
    dedupeKey?: string
    recommendedRoute?: string
    watchlistIds?: string[]
    watchlistItemIds?: string[]
    workflowEvents?: Array<{ id?: string, at?: string, eventType?: string, toWorkflowStatus?: string, toOwner?: string, note?: string }>
    workflowContext?: {
        organizationId?: string
        caseIdCandidate?: string
        casePath?: string
        alertDetailPath?: string
        watchlistIds?: string[]
        watchlistItemIds?: string[]
        captureIds?: string[]
        sourceIds?: string[]
        webhookDestinationIds?: string[]
        evidenceCount?: number
        matchReason?: { evidenceCount?: number }
        duplicateEvidenceSuppression?: { suppressedCount?: number, suppressedCaptureIds?: string[] }
    }
    webhookContext?: { webhookDestinationIds?: string[], selectedCaptureIds?: string[], deliveryDedupeKey?: string }
    deliveryReadinessContext?: {
        ready?: boolean
        webhookDestinationIds?: string[]
        selectedWebhookDestinationId?: string
        selectedCaptureIds?: string[]
        deliveryDedupeKey?: string
        blockerCodes?: string[]
    }
    sourceProvenanceSummary?: {
        sourceFamily?: string
        sourceFamilies?: string[]
        captureIds?: string[]
        sourceIds?: string[]
        contentHashes?: string[]
        evidenceExcerpts?: Array<{ id?: string, sourceName?: string, sourceFamily?: string, excerpt?: string, observedAt?: string, contentHash?: string }>
        provenanceGaps?: Array<{ code?: string }>
        generationEvidenceWindow?: { captureIds?: string[], sourceFamilies?: string[], firstSeenAt?: string, lastSeenAt?: string }
    }
    orgWatchlistScope?: { organizationId?: string, watchlistIds?: string[], watchlistItemIds?: string[], alertGenerationRefs?: unknown[] }
    customerReadiness?: {
        ready?: boolean
        state?: string
        alertReadiness?: {
            selectedCaptureIds?: string[]
            watchlistIds?: string[]
            watchlistItemIds?: string[]
            recommendedRoute?: string
            matchReason?: unknown
            blockerCodes?: string[]
        }
        caseHandoff?: { ready?: boolean, caseId?: string, caseIdCandidate?: string, casePath?: string }
        deliveryReadiness?: { ready?: boolean, selectedWebhookDestinationId?: string, webhookDestinationIds?: string[], blockerCodes?: string[] }
        webhookReplayReadiness?: { ready?: boolean, blockerCodes?: string[], deliveryHistoryRefs?: string[] }
        workflowReadiness?: { ready?: boolean, status?: string, assignedOwner?: string, eventCount?: number }
        blockerCodes?: string[]
    }
    workflowSummary?: { status?: string, assignedOwner?: string, eventCount?: number, caseId?: string, casePath?: string }
    nextBestAction?: { label?: string, action?: string, reason?: string, route?: string, casePath?: string, webhookReady?: boolean }
    deliveryReadiness?: { ready?: boolean, blockerCodes?: string[], selectedCaptureIds?: string[], webhookDestinationIds?: string[] }
    deliveries?: Array<{ id?: string, alertId?: string, status?: string, deliveryKind?: string, attemptedAt?: string, webhookDestinationId?: string, endpointHash?: string, payloadHash?: string, httpStatus?: number, error?: string }>
}
