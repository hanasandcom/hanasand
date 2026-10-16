import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { buildProductReadiness } from '../src/app/dashboard/productReadinessModel.ts'
import { organization, productInput } from './helpers/productReadinessFixtures.ts'

const readinessRowIds = [
    'org_members', 'shared_watchlists', 'entitlement_readiness', 'source_coverage', 'dashboard_alert',
    'dwm_product_snapshot', 'webhook_delivery', 'org_alert_export', 'webhook_health', 'dashboard_evidence',
    'analyst_workflow', 'source_inventory_probe', 'end_to_end_workflow', 'public_ti_provenance', 'helpdesk_audit', 'deploy_probe',
]

test('product readiness builds every row with proof metadata and a deep link', () => {
    const rows = buildProductReadiness(productInput())
    assert.deepEqual(rows.map(row => row.id), readinessRowIds)
    for (const row of rows) {
        assert.equal(row.status, 'ready', row.id)
        assert.equal(row.deepLinkTarget, row.href, row.id)
        assert.equal(row.expectedDashboardRowId, row.id, row.id)
        assert.ok(row.proofTimestamp, `${row.id} proof timestamp`)
        assert.ok((row.staleAfterSeconds || 0) > 0, `${row.id} freshness window`)
        assert.ok(row.integrationProbeHint, `${row.id} probe hint`)
        assert.ok(row.backendProofContractVersion, `${row.id} proof contract`)
        assert.ok(row.ownerLane, `${row.id} owner lane`)
        assert.ok(row.operatorAction, `${row.id} operator action`)
        assert.equal(row.unavailableReason, undefined, row.id)
    }
    assert.equal(rows.find(row => row.id === 'org_members')?.href, `/api/organizations/${organization.id}/members`)
    assert.equal(rows.find(row => row.id === 'org_alert_export')?.organizationId, organization.id)
    assert.equal(rows.find(row => row.id === 'analyst_workflow')?.caseDetailHref, '/api/cases/case-1')
})

test('product readiness actions retain scope and expose operational workflows', () => {
    const rows = buildProductReadiness(productInput())
    const action = (id: string, actionId: string) => rows.find(row => row.id === id)?.actions?.find(item => item.id === actionId)
    assert.equal(action('org_members', 'inspect_org_members')?.href, `/api/organizations/${organization.id}/members`)
    assert.equal(action('shared_watchlists', 'rebuild_alerts')?.body?.organizationId, organization.id)
    assert.equal(action('source_coverage', 'run_canary_collection')?.href, '/api/findings/canary/run')
    assert.equal(action('dashboard_alert', 'open_alert_queue')?.href, `/api/findings/alerts?organizationId=${organization.id}`)
    assert.equal(action('webhook_health', 'test_org_webhook')?.body?.webhookDestinationId, 'webhook-1')
    assert.equal(action('analyst_workflow', 'record_customer_notification')?.href, undefined)
})
