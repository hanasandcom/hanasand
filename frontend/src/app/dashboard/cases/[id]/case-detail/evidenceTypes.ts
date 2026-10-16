export type EvidenceRow = {
    id?: string
    sourceName?: string
    sourceFamily?: string
    observedAt?: string
    collectedAt?: string
    contentHash?: string
    safeExcerpt?: string
    excerpt?: string
    redaction?: { redacted?: boolean }
    provenance?: { sourceId?: string, captureId?: string, contentHash?: string }
}

export type DeliveryRow = {
    id?: string
    alertId?: string
    caseId?: string
    requestId?: string
    auditEventId?: string
    status?: string
    attemptedAt?: string
    endpointHash?: string
    endpointHint?: string
    webhookDestinationId?: string
    destinationId?: string
    payloadHash?: string
    dedupeKey?: string
    idempotencyKey?: string
    dryRun?: boolean
    httpStatus?: number
    error?: string
    errorClass?: string
    attemptCount?: number | null
    retryCount?: number | null
    nextRetryAt?: string | null
    retryable?: boolean
    reportValidation?: string
    reportExportChecksum?: string
    reportCaseId?: string
    thirdPartyReport?: boolean
}

export type ReceiverReceipt = {
    id?: string
    destinationId?: string
    deliveryId?: string
    idempotencyKey?: string
    payloadHash?: string
    reportCaseId?: string
    reportExportChecksum?: string
    receivedAt?: string
    persistedAt?: string
}

export type WebhookDestination = {
    id: string
    name?: string
    kind?: string
    endpointHint?: string
    status?: string
}

export type TimelineRow = {
    id?: string
    timestamp?: string
    at?: string
    eventType?: string
    action?: string
    actor?: string
    source?: string
    rationale?: string
    note?: string
    related?: Record<string, unknown>
    workflow?: {
        fromStatus?: string
        toStatus?: string
        fromOwner?: string
        toOwner?: string
    }
}
