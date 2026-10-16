import type { CaseResolution } from '../../cases-client'
import type { DeliveryRow, EvidenceRow, ReceiverReceipt, TimelineRow, WebhookDestination } from './evidenceTypes'

export type CaseDetail = {
    schemaVersion?: string
    generatedAt?: string
    access?: { readOnly?: boolean, role?: string, blockerCodes?: string[] }
    case?: {
        id: string
        resolution?: CaseResolution
        title?: string
        status?: string
        priority?: string
        organizationId?: string
        tenantId?: string
        alertId?: string
        assignedOwner?: string
        createdAt?: string
        updatedAt?: string
        closedAt?: string
        lastDecision?: string
        events?: CaseEvent[]
        handoffActionReceipts?: unknown[]
        customerNotifications?: unknown[]
    }
    workflowState?: { status?: string, assignedOwner?: string, lastDecision?: string, eventCount?: number }
    workflowActionPolicy?: {
        summary?: { enabledActionIds?: string[], blockedActionIds?: string[], blockerCodes?: string[], readOnly?: boolean }
        actions?: CaseAction[]
    }
    alert?: CaseAlert
    alertContext?: {
        id?: string
        reviewState?: string
        deliveryState?: string
        assignedOwner?: string
        workflowNote?: string
        provenance?: CaseAlert['provenance']
        workflowEvents?: Array<{ id?: string, at?: string, actor?: string, note?: string, toReviewState?: string, toDeliveryState?: string }>
    }
    watchlists?: Array<{ id?: string, name?: string, matchedTerms?: Array<{ id?: string, kind?: string, value?: string }> }>
    deliveryContext?: { deliveryCount?: number, latestDelivery?: DeliveryRow, delivered?: boolean, retryable?: boolean, failed?: DeliveryRow[] }
    handoffActionReadiness?: { ready?: boolean, blockers?: string[], actions?: unknown[] }
    handoffActionReceipts?: unknown[]
    customerNotificationContext?: { count?: number, latestAt?: string, ready?: boolean, blockers?: string[] }
    deliveries?: DeliveryRow[]
    evidence?: EvidenceRow[]
    timeline?: TimelineRow[]
    nextActions?: Array<{ id?: string, label?: string, detail?: string, route?: string, enabled?: boolean }>
    nextAllowedActions?: CaseAction[]
}

export type CaseExport = {
    schemaVersion?: string
    summary?: {
        caseId?: string
        alertId?: string
        evidenceCount?: number
        deliveryCount?: number
        delivered?: boolean
        dedupeKey?: string
        recommendedRoute?: string
    }
    evidenceSummary?: EvidenceRow[]
    timelineSummary?: TimelineRow[]
    deliveryEvidence?: DeliveryRow[]
    copyText?: string
    exportChecksum?: string
}

export type CaseAction = {
    id: string
    label?: string
    method?: string
    requiresRationale?: boolean
    enabled?: boolean
    disabledReason?: string
}

type CaseEvent = {
    id?: string
    at?: string
    action?: string
    actor?: string
    note?: string
    fromStatus?: string
    toStatus?: string
    fromOwner?: string
    toOwner?: string
}

type CaseAlert = {
    id?: string
    severity?: string
    reviewState?: string
    deliveryState?: string
    matchedTerm?: { kind?: string, value?: string }
    sourceFamily?: string
    firstSeenAt?: string
    lastSeenAt?: string
    confidence?: number
    assertionKind?: 'source_claim'
    observedMatchSummary?: string
    claimSummary?: string
    routingContext?: { reason?: string }
    dedupeKey?: string
    provenance?: { sourceIds?: string[], captureIds?: string[], contentHashes?: string[] }
    webhookDelivery?: { dedupeKey?: string, endpointHash?: string, payloadHash?: string }
}

export type CaseDetailLoadState = {
    loading: boolean
    error?: string
    deliveryError?: string
    receiverError?: string
    destinationError?: string
    detail?: CaseDetail
    exportPayload?: CaseExport
    destinations?: WebhookDestination[]
    receiverReceipts?: ReceiverReceipt[]
}
