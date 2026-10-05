import { safeEvidenceExcerpt } from '@/utils/dwm/display'

// Shared operational case and readiness shapes used by the Hanasand dashboard.

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

function sanitizeWorkbenchCopy(value: string | undefined) {
    if (!value) return value
    return value
        .replace(/hanasand-live-status-\d+/gi, 'Hanasand live org')
        .replace(/hanasand-live-status/gi, 'Hanasand live org')
        .replace(/generation status/gi, 'generation status')
        .replace(/alertability status/gi, 'alertability status')
        .replace(/customer process status/gi, 'customer process status')
        .replace(/worker status/gi, 'worker status')
        .replace(/audit status/gi, 'audit trail')
        .replace(/status/gi, 'status')
        .replace(/readiness/gi, 'status')
        .replace(/receipt delivery/gi, 'delivery history')
        .replace(/receipt/gi, 'delivery')
}

function safeWorkbenchDetail(value: string | undefined) {
    return safeEvidenceExcerpt(value || 'Safe excerpt is being prepared from this evidence.')
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

export type WorkbenchProductReadinessItem = {
    id: string
    label: string
    status: 'ready' | 'needs_action' | 'blocked' | 'unavailable'
    detail: string
    source: string
    href?: string
    workflowBlocker?: string
    customerImpact?: string
    evidenceProvenance?: string
    actions?: WorkbenchAction[]
    checkedAt?: string
    blockerCount?: number
    deepLinkTarget?: string
    proofTimestamp?: string
    unavailableReason?: string
    staleAfterSeconds?: number
    expectedDashboardRowId?: string
    integrationProbeHint?: string
    backendProofContractVersion?: string
    ownerLane?: string
    operatorAction?: string
    caseId?: string
    alertId?: string
    caseStatus?: string
    assignedOwner?: string
    caseDetailHref?: string
    caseDetailReady?: boolean
    caseDetailTimelineCount?: number
    caseDetailReadOnly?: boolean
    candidateCount?: number
    captureRefCount?: number
    matchedCandidateCount?: number
    missingRouteCandidateCount?: number
    generationEvidenceWindowCaptureCount?: number
    generationEvidenceWindowSourceFamilies?: string[]
    latestEvidenceAt?: string
    organizationId?: string
    activeTermCount?: number
    pausedCount?: number
    archivedCount?: number
    canGenerateAlerts?: boolean
    exportedAt?: string
    destinationCount?: number
    activeDestinationCount?: number
    deliveryReadyCount?: number
    latestDeliveryAt?: string
    latestAuditEventAt?: string
    workerStatus?: 'ready' | 'missing' | 'stale' | 'blocked' | 'unavailable'
    workerLastRunAt?: string
    queuedValidationJobs?: number
    validatingJobs?: number
    activeSourceRows?: number
    collectionReadyRows?: number
    registeredTotal?: number
    activeSourceCount?: number
    sourceFamilyCount?: number
    reviewQueueCount?: number
    sourcePackCount?: number
    catalogCandidates?: number
    netNewCandidates?: number
    duplicateCandidates?: number
    parserSourceFamilyCount?: number
    parserSourceFamilyNames?: string[]
    schemaLookupReady?: boolean
    schemaLookupSafe?: boolean
    contractLookupRows?: number
    receiptMatrixReady?: boolean
    receiptMatrixSafe?: boolean
    receiptMatrixRows?: number
    receiptMatrixBlockedRows?: number
    endToEndWorkflowStepCount?: number
    endToEndWorkflowReadyStepCount?: number
    endToEndWorkflowBlockedStepCount?: number
    endToEndWorkflowMissingFieldCount?: number
}

export type WorkbenchCase = {
    id: string
    kind: 'dwm_alert' | 'source_capture' | 'org_readiness' | 'watchlist_readiness' | 'webhook_readiness' | 'source_readiness' | 'alert_readiness' | 'support_readiness'
    queue: string
    title: string
    subtitle: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    status: string
    priority: number
    confidence: number
    owner: string
    createdAt: string
    updatedAt: string
    company: string
    matchedTerm: string
    actor: string
    sourceLabel: string
    recommendedAction: string
    routeLabel: string
    persistent: boolean
    evidence: WorkbenchEvidence[]
    timeline: WorkbenchTimelineItem[]
    nextTasks: string[]
    relatedLinks: Array<{ href: string, label: string }>
    workflowPath?: WorkbenchWorkflowStep[]
    actions?: WorkbenchAction[]
    caseDetailHref?: string
    deliveryEvidence?: WorkbenchDeliveryEvidence[]
    missingDependency?: string
}
