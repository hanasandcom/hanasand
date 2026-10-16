import type { ReadinessStatus } from './readinessTypes'
import type { ProductReadinessAggregateSource } from './productReadinessAggregateTypes'
import type { ProductReadinessExternalState } from './sourceGrowthTypes'

export const PRODUCT_NORTH_STAR_ROW_IDS = [
    'organizations',
    'shared_watchlists',
    'source_coverage',
    'real_alert_generation',
    'webhook_delivery',
    'analyst_workflow',
    'support_admin_audit',
    'public_ti_enrichment',
    'deploy_live_status',
] as const

export const PRODUCT_NORTH_STAR_DIRECTION_IDS = [
    'multi_org_threat_monitoring',
    'source_backed_intelligence',
    'shared_alert_workflow',
    'delivery_destinations',
    'enterprise_support',
] as const

export const READINESS_STATUSES = ['ready', 'needs_action', 'blocked', 'unavailable'] as const

export type ProductNorthStarRowId =
    | 'organizations'
    | 'shared_watchlists'
    | 'source_coverage'
    | 'real_alert_generation'
    | 'webhook_delivery'
    | 'analyst_workflow'
    | 'support_admin_audit'
    | 'public_ti_enrichment'
    | 'deploy_live_status'

export type ProductNorthStarRow = {
    id: ProductNorthStarRowId
    label: string
    state: ReadinessStatus
    ownerLane: string
    detail: string
    href: string
    proofSource: string
    proofTimestamp: string
    staleAfterSeconds: number
    proofAgeSeconds: number
    proofStale: boolean
    expectedDashboardRowId: string
    backendProofContractVersion: string
    blocker: string
    integrationProbeHint: string
    proofDrilldowns: ProductNorthStarProofDrilldown[]
}

export type ProductNorthStarProofDrilldown = {
    kind: 'workflow' | 'api' | 'probe' | 'contract' | 'dashboard_row'
    label: string
    value: string
    href: string
}

export type ProductNorthStarDirectionId =
    | 'multi_org_threat_monitoring'
    | 'source_backed_intelligence'
    | 'shared_alert_workflow'
    | 'delivery_destinations'
    | 'enterprise_support'

export type ProductNorthStarDirection = {
    id: ProductNorthStarDirectionId
    label: string
    state: ReadinessStatus
    detail: string
    href: string
    ownerLanes: string[]
    backedRowIds: ProductNorthStarRowId[]
    blocker: string
    proofSummary: string
}

export type ProductNorthStarDeployGate = {
    state: ReadinessStatus
    fullChainReady: boolean
    readyRows: number
    totalRows: number
    proofDrilldownCount: number
    linkableProofDrilldownCount: number
    probeRouteCount: number
    workflowRoutes: string[]
    proofApiRoutes: string[]
    probeRoutes: string[]
    blockerRows: ProductNorthStarRowId[]
    needsActionRows: ProductNorthStarRowId[]
    unavailableRows: ProductNorthStarRowId[]
    readyWorkflowLinks: string[]
    actionNeededWorkflowLinks: string[]
    proofContracts: string[]
    ownerLanes: string[]
    blockingOwnerLanes: ProductNorthStarOwnerBlocker[]
    expectedDashboardRowIds: string[]
    firstBlocker: string
    blockingProofRows: ProductNorthStarDeployBlocker[]
}

export type ProductNorthStarOwnerBlocker = {
    ownerLane: string
    rowIds: ProductNorthStarRowId[]
    states: Array<Exclude<ReadinessStatus, 'ready'>>
    proofContracts: string[]
    workflowRoutes: string[]
}

export type ProductNorthStarDeployBlocker = {
    rowId: ProductNorthStarRowId
    state: Exclude<ReadinessStatus, 'ready'>
    ownerLane: string
    href: string
    blocker: string
    proofTimestamp: string
    staleAfterSeconds: number
    proofAgeSeconds: number
    proofStale: boolean
    expectedDashboardRowId: string
    backendProofContractVersion: string
    integrationProbeHint: string
    proofDrilldowns: ProductNorthStarProofDrilldown[]
}

export type ProductNorthStarProgressSource = {
    schemaVersion: 'product.progress_source.readiness.v1'
    route: string
    state: ReadinessStatus
    status?: number
    proofTimestamp: string
    unavailableReason?: string
    backendProofContractVersion: string
    integrationProbeHint: string
}

export type ProductNorthStarScoreboard = {
    schemaVersion: 'product.north_star.readiness.v1'
    generatedAt: string
    query: string
    fullChainReady: boolean
    readyRows: number
    totalRows: number
    firstBlocker?: string
    progressSource: ProductNorthStarProgressSource
    productReadinessAggregate: ProductReadinessAggregateSource
    deployGate: ProductNorthStarDeployGate
    direction: ProductNorthStarDirection[]
    rows: ProductNorthStarRow[]
}

export type BuildOptions = {
    generatedAt: string
    query?: string
    external?: ProductReadinessExternalState
    progressSource?: ProductNorthStarProgressSource
    productReadinessAggregate?: ProductReadinessAggregateSource
}
