import assert from 'node:assert/strict'
import { buildProductProgressPayload } from '../src/utils/productProgress/readiness'
import { buildProductNorthStarScoreboard } from '../src/utils/productProgress/northStar'
import { buildReadinessCases } from '../src/app/dashboard/operatorConsoleModel'

const checkedAt = '2026-06-29T08:00:00.000Z'
const routes = {
    productProgress: '/api/product-progress',
    deployProbe: '/api/status',
    sourceProxy: '/api/ti/scraper/control',
    dashboardAlerts: '/api/findings/alerts',
    cases: '/api/cases',
    publicTiProvenance: '/api/ti/search',
    helpdeskAudit: '/api/backend/admin/audit-events',
    orgAlertExport: '/api/organizations/org_acme/alert-readiness',
    webhookHealth: '/api/organizations/org_acme/webhooks',
    entitlement: '/api/organizations/org_acme/alert-readiness',
    dwmProduct: '/api/findings/product',
}

function baseInput(deliveries: Array<{ id: string, alertId: string, status: string }>) {
    return {
        generatedAt: checkedAt,
        checkedAt,
        query: 'LockBit',
        routes,
        alerts: [{ id: 'alert_unmatched' }, { id: 'alert_backed' }],
        cases: [{ id: 'case_backed', alertId: 'alert_backed', status: 'open', updatedAt: checkedAt }],
        deliveries,
        sourceProxy: {
            ok: true,
            generatedAt: checkedAt,
            query: 'LockBit',
            baseConfigured: true,
            endpoints: { sourceInventory: { ok: true, status: 200 } },
            sourcePacks: { workerReadiness: { collectionReadyRows: 3 } },
        },
        deploy: { status: 'ready' as const, latestProbeAt: checkedAt },
        alertGeneration: {
            schemaVersion: 'dwm.alert_generation_readiness.v1',
            status: 'ready' as const,
            readyForCustomerDelivery: true,
            candidateCount: 2,
            generationEvidenceWindowReady: true,
            generationEvidenceWindowCaptureCount: 2,
            latestEvidenceAt: checkedAt,
            source: routes.productProgress,
            proofTimestamp: checkedAt,
        },
    }
}

const sentOnly = buildProductProgressPayload(baseInput([
    { id: 'delivery_sent', alertId: 'alert_backed', status: 'sent' },
]))
assert.equal(sentOnly.dashboardEvidence?.status, 'needs_action')
assert.equal(sentOnly.dashboardEvidence?.deliveryEvidenceMatched, false)
assert.equal(sentOnly.dashboardEvidence?.unavailableReason, 'missing_matching_delivery')

const persisted = buildProductProgressPayload({
    ...baseInput([{ id: 'delivery_backed', alertId: 'alert_backed', status: 'delivered' }]),
    caseDetail: {
        route: '/api/cases/case_backed',
        fetchOk: true,
        schemaVersion: 'product.analyst_case_detail_proof.v1',
        caseId: 'case_backed',
        alertId: 'alert_backed',
        readOnly: true,
        timelineCount: 1,
        proofTimestamp: checkedAt,
    },
})
assert.equal(persisted.dashboardEvidence?.alertId, 'alert_backed')
assert.equal(persisted.dashboardEvidence?.deliveryId, 'delivery_backed')
assert.equal(persisted.dashboardEvidence?.status, 'ready')
assert.equal(persisted.analystWorkflow?.caseId, 'case_backed')
assert.equal(persisted.analystWorkflow?.status, 'ready')

const missingDetail = buildProductProgressPayload(baseInput([
    { id: 'delivery_backed', alertId: 'alert_backed', status: 'delivered' },
]))
assert.equal(missingDetail.analystWorkflow?.status, 'needs_action')
assert.equal(missingDetail.analystWorkflow?.unavailableReason, 'missing_analyst_case_detail_readiness')

const scoreboard = buildProductNorthStarScoreboard(missingDetail, { generatedAt: checkedAt, query: 'LockBit' })
assert.equal(scoreboard.schemaVersion, 'product.north_star.readiness.v1')
assert.equal(scoreboard.rows.find(row => row.id === 'analyst_workflow')?.state, 'needs_action')
assert.equal(scoreboard.rows.find(row => row.id === 'real_alert_generation')?.state, 'ready')
assert.equal(scoreboard.fullChainReady, false)

const caseInput = {
    backendConfigured: true,
    scope: { tenantId: 'tenant_acme' },
    watchlists: [],
    operations: null,
    deliveries: [],
    organizationState: { organizations: [], members: [], pendingInvites: [], webhooks: [] },
    liveAlertCount: 0,
    renderedAlertCount: 0,
}
const baseCases = buildReadinessCases(caseInput)
assert.ok(baseCases.some(item => item.id === 'setup_organization'))
assert.equal(baseCases.find(item => item.id === 'case_workflow_readiness')?.status, 'unavailable')
assert.equal(baseCases.find(item => item.id === 'source_worker_readiness')?.status, 'unavailable')
const proofCases = buildReadinessCases({
    ...caseInput,
    externalReadiness: {
        analystWorkflow: { schemaVersion: 'analyst.workflow.readiness.v1', status: 'needs_action' },
        sourceGrowth: { schemaVersion: 'dwm.source_inventory.v1', status: 'needs_action' },
    },
})
assert.ok(proofCases.some(item => item.id === 'case_workflow_readiness'))
assert.ok(proofCases.some(item => item.id === 'source_worker_readiness'))
console.log('product-progress end-to-end readiness contract ok')
