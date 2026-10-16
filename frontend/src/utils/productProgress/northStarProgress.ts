import type { ProductProgressReadinessPayload } from './payloadTypes'
import type { ProductNorthStarRow, ProductNorthStarDirection, ProductNorthStarProgressSource, ProductNorthStarDeployGate, ProductNorthStarDirectionId, ProductNorthStarRowId } from './northStarTypes'
import type { ReadinessStatus } from './readinessTypes'
import { buildOwnerBlockers, proofRoutesByKind } from './northStarProof'
import { uniqueStrings } from './northStarRows'

export function defaultProgressSource(payload: ProductProgressReadinessPayload | null | undefined, generatedAt: string): ProductNorthStarProgressSource {
    return {
        schemaVersion: 'product.progress_source.readiness.v1',
        route: payload?.routes?.productProgress || '/api/product-progress',
        state: payload ? 'ready' : 'needs_action',
        status: payload ? 200 : undefined,
        proofTimestamp: payload?.checkedAt || payload?.generatedAt || generatedAt,
        unavailableReason: payload ? undefined : 'product_progress_not_loaded',
        backendProofContractVersion: payload?.schemaVersion || 'product.progress.readiness.v1',
        integrationProbeHint: 'GET /api/product-progress must return product.progress.readiness.v1 before the homepage summary can be treated as live-backed.',
    }
}

export function buildDeployGate(rows: ProductNorthStarRow[], summary: {
    fullChainReady: boolean
    readyRows: number
    firstBlocker?: string
}): ProductNorthStarDeployGate {
    const rowsNeedingAction = rows.filter(row => row.state !== 'ready')
    const proofDrilldowns = rows.flatMap(row => row.proofDrilldowns)
    return {
        state: summary.fullChainReady ? 'ready' : combineDirectionState(rows.map(row => row.state)),
        fullChainReady: summary.fullChainReady,
        readyRows: summary.readyRows,
        totalRows: rows.length,
        proofDrilldownCount: proofDrilldowns.length,
        linkableProofDrilldownCount: proofDrilldowns.filter(item => Boolean(item.href)).length,
        probeRouteCount: proofDrilldowns.filter(item => item.kind === 'probe').length,
        workflowRoutes: proofRoutesByKind(proofDrilldowns, 'workflow'),
        proofApiRoutes: proofRoutesByKind(proofDrilldowns, 'api'),
        probeRoutes: proofRoutesByKind(proofDrilldowns, 'probe'),
        blockerRows: rows.filter(row => row.state === 'blocked').map(row => row.id),
        needsActionRows: rows.filter(row => row.state === 'needs_action').map(row => row.id),
        unavailableRows: rows.filter(row => row.state === 'unavailable').map(row => row.id),
        readyWorkflowLinks: uniqueStrings(rows.filter(row => row.state === 'ready').map(row => row.href)),
        actionNeededWorkflowLinks: uniqueStrings(rowsNeedingAction.map(row => row.href)),
        proofContracts: uniqueStrings(rows.map(row => row.backendProofContractVersion)),
        ownerLanes: uniqueStrings(rows.map(row => row.ownerLane)),
        blockingOwnerLanes: buildOwnerBlockers(rowsNeedingAction),
        expectedDashboardRowIds: uniqueStrings(rows.flatMap(row => row.expectedDashboardRowId.split(',').map(id => id.trim()))),
        firstBlocker: summary.firstBlocker || '',
        blockingProofRows: rowsNeedingAction.map(row => ({
            rowId: row.id,
            state: row.state === 'ready' ? 'needs_action' : row.state,
            ownerLane: row.ownerLane,
            href: row.href,
            blocker: row.blocker,
            proofTimestamp: row.proofTimestamp,
            staleAfterSeconds: row.staleAfterSeconds,
            proofAgeSeconds: row.proofAgeSeconds,
            proofStale: row.proofStale,
            expectedDashboardRowId: row.expectedDashboardRowId,
            backendProofContractVersion: row.backendProofContractVersion,
            integrationProbeHint: row.integrationProbeHint,
            proofDrilldowns: row.proofDrilldowns,
        })),
    }
}

export function buildProductDirection(rows: ProductNorthStarRow[]): ProductNorthStarDirection[] {
    return [
        directionItem({
            id: 'multi_org_threat_monitoring',
            label: 'Multi-organization monitoring',
            backedRowIds: ['organizations', 'shared_watchlists'],
            detailReady: 'Organization access and shared watchlists are ready for team monitoring.',
            detailBlocked: 'Team monitoring needs organization access and shared watchlist data before it can be treated as connected.',
            rows,
        }),
        directionItem({
            id: 'source_backed_intelligence',
            label: 'Threat actor search',
            backedRowIds: ['source_coverage', 'public_ti_enrichment'],
            detailReady: 'Current collection and enrichment are connected across monitored sources.',
            detailBlocked: 'Intelligence quality depends on current source coverage and source-linked TI enrichment.',
            rows,
        }),
        directionItem({
            id: 'shared_alert_workflow',
            label: 'Shared alert workflow',
            backedRowIds: ['real_alert_generation', 'analyst_workflow'],
            detailReady: 'Fresh exposure claims can move from the queue into analyst triage.',
            detailBlocked: 'The alert workflow is not complete until a real alert is visible and reviewable by an analyst.',
            rows,
        }),
        directionItem({
            id: 'delivery_destinations',
            label: 'Delivery destinations',
            backedRowIds: ['webhook_delivery'],
            detailReady: 'Customer notifications are routed through configured delivery destinations.',
            detailBlocked: 'Delivery needs webhook lifecycle data and a matched delivery row.',
            rows,
        }),
        directionItem({
            id: 'enterprise_support',
            label: 'Enterprise support',
            backedRowIds: ['support_admin_audit', 'deploy_live_status'],
            detailReady: 'Support visibility and live service status are current.',
            detailBlocked: 'Support and release operations need audit history and a fresh deploy check.',
            rows,
        }),
    ]
}

function directionItem(input: {
    id: ProductNorthStarDirectionId
    label: string
    backedRowIds: ProductNorthStarRowId[]
    detailReady: string
    detailBlocked: string
    rows: ProductNorthStarRow[]
}): ProductNorthStarDirection {
    const backedRows = input.backedRowIds
        .map(id => input.rows.find(row => row.id === id))
        .filter((row): row is ProductNorthStarRow => Boolean(row))
    const state = combineDirectionState(backedRows.map(row => row.state))
    const blocker = backedRows.find(row => row.state !== 'ready')?.blocker || ''
    const href = backedRows.find(row => row.state !== 'ready')?.href || backedRows[0]?.href || '/dashboard'
    const ownerLanes = Array.from(new Set(backedRows.map(row => row.ownerLane).filter(Boolean)))
    const proofSummary = state === 'ready'
        ? input.detailReady
        : input.detailBlocked

    return {
        id: input.id,
        label: input.label,
        state,
        detail: state === 'ready' ? input.detailReady : input.detailBlocked,
        href,
        ownerLanes,
        backedRowIds: input.backedRowIds,
        blocker,
        proofSummary,
    }
}

function combineDirectionState(states: ReadinessStatus[]): ReadinessStatus {
    if (!states.length) return 'needs_action'
    if (states.every(state => state === 'ready')) return 'ready'
    if (states.some(state => state === 'blocked')) return 'blocked'
    if (states.some(state => state === 'needs_action')) return 'needs_action'
    return 'needs_action'
}
