
export type WebhookDestination = {
    id: string
    name?: string
    status?: string
    endpointHash?: string
    endpointHint?: string
    kind?: string
    type?: string
    deliveryReady?: boolean
    createdAt?: string
    updatedAt?: string
    signingSecret?: string
    signingConfigured?: boolean
}

export type DeliveryRow = {
    id: string
    requestId?: string
    auditEventId?: string
    auditAction?: string
    organizationId?: string
    orgId?: string
    tenantId?: string
    alertId?: string
    caseId?: string
    actionId?: string
    watchlistId?: string
    watchlistName?: string
    watchlistItemId?: string
    watchlistIds?: string[]
    watchlistItemIds?: string[]
    destinationId?: string
    webhookDestinationId?: string
    endpointHash?: string
    endpointHint?: string
    deliveryKind?: string
    status?: string
    httpStatus?: number
    responseStatus?: number
    attemptedAt?: string
    createdAt?: string
    updatedAt?: string
    dryRun?: boolean
    error?: string
    errorClass?: string
    responseSummary?: string
    responseBody?: string
    payloadHash?: string
    payload?: Record<string, unknown>
    casePath?: string
    payloadPreview?: DeliveryPayloadPreviewData | null
    sanitizedPayloadPreview?: DeliveryPayloadPreviewData | null
    dedupeKey?: string
    idempotencyKey?: string
    retryCount?: number
    attemptCount?: number
    nextRetryAt?: string | null
}

export type DeliveryPayloadPreviewData = {
    title?: string | null
    contentPreview?: string | null
    descriptionPreview?: string | null
    fieldNames?: string[]
    fields?: Array<{ name?: string, valuePreview?: string, inline?: boolean }>
    payloadHash?: string | null
    context?: {
        orgName?: string | null
        orgId?: string | null
        alertTitle?: string | null
        alertId?: string | null
        severity?: string | null
        sourceFamily?: string | null
        evidenceCount?: number | null
        evidenceTimestamp?: string | null
        watchlistName?: string | null
        watchlistId?: string | null
        matchReason?: string | null
        deliveryState?: string | null
        casePath?: string | null
        alertUrl?: string | null
    }
}
