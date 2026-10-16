export type ReadinessStatus = 'ready' | 'needs_action' | 'blocked' | 'unavailable'
type ProductReadinessOwnerLane = 'public-ti' | 'helpdesk' | 'integration' | 'source' | 'org' | 'webhook' | 'dashboard' | 'dwm'

export type ProductReadinessSnapshotBase = {
    status: ReadinessStatus
    checkedAt?: string
    detail?: string
    source?: string
    href?: string
    blockers?: string[]
    ownerLane?: ProductReadinessOwnerLane
    unavailableReason?: string
    staleAfterSeconds?: number
    proofTimestamp?: string
    expectedDashboardRowId?: string
    integrationProbeHint?: string
    backendProofContractVersion?: string
}

export type PublicTiProvenanceReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'ti.public_provenance.readiness.v1' | string
    query?: string
    actionabilityReady?: boolean
    artifactCount?: number
    sourceCount?: number
    evidenceCount?: number
    dashboardHandoffCount?: number
    watchlistCandidateCount?: number
    sourceProvenanceCount?: number
    relatedAlertCount?: number
    relatedCaseCount?: number
    enrichmentGapCount?: number
    handoffRouteCount?: number
    sourceFamilyCoverageCount?: number
    publicTiReadyFamilyCount?: number
    alertReadyFamilyCount?: number
    gapFamilyCount?: number
    retryFamilyCount?: number
    sourceFamilyOperationTypeCount?: number
    latestArtifactAt?: string
}

export type HelpdeskAuditReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'support.audit.readiness.v1' | string
    auditedActions?: number
    openRecoveryRequests?: number
    impersonationSessions?: number
    supportQueueDepth?: number
    latestAuditEventAt?: string
}

export type DeployProbeReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'product.deploy_probe.readiness.v1' | string
    deployedCommit?: string
    frontendHealthy?: boolean
    apiHealthy?: boolean
    scraperHealthy?: boolean
    latestProbeAt?: string
    dashboardAlertId?: string
    deliveryId?: string
    ledgerPath?: string
}

export type OrganizationAlertExportReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'organization.watchlist_alert_terms_export.v1' | string
    organizationId?: string
    activeTermCount?: number
    pausedCount?: number
    archivedCount?: number
    canGenerateAlerts?: boolean
    exportedAt?: string
    requestId?: string
}

export type WebhookHealthReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'dwm.webhook_health.readiness.v1' | string
    destinationCount?: number
    activeDestinationCount?: number
    deliveryReadyCount?: number
    latestDeliveryAt?: string
    latestAuditEventAt?: string
}

export type DashboardAlertEvidenceReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'dashboard.alert_evidence.readiness.v1' | string
    alertId?: string
    deliveryId?: string
    visibleInDashboard?: boolean
    deliveryEvidenceMatched?: boolean
    sourceProxyReady?: boolean
    deployProbeFresh?: boolean
    dashboardPath?: string
}

export type AnalystWorkflowReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'analyst.workflow.readiness.v1' | string
    caseId?: string
    alertId?: string
    caseStatus?: string
    assignedOwner?: string
    latestCaseAt?: string
    caseDetailReady?: boolean
    caseDetailRoute?: string
    caseDetailSchemaVersion?: string
    caseDetailTimelineCount?: number
    caseDetailReadOnly?: boolean
}

export type EntitlementReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'dwm.entitlement.readiness.v1' | string
    organizationId?: string
    policy?: string
    allowed?: boolean
    checkedRole?: string
}

export type DwmProductSnapshotReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'dwm.product_snapshot.readiness.v1' | string
    tenantId?: string
    watchlistTermCount?: number
    alertCount?: number
    sourceFamilyCount?: number
    actorOverviewCount?: number
    latestAlertAt?: string
    readinessDecision?: string
}

export type DwmAlertGenerationReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'dwm.alert_generation_readiness.v1' | string
    readyForCustomerDelivery?: boolean
    candidateCount?: number
    captureRefCount?: number
    matchedCandidateCount?: number
    missingRouteCandidateCount?: number
    generationEvidenceWindowReady?: boolean
    generationEvidenceWindowCaptureCount?: number
    generationEvidenceWindowSourceFamilies?: string[]
    latestEvidenceAt?: string
    blockerCodes?: string[]
}
