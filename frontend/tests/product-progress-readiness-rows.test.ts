import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { buildProductReadiness } from '../src/app/dashboard/productReadinessModel.ts'
import { organization, productInput } from './helpers/productReadinessFixtures.ts'

const readinessRowIds = [
    'org_members', 'shared_watchlists', 'entitlement_readiness', 'source_coverage', 'dashboard_alert',
    'dwm_product_snapshot', 'webhook_delivery', 'org_alert_export', 'webhook_health', 'dashboard_evidence',
    'analyst_workflow', 'source_inventory_probe', 'end_to_end_workflow', 'public_ti_provenance', 'deploy_probe',
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
    assert.deepEqual(action('shared_watchlists', 'rebuild_alerts'), {
        id: 'rebuild_alerts', label: 'Rebuild alerts', method: 'POST', href: '/api/findings/alerts/rebuild', body: { organizationId: organization.id },
    })
    assert.deepEqual(action('source_coverage', 'run_canary_collection'), {
        id: 'run_canary_collection', label: 'Run canary', method: 'POST', href: '/api/findings/canary/run',
        body: { operatorApproval: true, approvedBy: 'dashboard', maxSources: 12, maxTasks: 24 },
    })
    const enabledRebuild = action('dashboard_alert', 'rebuild_alerts')!
    assert.equal(Object.hasOwn(enabledRebuild, 'disabledReason'), true)
    assert.equal(enabledRebuild.disabledReason, undefined)
    assert.equal(action('dashboard_alert', 'open_alert_queue')?.href, `/api/findings/alerts?organizationId=${organization.id}`)
    assert.equal(action('webhook_health', 'test_org_webhook')?.body?.webhookDestinationId, 'webhook-1')
    assert.equal(action('analyst_workflow', 'record_customer_notification')?.href, undefined)
    const blockedRebuild = buildProductReadiness(productInput({ activeWatchlistCount: 0, sourceCoverage: { sourceCount: 3, activeSourceCount: 0, captureCount: 0, watchlistMatchCount: 0 } }))
    assert.equal(blockedRebuild.find(row => row.id === 'dashboard_alert')?.actions?.find(item => item.id === 'rebuild_alerts')?.disabledReason, 'Rebuild requires active watchlist terms and source coverage.')
    const tenantRebuild = buildProductReadiness(productInput({ scope: { tenantId: organization.tenantId } }))
    assert.deepEqual(tenantRebuild.find(row => row.id === 'shared_watchlists')?.actions?.find(item => item.id === 'rebuild_alerts')?.body, { tenantId: organization.tenantId })
})
