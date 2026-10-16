import type { PublicTiProvenanceReadiness, HelpdeskAuditReadiness, DeployProbeReadiness, OrganizationAlertExportReadiness, WebhookHealthReadiness, DashboardAlertEvidenceReadiness, AnalystWorkflowReadiness, EntitlementReadiness, DwmProductSnapshotReadiness, DwmAlertGenerationReadiness } from './readinessTypes'
import type { SourcePackWorkerReadinessSnapshot } from './sourceGrowthTypes'
import type { ProductReadinessEndToEndWorkflowReadiness } from './sourceGrowthTypes'
import { PRODUCT_PROGRESS_SCHEMA_VERSION } from './readinessLabels'

export type DashboardSourceProofProxyPayload = {
    ok?: boolean
    generatedAt?: string
    query?: string
    baseConfigured?: boolean
    error?: { code?: string, message?: string }
    endpoints?: {
        sourceInventory?: { ok?: boolean, status?: number, error?: string }
        sourcePacks?: { ok?: boolean, status?: number, error?: string }
        contracts?: { ok?: boolean, status?: number, error?: string }
    }
    contracts?: {
        schemaLookup?: {
            schemaVersion?: string
            rows?: Array<{
                schemaId?: string
                contractId?: string
                ownerLane?: string
                route?: string
                scopeFields?: unknown[]
                blockerCodes?: unknown[]
                downstreamConsumers?: unknown[]
                safeOutput?: {
                    metadataOnly?: boolean
                    rawEvidenceExposed?: boolean
                    webhookSecretExposed?: boolean
                    crossOrgDataExposed?: boolean
                }
            }>
            safeOutput?: {
                metadataOnly?: boolean
                rawEvidenceExposed?: boolean
                webhookSecretExposed?: boolean
                crossOrgDataExposed?: boolean
            }
        }
        productReadinessReceiptMatrix?: {
            schemaVersion?: string
            aggregateSchemaVersion?: string
            route?: string
            rows?: Array<{
                capabilityId?: string
                ownerLane?: string
                readinessRoute?: string
                contractIds?: unknown[]
                schemaIds?: unknown[]
                receiptSchemaIds?: unknown[]
                blockerCodes?: unknown[]
                scopeFields?: unknown[]
                downstreamConsumers?: unknown[]
                safeOutput?: {
                    metadataOnly?: boolean
                    rawEvidenceExposed?: boolean
                    webhookSecretExposed?: boolean
                    crossOrgDataExposed?: boolean
                }
            }>
            safeOutput?: {
                metadataOnly?: boolean
                rawEvidenceExposed?: boolean
                webhookSecretExposed?: boolean
                crossOrgDataExposed?: boolean
            }
        }
        productReadinessEndToEndWorkflowPacket?: ProductReadinessEndToEndWorkflowReadiness
    }
    sourceInventory?: {
        schemaVersion?: string
        generatedAt?: string
        counts?: {
            registeredTotal?: number
            registeredActiveOrCanary?: number
            catalogTotalCandidates?: number
            netNewCandidates?: number
            duplicateCandidates?: number
            reviewQueue?: number
        }
    }
    sourcePacks?: {
        schemaVersion?: string
        generatedAt?: string
        counts?: {
            packCount?: number
            candidateCount?: number
        }
        workerReadiness?: SourcePackWorkerReadinessSnapshot
        readiness?: SourcePackWorkerReadinessSnapshot & { state?: string, blockers?: string[] }
        lastRun?: { completedAt?: string, updatedAt?: string, startedAt?: string, status?: string }
        sourceOperationsReadiness?: {
            schemaVersion?: string
            nextOperatorActions?: unknown[]
            typedBlockers?: Array<{ code?: string, severity?: string }>
        }
        sourceCustomerConfig?: {
            schemaVersion?: string
            sourceConfigs?: Array<{ redactedIdentity?: { rawStored?: boolean } }>
            safeOutput?: {
                rawTargetsExposed?: boolean
                privateTelegramContentExposed?: boolean
                liveNetworkScrapeStarted?: boolean
            }
        }
        sourceReadinessArtifact?: {
            schemaVersion?: string
            readinessLedgerRows?: unknown[]
            actorCoverage?: unknown[]
            sharedWatchlistAlertability?: {
                activeSourceFamilies?: unknown[]
                matchableFields?: unknown[]
                sourceTrust?: unknown
            }
            safeOutput?: {
                liveNetworkScrapeStarted?: boolean
            }
        }
        proxyVerification?: {
            schemaVersion?: string
            state?: string
            blockers?: string[]
            checks?: Array<{ id?: string, status?: string }>
            requiredJsonPaths?: string[]
            worker3JsonAssertions?: string[]
        }
        sourceFamilyCounts?: Record<string, number>
        parserSourceFamilyCounts?: Record<string, number>
    }
}

export type ProductProgressReadinessPayload = {
    schemaVersion: typeof PRODUCT_PROGRESS_SCHEMA_VERSION | string
    generatedAt?: string
    checkedAt?: string
    routes?: {
        productProgress?: string
        publicTiProvenance?: string
        helpdeskAudit?: string
        deployProbe?: string
        sourceProxy?: string
        orgAlertExport?: string
        webhookHealth?: string
        dashboardAlerts?: string
        cases?: string
        entitlement?: string
        organizationReadiness?: string
        alertGenerationReadiness?: string
        organizations?: string
        watchlists?: string
        operations?: string
        dwmProduct?: string
        deliveries?: string
        organizationWebhooks?: string
        supportRecovery?: string
        adminAuditEvents?: string
    }
    publicTiProvenance?: PublicTiProvenanceReadiness
    helpdeskAudit?: HelpdeskAuditReadiness
    deployProbe?: DeployProbeReadiness
    sourceProxy?: DashboardSourceProofProxyPayload
    orgAlertExport?: OrganizationAlertExportReadiness
    webhookHealth?: WebhookHealthReadiness
    dashboardEvidence?: DashboardAlertEvidenceReadiness
    analystWorkflow?: AnalystWorkflowReadiness
    entitlement?: EntitlementReadiness
    dwmProduct?: DwmProductSnapshotReadiness
    alertGeneration?: DwmAlertGenerationReadiness
}
