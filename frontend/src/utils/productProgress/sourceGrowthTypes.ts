import type {
    AnalystWorkflowReadiness, DashboardAlertEvidenceReadiness, DeployProbeReadiness, DwmAlertGenerationReadiness,
    DwmProductSnapshotReadiness, EntitlementReadiness, HelpdeskAuditReadiness, OrganizationAlertExportReadiness,
    PublicTiProvenanceReadiness, ReadinessStatus, ProductReadinessSnapshotBase, WebhookHealthReadiness,
} from './readinessTypes'

export type SourceGrowthReadiness = ProductReadinessSnapshotBase & {
    schemaVersion: 'dwm.source_inventory.v1' | string
    proxyExposed?: boolean
    inventoryReachable?: boolean
    sourcePacksReachable?: boolean
    sourceOperationsReady?: boolean
    sourceCustomerConfigReady?: boolean
    sourceReadinessArtifactReady?: boolean
    sourceProxyVerificationReady?: boolean
    sourceFamilyCount?: number
    parserSourceFamilyCount?: number
    parserSourceFamilyNames?: string[]
    registeredTotal?: number
    activeSourceCount?: number
    catalogCandidates?: number
    netNewCandidates?: number
    duplicateCandidates?: number
    reviewQueueCount?: number
    sourcePackCount?: number
    workerStatus?: 'ready' | 'missing' | 'stale' | 'blocked' | 'unavailable'
    workerLastRunAt?: string
    workerStaleAfterMinutes?: number
    queuedValidationJobs?: number
    validatingJobs?: number
    activeSourceRows?: number
    collectionReadyRows?: number
    latestInventoryAt?: string
    schemaLookupReady?: boolean
    schemaLookupSafe?: boolean
    contractLookupRows?: number
    receiptMatrixReady?: boolean
    receiptMatrixSafe?: boolean
    receiptMatrixRows?: number
    receiptMatrixBlockedRows?: number
    endToEndWorkflow?: ProductReadinessEndToEndWorkflowReadiness
}

type ProductReadinessEndToEndWorkflowState = 'ready' | 'partial' | 'blocked' | 'unsupported'

type ProductReadinessEndToEndWorkflowStep = {
    stepId?: string
    state?: ProductReadinessEndToEndWorkflowState | string
    consumerLane?: string
    ownerLane?: string
    route?: string
    typedFields?: Array<{ alias?: string, sourceField?: string, present?: boolean }>
    missingTypedFields?: string[]
    blockerCodes?: string[]
    proofLink?: {
        route?: string
        contractIds?: string[]
        schemaIds?: string[]
        receiptSchemaIds?: string[]
    }
}

export type ProductReadinessEndToEndWorkflowReadiness = {
    schemaVersion?: string
    state?: ProductReadinessEndToEndWorkflowState | string
    status?: ReadinessStatus
    detail?: string
    lastVerifiedAt?: string
    requiredStepIds?: string[]
    steps?: ProductReadinessEndToEndWorkflowStep[]
    typedFields?: string[]
    missingTypedFields?: string[]
    blockerCodes?: string[]
    consumerGuidanceSchemaVersion?: string
    stepCount?: number
    readyStepCount?: number
    blockedStepCount?: number
    missingFieldCount?: number
}

export type SourcePackWorkerReadinessSnapshot = {
    queuedValidationJobs?: number
    validatingJobs?: number
    activeSourceRows?: number
    collectionReadyRows?: number
}

export type ProductReadinessExternalState = {
    publicTiProvenance?: PublicTiProvenanceReadiness
    helpdeskAudit?: HelpdeskAuditReadiness
    deployProbe?: DeployProbeReadiness
    sourceGrowth?: SourceGrowthReadiness
    orgAlertExport?: OrganizationAlertExportReadiness
    webhookHealth?: WebhookHealthReadiness
    dashboardEvidence?: DashboardAlertEvidenceReadiness
    analystWorkflow?: AnalystWorkflowReadiness
    entitlement?: EntitlementReadiness
    dwmProduct?: DwmProductSnapshotReadiness
    alertGeneration?: DwmAlertGenerationReadiness
}
