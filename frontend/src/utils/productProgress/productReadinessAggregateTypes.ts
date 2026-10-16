export const PRODUCT_READINESS_AGGREGATE_SCHEMA_VERSION = 'hanasand.product_readiness.v1' as const
export const PRODUCT_READINESS_AGGREGATE_SOURCE_SCHEMA_VERSION = 'product.readiness_aggregate_source.v1' as const
export const DEFAULT_AGGREGATE_STALE_AFTER_SECONDS = 2 * 60 * 60
export const INLINE_LEDGER_KEYS = ['PRODUCT_READINESS_AGGREGATE_JSON', 'HANASAND_PRODUCT_READINESS_JSON'] as const
export const FILE_LEDGER_KEYS = ['PRODUCT_READINESS_AGGREGATE_PATH', 'HANASAND_PRODUCT_READINESS_PATH'] as const

export type ProductReadinessAggregateState = 'ready' | 'needs_action' | 'blocked' | 'unavailable'

export type ProductReadinessAggregate = {
    schemaVersion: typeof PRODUCT_READINESS_AGGREGATE_SCHEMA_VERSION
    checkedAt: string
    ok: boolean
    rowCount: number
    customerVisibleBlockedCount: number
    deployRisk: 'none' | 'low' | 'medium' | 'high' | string
    rows: ProductReadinessAggregateRow[]
}

export type ProductReadinessAggregateRow = {
    id: string
    ownerLane: string
    capabilityLabel: string
    proofArtifact: {
        schemaVersion: string
        artifactId: string
        route?: string
        probeId?: string
    }
    lastCheckedAt: string
    customerVisible: boolean
    customerVisibleState: ProductReadinessAggregateState
    blockers: string[]
    requiredNextAction: string
    deployRisk: string
    uiQualityProofExists: boolean
    workflowContract?: {
        route?: string
        proofRowId?: string
        testName?: string
        expectedAdapter?: string
        proofCommand?: string
    }
}

export type ProductReadinessAggregateSource = {
    schemaVersion: typeof PRODUCT_READINESS_AGGREGATE_SOURCE_SCHEMA_VERSION
    state: ProductReadinessAggregateState
    source: string
    checkedAt: string
    ok: boolean
    rowCount: number
    customerVisibleBlockedCount: number
    deployRisk: string
    staleAfterSeconds: number
    ageSeconds: number
    stale: boolean
    unavailableReason?: string
    blockingRows: ProductReadinessAggregateSourceRow[]
}

export type ProductReadinessAggregateSourceRow = {
    id: string
    label: string
    ownerLane: string
    state: ProductReadinessAggregateState
    lastCheckedAt: string
    lastCheckedAgeSeconds: number
    lastCheckedStale: boolean
    blockers: string[]
    proofArtifactSchemaVersion: string
    proofArtifactId: string
    route: string
    probeId: string
    requiredNextAction: string
    deployRisk: string
    uiQualityProofExists: boolean
    workflowRoute: string
    workflowProofRowId: string
    workflowTestName: string
    workflowExpectedAdapter: string
    workflowProofCommand: string
}

