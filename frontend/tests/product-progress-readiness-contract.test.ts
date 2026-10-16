import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { buildReadinessCases, type ReadinessCasesInput } from '../src/app/dashboard/operatorConsoleModel.ts'
import { buildProductProgressPayload } from '../src/utils/productProgress/readiness.ts'

const checkedAt = '2026-10-16T10:00:00.000Z'
const routes = {
    productProgress: '/api/product-progress', deployProbe: '/api/status', sourceProxy: '/api/ti/scraper/control',
    dashboardAlerts: '/api/findings/alerts', cases: '/api/cases', publicTiProvenance: '/api/ti/search',
    helpdeskAudit: '/api/backend/admin/audit-events', orgAlertExport: '/api/organizations/org-1/alert-readiness',
    webhookHealth: '/api/organizations/org-1/webhooks', entitlement: '/api/organizations/org-1/alert-readiness',
    dwmProduct: '/api/findings/product',
}

function payloadInput(status: string) {
    return {
        generatedAt: checkedAt, checkedAt, query: 'LockBit', routes,
        sourceProxy: {
            ok: true, generatedAt: checkedAt, query: 'LockBit', baseConfigured: true,
            endpoints: { sourceInventory: { ok: true, status: 200 } },
            sourcePacks: { workerReadiness: { collectionReadyRows: 3 } },
        },
        deploy: { status: 'ready', latestProbeAt: checkedAt },
        alertGeneration: {
            schemaVersion: 'dwm.alert_generation_readiness.v1', status: 'ready', readyForCustomerDelivery: true,
            candidateCount: 2, generationEvidenceWindowReady: true, generationEvidenceWindowCaptureCount: 2,
            latestEvidenceAt: checkedAt, source: routes.productProgress, proofTimestamp: checkedAt,
        },
        alerts: [{ id: 'alert-1' }],
        cases: [{ id: 'case-1', alertId: 'alert-1', status: 'open', updatedAt: checkedAt }],
        deliveries: [{ id: `delivery-${status}`, alertId: 'alert-1', status }],
    }
}

test('product progress requires a durable matching delivery and case detail', () => {
    const sentOnly = buildProductProgressPayload(payloadInput('sent'))
    assert.equal(sentOnly.dashboardEvidence?.status, 'needs_action')
    assert.equal(sentOnly.dashboardEvidence?.deliveryEvidenceMatched, false)
    assert.equal(sentOnly.dashboardEvidence?.unavailableReason, 'missing_matching_delivery')

    const missingDetail = buildProductProgressPayload(payloadInput('delivered'))
    assert.equal(missingDetail.analystWorkflow?.status, 'needs_action')
    assert.equal(missingDetail.analystWorkflow?.unavailableReason, 'missing_analyst_case_detail_readiness')

    const backed = buildProductProgressPayload({
        ...payloadInput('delivered'),
        caseDetail: {
            route: '/api/cases/case-1', fetchOk: true, schemaVersion: 'product.analyst_case_detail_proof.v1',
            caseId: 'case-1', alertId: 'alert-1', readOnly: true, timelineCount: 1, proofTimestamp: checkedAt,
        },
    })
    assert.equal(backed.dashboardEvidence?.status, 'ready')
    assert.equal(backed.dashboardEvidence?.deliveryId, 'delivery-delivered')
    assert.equal(backed.analystWorkflow?.status, 'ready')
})

test('readiness cases retain unavailable and externally backed workflow rows', () => {
    const input: ReadinessCasesInput = {
        backendConfigured: true, scope: { tenantId: 'tenant-1' }, watchlists: [], operations: null, deliveries: [],
        organizationState: { organizations: [], members: [], pendingInvites: [], webhooks: [] },
        liveAlertCount: 0, renderedAlertCount: 0,
    }
    const rows = buildReadinessCases(input)
    assert.ok(rows.some(row => row.id === 'setup_organization'))
    assert.equal(rows.find(row => row.id === 'case_workflow_readiness')?.status, 'unavailable')
    assert.equal(rows.find(row => row.id === 'source_worker_readiness')?.status, 'unavailable')

    const proofRows = buildReadinessCases({
        ...input,
        externalReadiness: {
            analystWorkflow: { schemaVersion: 'analyst.workflow.readiness.v1', status: 'needs_action' },
            sourceGrowth: { schemaVersion: 'dwm.source_inventory.v1', status: 'needs_action' },
        },
    })
    assert.ok(proofRows.some(row => row.id === 'case_workflow_readiness'))
    assert.ok(proofRows.some(row => row.id === 'source_worker_readiness'))
})
