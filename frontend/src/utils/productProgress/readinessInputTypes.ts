import type { DeployProbeReadiness, DwmAlertGenerationReadiness, DwmProductSnapshotReadiness, EntitlementReadiness, OrganizationAlertExportReadiness, PublicTiProvenanceReadiness, WebhookHealthReadiness } from './readinessTypes'
import type { DashboardSourceProofProxyPayload, ProductProgressReadinessPayload } from './payloadTypes'

export type AlertProofRow = {
    id?: string
    updatedAt?: string
    createdAt?: string
}

export type DeliveryProofRow = {
    id?: string
    alertId?: string
    status?: string
    attemptedAt?: string
    createdAt?: string
}

export type AnalystCaseProofRow = {
    id?: string
    alertId?: string
    status?: string
    assignedOwner?: string
    updatedAt?: string
    createdAt?: string
}

export type AnalystCaseDetailProofInput = {
    route: string
    fetchOk: boolean
    fetchStatus?: number
    fetchError?: string
    schemaVersion?: string
    caseId?: string
    alertId?: string
    status?: string
    assignedOwner?: string
    updatedAt?: string
    readOnly?: boolean
    canMutate?: boolean
    timelineCount?: number
    proofTimestamp?: string
}

export type DwmAlertGenerationReadinessInput = DwmAlertGenerationReadiness

export type ProductProgressEndpointInput = {
    generatedAt: string
    checkedAt?: string
    query: string
    routes: NonNullable<ProductProgressReadinessPayload['routes']>
    sourceProxy?: DashboardSourceProofProxyPayload
    alertGeneration?: DwmAlertGenerationReadinessInput
    alerts?: AlertProofRow[]
    cases?: AnalystCaseProofRow[]
    caseDetail?: AnalystCaseDetailProofInput
    deliveries?: DeliveryProofRow[]
    deploy?: Partial<DeployProbeReadiness>
    entitlement?: EntitlementReadiness
    publicTiProvenance?: PublicTiProvenanceReadiness
    orgAlertExport?: OrganizationAlertExportReadiness
    webhookHealth?: WebhookHealthReadiness
    dwmProduct?: DwmProductSnapshotReadiness
}
