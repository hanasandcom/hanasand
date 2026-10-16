import { buildProductProgressExternalState } from './externalState'
import { missingProductReadinessAggregateSource } from './productReadinessAggregate'
import type { ProductProgressReadinessPayload } from './payloadTypes'
import { defaultProgressSource, buildDeployGate, buildProductDirection } from './northStarProgress'
import { organizationsRow, snapshotRow, realAlertGenerationRow, webhookDeliveryRow, publicTiEnrichmentRow } from './northStarRows'
import type { ProductNorthStarScoreboard, ProductNorthStarRow, BuildOptions } from './northStarTypes'
export * from './northStarTypes'
export { parseProductNorthStarScoreboard } from './northStarValidation'

export function buildProductNorthStarScoreboard(payload: ProductProgressReadinessPayload | null | undefined, options: BuildOptions): ProductNorthStarScoreboard {
    const generatedAt = payload?.generatedAt || options.generatedAt
    const query = options.query || 'company watchlist'
    const external = options.external || buildProductProgressExternalState(payload, {
        checkedAt: payload?.checkedAt || generatedAt,
        staleAfterMinutes: 120,
    })
    const rows: ProductNorthStarRow[] = [
        organizationsRow(external, generatedAt),
        snapshotRow({
            id: 'shared_watchlists',
            label: 'Shared watchlists',
            snapshot: external.orgAlertExport,
            fallbackHref: '/findings',
            fallbackOwner: 'org',
            fallbackExpectedDashboardRowId: 'org_alert_export',
            fallbackContract: 'organization.watchlist_alert_terms_export.v1',
            fallbackProbe: 'GET /api/organizations/:id/watchlist-alert-terms must return active terms and canGenerateAlerts.',
            fallbackBlocker: 'Connect shared watchlist terms to customer alert routing.',
            readyDetail: 'Active organization terms can generate DWM alerts.',
        }),
        snapshotRow({
            id: 'source_coverage',
            label: 'Source coverage',
            snapshot: external.sourceGrowth,
            fallbackHref: '/ti/sources',
            fallbackOwner: 'source',
            fallbackExpectedDashboardRowId: 'source_inventory_probe',
            fallbackContract: 'dwm.source_inventory.v1',
            fallbackProbe: 'GET /api/ti/scraper/control?q=<query> must expose source inventory, source packs, worker state, safe schema lookup, and source QA matrix.',
            fallbackBlocker: 'Run the TI source worker and refresh source coverage.',
            readyDetail: 'Source inventory, worker state, schema lookup, and QA matrix are current.',
        }),
        realAlertGenerationRow(external, generatedAt),
        webhookDeliveryRow(external, generatedAt),
        snapshotRow({
            id: 'analyst_workflow',
            label: 'analyst process',
            snapshot: external.analystWorkflow,
            fallbackHref: '/ti/workbench',
            fallbackOwner: 'dashboard',
            fallbackExpectedDashboardRowId: 'analyst_workflow',
            fallbackContract: 'analyst.workflow.readiness.v1',
            fallbackProbe: 'GET /api/cases must return a case linked to the dashboard-visible alert before analyst process is connected.',
            fallbackBlocker: 'No backed analyst case is available for review.',
            readyDetail: 'A backed analyst case is linked to a dashboard alert.',
            hrefOverride: '/ti/workbench',
        }),
        snapshotRow({
            id: 'support_admin_audit',
            label: 'Support and admin audit',
            snapshot: external.helpdeskAudit,
            fallbackHref: '/helpdesk',
            fallbackOwner: 'helpdesk',
            fallbackExpectedDashboardRowId: 'helpdesk_audit',
            fallbackContract: 'support.audit.readiness.v1',
            fallbackProbe: 'GET /api/admin/support/status must return structured audit and recovery queue status.',
            fallbackBlocker: 'Connect support actions and recovery audit history.',
            readyDetail: 'Support actions and recovery state have structured audit evidence.',
        }),
        publicTiEnrichmentRow(external, query),
        snapshotRow({
            id: 'deploy_live_status',
            label: 'Deploy and live status',
            snapshot: external.deployProbe,
            fallbackHref: '/status',
            fallbackOwner: 'integration',
            fallbackExpectedDashboardRowId: 'deploy_probe',
            fallbackContract: 'product.deploy_probe.readiness.v1',
            fallbackProbe: 'Post-deploy check must record deployed commit, frontend/API/scraper health, dashboard alert id, delivery id, and check time.',
            fallbackBlocker: 'Run the latest live deploy check.',
            readyDetail: 'Deploy check is fresh and tied to product status.',
        }),
    ]
    const readyRows = rows.filter(row => row.state === 'ready').length
    const firstBlocker = rows.find(row => row.state !== 'ready')?.blocker
    const fullChainReady = rows.every(row => row.state === 'ready')

    return {
        schemaVersion: 'product.north_star.readiness.v1',
        generatedAt,
        query,
        fullChainReady,
        readyRows,
        totalRows: rows.length,
        firstBlocker,
        progressSource: options.progressSource || defaultProgressSource(payload, generatedAt),
        productReadinessAggregate: options.productReadinessAggregate || missingProductReadinessAggregateSource('product_readiness_aggregate_not_configured'),
        deployGate: buildDeployGate(rows, { fullChainReady, readyRows, firstBlocker }),
        direction: buildProductDirection(rows),
        rows,
    }
}
