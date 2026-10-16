import type { ProductNorthStarDeployGate, ProductNorthStarRow } from './northStarTypes'
import { proofRoutesByKind, sameOwnerBlockers, sameStringSet, sameDrilldowns } from './northStarProof'

export function deployGateMatchesRows(deployGate: ProductNorthStarDeployGate, rows: ProductNorthStarRow[]) {
    const readyRows = rows.filter(row => row.state === 'ready')
    const nonReadyRows = rows.filter(row => row.state !== 'ready')
    const rowById = new Map(rows.map(row => [row.id, row]))
    const drilldowns = rows.flatMap(row => row.proofDrilldowns)
    if (!sameStringSet(deployGate.blockerRows, rows.filter(row => row.state === 'blocked').map(row => row.id))) return false
    if (!sameStringSet(deployGate.needsActionRows, rows.filter(row => row.state === 'needs_action').map(row => row.id))) return false
    if (!sameStringSet(deployGate.unavailableRows, rows.filter(row => row.state === 'unavailable').map(row => row.id))) return false
    if (!sameStringSet(deployGate.blockingProofRows.map(row => row.rowId), nonReadyRows.map(row => row.id))) return false
    if (deployGate.proofDrilldownCount !== drilldowns.length) return false
    if (deployGate.linkableProofDrilldownCount !== drilldowns.filter(item => Boolean(item.href)).length) return false
    if (deployGate.probeRouteCount !== drilldowns.filter(item => item.kind === 'probe').length) return false
    if (!sameStringSet(deployGate.workflowRoutes, proofRoutesByKind(drilldowns, 'workflow'))) return false
    if (!sameStringSet(deployGate.proofApiRoutes, proofRoutesByKind(drilldowns, 'api'))) return false
    if (!sameStringSet(deployGate.probeRoutes, proofRoutesByKind(drilldowns, 'probe'))) return false
    if (!sameOwnerBlockers(deployGate.blockingOwnerLanes, nonReadyRows)) return false
    if (!deployGate.blockingProofRows.every(blocker => {
        const row = rowById.get(blocker.rowId)
        return Boolean(row)
            && row?.state === blocker.state
            && row.ownerLane === blocker.ownerLane
            && row.href === blocker.href
            && row.blocker === blocker.blocker
            && row.proofTimestamp === blocker.proofTimestamp
            && row.staleAfterSeconds === blocker.staleAfterSeconds
            && row.proofAgeSeconds === blocker.proofAgeSeconds
            && row.proofStale === blocker.proofStale
            && row.expectedDashboardRowId === blocker.expectedDashboardRowId
            && row.backendProofContractVersion === blocker.backendProofContractVersion
            && row.integrationProbeHint === blocker.integrationProbeHint
            && sameDrilldowns(row.proofDrilldowns, blocker.proofDrilldowns)
    })) return false
    if (!sameStringSet(deployGate.readyWorkflowLinks, readyRows.map(row => row.href))) return false
    if (!sameStringSet(deployGate.actionNeededWorkflowLinks, nonReadyRows.map(row => row.href))) return false
    return true
}

