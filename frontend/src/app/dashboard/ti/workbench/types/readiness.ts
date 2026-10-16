import type { WorkbenchAction } from './evidence'

export type WorkbenchReadinessEvidenceState = {
    status: 'ready' | 'blocked'
    reason?: string
    webhookDestinationId?: string
    deliveryId?: string
    activeSourceCount?: number
    sourceCount?: number
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
