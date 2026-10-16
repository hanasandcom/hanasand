import { PRODUCT_READINESS_AGGREGATE_SCHEMA_VERSION, type ProductReadinessAggregate, type ProductReadinessAggregateRow, type ProductReadinessAggregateSourceRow, type ProductReadinessAggregateState } from './productReadinessAggregateTypes'

export function parseProductReadinessAggregate(input: unknown): ProductReadinessAggregate | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== PRODUCT_READINESS_AGGREGATE_SCHEMA_VERSION) return undefined
    if (typeof input.checkedAt !== 'string') return undefined
    if (typeof input.ok !== 'boolean') return undefined
    if (typeof input.rowCount !== 'number') return undefined
    if (typeof input.customerVisibleBlockedCount !== 'number') return undefined
    if (typeof input.deployRisk !== 'string') return undefined
    if (!Array.isArray(input.rows)) return undefined
    const rows = input.rows.map(parseProductReadinessAggregateRow)
    if (rows.some(row => !row)) return undefined
    return {
        schemaVersion: PRODUCT_READINESS_AGGREGATE_SCHEMA_VERSION,
        checkedAt: input.checkedAt,
        ok: input.ok,
        rowCount: input.rowCount,
        customerVisibleBlockedCount: input.customerVisibleBlockedCount,
        deployRisk: input.deployRisk,
        rows: rows as ProductReadinessAggregateRow[],
    }
}

export function parseProductReadinessAggregateRow(input: unknown): ProductReadinessAggregateRow | undefined {
    if (!isRecord(input) || !isRecord(input.proofArtifact)) return undefined
    if (!isAggregateState(input.customerVisibleState)) return undefined
    if (!Array.isArray(input.blockers) || !input.blockers.every(value => typeof value === 'string')) return undefined
    const id = stringValue(input.id)
    const ownerLane = stringValue(input.ownerLane)
    const capabilityLabel = stringValue(input.capabilityLabel)
    const artifactSchemaVersion = stringValue(input.proofArtifact.schemaVersion)
    const artifactId = stringValue(input.proofArtifact.artifactId)
    const lastCheckedAt = stringValue(input.lastCheckedAt)
    const requiredNextAction = stringValue(input.requiredNextAction)
    const deployRisk = stringValue(input.deployRisk)
    if (!id || !ownerLane || !capabilityLabel || !artifactSchemaVersion || !artifactId || !lastCheckedAt || !requiredNextAction || !deployRisk) return undefined
    return {
        id,
        ownerLane,
        capabilityLabel,
        proofArtifact: {
            schemaVersion: artifactSchemaVersion,
            artifactId,
            route: typeof input.proofArtifact.route === 'string' ? input.proofArtifact.route : undefined,
            probeId: typeof input.proofArtifact.probeId === 'string' ? input.proofArtifact.probeId : undefined,
        },
        lastCheckedAt,
        customerVisible: input.customerVisible === true,
        customerVisibleState: input.customerVisibleState,
        blockers: input.blockers,
        requiredNextAction,
        deployRisk,
        uiQualityProofExists: input.uiQualityProofExists === true,
        workflowContract: isRecord(input.workflowContract)
            ? {
                route: typeof input.workflowContract.route === 'string' ? input.workflowContract.route : undefined,
                proofRowId: typeof input.workflowContract.proofRowId === 'string' ? input.workflowContract.proofRowId : undefined,
                testName: typeof input.workflowContract.testName === 'string' ? input.workflowContract.testName : undefined,
                expectedAdapter: typeof input.workflowContract.expectedAdapter === 'string' ? input.workflowContract.expectedAdapter : undefined,
                proofCommand: typeof input.workflowContract.proofCommand === 'string' ? input.workflowContract.proofCommand : undefined,
            }
            : undefined,
    }
}

export function isProductReadinessAggregateSourceRow(input: unknown): input is ProductReadinessAggregateSourceRow {
    if (!isRecord(input)) return false
    return typeof input.id === 'string'
        && typeof input.label === 'string'
        && typeof input.ownerLane === 'string'
        && isAggregateState(input.state)
        && typeof input.lastCheckedAt === 'string'
        && typeof input.lastCheckedAgeSeconds === 'number'
        && typeof input.lastCheckedStale === 'boolean'
        && Array.isArray(input.blockers)
        && input.blockers.every(value => typeof value === 'string')
        && typeof input.proofArtifactSchemaVersion === 'string'
        && typeof input.proofArtifactId === 'string'
        && typeof input.route === 'string'
        && typeof input.probeId === 'string'
        && typeof input.requiredNextAction === 'string'
        && typeof input.deployRisk === 'string'
        && typeof input.uiQualityProofExists === 'boolean'
        && typeof input.workflowRoute === 'string'
        && typeof input.workflowProofRowId === 'string'
        && typeof input.workflowTestName === 'string'
        && typeof input.workflowExpectedAdapter === 'string'
        && typeof input.workflowProofCommand === 'string'
}


export function isAggregateState(input: unknown): input is ProductReadinessAggregateState {
    return input === 'ready' || input === 'needs_action' || input === 'blocked' || input === 'unavailable'
}

export function isRecord(input: unknown): input is Record<string, unknown> {
    return Boolean(input) && typeof input === 'object'
}

function stringValue(input: unknown) {
    return typeof input === 'string' ? input.trim() : ''
}
