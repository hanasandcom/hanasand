import type { ProductNorthStarRow, ProductNorthStarDirection, ProductNorthStarDeployGate, ProductNorthStarOwnerBlocker, ProductNorthStarDeployBlocker, ProductNorthStarProofDrilldown, ProductNorthStarProgressSource } from './northStarTypes'
import { PRODUCT_NORTH_STAR_ROW_IDS, PRODUCT_NORTH_STAR_DIRECTION_IDS, READINESS_STATUSES } from './northStarTypes'

export function isProductNorthStarRow(input: unknown): input is ProductNorthStarRow {
    if (!input || typeof input !== 'object') return false
    const row = input as Partial<ProductNorthStarRow>
    return isRowId(row.id)
        && isReadinessStatus(row.state)
        && isFilledString(row.label)
        && isFilledString(row.ownerLane)
        && typeof row.detail === 'string'
        && isFilledString(row.href)
        && typeof row.proofSource === 'string'
        && isFilledString(row.proofTimestamp)
        && typeof row.staleAfterSeconds === 'number'
        && row.staleAfterSeconds > 0
        && typeof row.proofAgeSeconds === 'number'
        && row.proofAgeSeconds >= 0
        && typeof row.proofStale === 'boolean'
        && isFilledString(row.expectedDashboardRowId)
        && isFilledString(row.backendProofContractVersion)
        && typeof row.blocker === 'string'
        && isFilledString(row.integrationProbeHint)
        && Array.isArray(row.proofDrilldowns)
        && row.proofDrilldowns.length >= 4
        && row.proofDrilldowns.every(isProductNorthStarProofDrilldown)
        && (row.state === 'ready' || Boolean(row.blocker))
}

export function isProductNorthStarDirection(input: unknown): input is ProductNorthStarDirection {
    if (!input || typeof input !== 'object') return false
    const direction = input as Partial<ProductNorthStarDirection>
    return isDirectionId(direction.id)
        && isReadinessStatus(direction.state)
        && isFilledString(direction.label)
        && typeof direction.detail === 'string'
        && isFilledString(direction.href)
        && Array.isArray(direction.ownerLanes)
        && direction.ownerLanes.every(isFilledString)
        && Array.isArray(direction.backedRowIds)
        && direction.backedRowIds.every(isRowId)
        && typeof direction.blocker === 'string'
        && isFilledString(direction.proofSummary)
        && (direction.state === 'ready' || Boolean(direction.blocker))
}

export function isProductNorthStarDeployGate(input: unknown): input is ProductNorthStarDeployGate {
    if (!input || typeof input !== 'object') return false
    const deployGate = input as Partial<ProductNorthStarDeployGate>
    return isReadinessStatus(deployGate.state)
        && typeof deployGate.fullChainReady === 'boolean'
        && typeof deployGate.readyRows === 'number'
        && typeof deployGate.totalRows === 'number'
        && isNonNegativeNumber(deployGate.proofDrilldownCount)
        && isNonNegativeNumber(deployGate.linkableProofDrilldownCount)
        && isNonNegativeNumber(deployGate.probeRouteCount)
        && Array.isArray(deployGate.workflowRoutes)
        && deployGate.workflowRoutes.every(isFilledString)
        && Array.isArray(deployGate.proofApiRoutes)
        && deployGate.proofApiRoutes.every(isFilledString)
        && Array.isArray(deployGate.probeRoutes)
        && deployGate.probeRoutes.every(isFilledString)
        && Array.isArray(deployGate.blockerRows)
        && deployGate.blockerRows.every(isRowId)
        && Array.isArray(deployGate.needsActionRows)
        && deployGate.needsActionRows.every(isRowId)
        && Array.isArray(deployGate.unavailableRows)
        && deployGate.unavailableRows.every(isRowId)
        && Array.isArray(deployGate.readyWorkflowLinks)
        && deployGate.readyWorkflowLinks.every(isFilledString)
        && Array.isArray(deployGate.actionNeededWorkflowLinks)
        && deployGate.actionNeededWorkflowLinks.every(isFilledString)
        && Array.isArray(deployGate.proofContracts)
        && deployGate.proofContracts.every(isFilledString)
        && Array.isArray(deployGate.ownerLanes)
        && deployGate.ownerLanes.every(isFilledString)
        && Array.isArray(deployGate.blockingOwnerLanes)
        && deployGate.blockingOwnerLanes.every(isProductNorthStarOwnerBlocker)
        && Array.isArray(deployGate.expectedDashboardRowIds)
        && deployGate.expectedDashboardRowIds.every(isFilledString)
        && typeof deployGate.firstBlocker === 'string'
        && Array.isArray(deployGate.blockingProofRows)
        && deployGate.blockingProofRows.every(isProductNorthStarDeployBlocker)
        && deployGate.blockingProofRows.length === deployGate.blockerRows.length + deployGate.needsActionRows.length + deployGate.unavailableRows.length
}

export function isProductNorthStarOwnerBlocker(input: unknown): input is ProductNorthStarOwnerBlocker {
    if (!input || typeof input !== 'object') return false
    const blocker = input as Partial<ProductNorthStarOwnerBlocker>
    return isFilledString(blocker.ownerLane)
        && Array.isArray(blocker.rowIds)
        && blocker.rowIds.length > 0
        && blocker.rowIds.every(isRowId)
        && Array.isArray(blocker.states)
        && blocker.states.length > 0
        && blocker.states.every(state => state === 'blocked' || state === 'needs_action' || state === 'unavailable')
        && Array.isArray(blocker.proofContracts)
        && blocker.proofContracts.every(isFilledString)
        && Array.isArray(blocker.workflowRoutes)
        && blocker.workflowRoutes.every(isFilledString)
}

export function isProductNorthStarDeployBlocker(input: unknown): input is ProductNorthStarDeployBlocker {
    if (!input || typeof input !== 'object') return false
    const blocker = input as Partial<ProductNorthStarDeployBlocker>
    return isRowId(blocker.rowId)
        && (blocker.state === 'blocked' || blocker.state === 'needs_action' || blocker.state === 'unavailable')
        && isFilledString(blocker.ownerLane)
        && isFilledString(blocker.href)
        && isFilledString(blocker.blocker)
        && isFilledString(blocker.proofTimestamp)
        && typeof blocker.staleAfterSeconds === 'number'
        && blocker.staleAfterSeconds > 0
        && typeof blocker.proofAgeSeconds === 'number'
        && blocker.proofAgeSeconds >= 0
        && typeof blocker.proofStale === 'boolean'
        && isFilledString(blocker.expectedDashboardRowId)
        && isFilledString(blocker.backendProofContractVersion)
        && isFilledString(blocker.integrationProbeHint)
        && Array.isArray(blocker.proofDrilldowns)
        && blocker.proofDrilldowns.length >= 4
        && blocker.proofDrilldowns.every(isProductNorthStarProofDrilldown)
}

export function isProductNorthStarProofDrilldown(input: unknown): input is ProductNorthStarProofDrilldown {
    if (!input || typeof input !== 'object') return false
    const drilldown = input as Partial<ProductNorthStarProofDrilldown>
    return (drilldown.kind === 'workflow' || drilldown.kind === 'api' || drilldown.kind === 'probe' || drilldown.kind === 'contract' || drilldown.kind === 'dashboard_row')
        && isFilledString(drilldown.label)
        && isFilledString(drilldown.value)
        && typeof drilldown.href === 'string'
}

export function isProductNorthStarProgressSource(input: unknown): input is ProductNorthStarProgressSource {
    if (!input || typeof input !== 'object') return false
    const source = input as Partial<ProductNorthStarProgressSource>
    return source.schemaVersion === 'product.progress_source.readiness.v1'
        && isFilledString(source.route)
        && isReadinessStatus(source.state)
        && (source.status === undefined || (typeof source.status === 'number' && source.status >= 0))
        && isFilledString(source.proofTimestamp)
        && (typeof source.unavailableReason === 'string' || source.unavailableReason === undefined)
        && isFilledString(source.backendProofContractVersion)
        && isFilledString(source.integrationProbeHint)
        && (source.state === 'ready' || isFilledString(source.unavailableReason))
}


function isRowId(input: unknown): input is import('./northStarTypes').ProductNorthStarRowId {
    return typeof input === 'string' && PRODUCT_NORTH_STAR_ROW_IDS.includes(input as import('./northStarTypes').ProductNorthStarRowId)
}
function isDirectionId(input: unknown): input is import('./northStarTypes').ProductNorthStarDirectionId {
    return typeof input === 'string' && PRODUCT_NORTH_STAR_DIRECTION_IDS.includes(input as import('./northStarTypes').ProductNorthStarDirectionId)
}
function isReadinessStatus(input: unknown): input is import('./readinessTypes').ReadinessStatus {
    return typeof input === 'string' && READINESS_STATUSES.includes(input as import('./readinessTypes').ReadinessStatus)
}
function isFilledString(input: unknown): input is string {
    return typeof input === 'string' && input.trim().length > 0
}
function isNonNegativeNumber(input: unknown): input is number {
    return typeof input === 'number' && Number.isFinite(input) && input >= 0
}
