import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { proxyOrganizationAlertReadiness } from '../src/app/api/organizations/organizationAlertReadinessProxy.ts'
import { buildSetupOrganizationCase } from '../src/app/dashboard/readinessCaseSetupOrganization.ts'
import { createReadinessCaseContext } from '../src/app/dashboard/readinessCaseContext.ts'
import { withProductReadinessActions } from '../src/app/dashboard/productReadinessActions.ts'
import { readinessRows } from '../src/app/dashboard/ti/workbench/modules/rail/readinessRows.ts'
import type { WorkbenchCase, WorkbenchOrgContext } from '../src/app/dashboard/ti/workbench/types/index.ts'

const organization = {
    id: 'org/a b', tenantId: 'org/a b', name: 'North', slug: 'north', status: 'active' as const,
    createdAt: '2026-10-16T09:00:00.000Z', updatedAt: '2026-10-16T09:00:00.000Z',
}

test('organization readiness connects dashboard and workbench actions to the selected organization', () => {
    const context = createReadinessCaseContext({
        backendConfigured: true,
        scope: { tenantId: organization.id, organizationId: organization.id },
        watchlists: [], operations: null, deliveries: [], liveAlertCount: 0, renderedAlertCount: 0,
        organizationState: {
            organizations: [organization], selectedOrganization: organization,
            members: [{ id: 'member-1', organizationId: organization.id, email: 'analyst@example.test', role: 'analyst', status: 'active', createdAt: organization.createdAt, updatedAt: organization.updatedAt }],
            pendingInvites: [], webhooks: [],
        },
    })
    const setupCase = buildSetupOrganizationCase(context)
    assert.ok(setupCase.actions?.some(action => action.id === 'inspect_org_alert_readiness' && action.href === '/api/organizations/org%2Fa%20b/alert-readiness'))
    assert.ok(setupCase.relatedLinks.some(link => link.href === '/api/organizations/org%2Fa%20b/alert-readiness'))

    const orgContext = {
        organization, scope: { tenantId: organization.id, organizationId: organization.id }, members: [{ status: 'active' }],
        readiness: { activeMemberCount: 1, activeWatchlistCount: 1 },
    } as unknown as WorkbenchOrgContext
    const rows = readinessRows({ id: 'setup', kind: 'org_readiness' } as WorkbenchCase, orgContext)
    assert.equal(rows.find(row => row.id === 'inspect_org_members')?.tone, 'ready')
    assert.equal(rows.find(row => row.id === 'inspect_org_alert_readiness')?.tone, 'ready')
    assert.equal(rows.find(row => row.id === 'inspect_org_alert_readiness')?.href, '/api/organizations/org%2Fa%20b/alert-readiness')

    const dashboardActions = withProductReadinessActions({ id: 'org_members', label: 'Members', status: 'ready', detail: '', source: '' }, {
        scope: { tenantId: organization.id, organizationId: organization.id }, organization, activeWebhooks: [],
        activeWatchlistCount: 0, termCount: 0, activeWebhookCount: 0, liveAlertCount: 0,
    }).actions
    assert.ok(dashboardActions?.some(action => action.id === 'inspect_org_members' && action.href === '/api/organizations/org%2Fa%20b/members'))

    const alertActions = withProductReadinessActions({ id: 'alert_generation', label: 'Alerts', status: 'needs_action', detail: '', source: '' }, {
        scope: { tenantId: organization.id, organizationId: organization.id }, organization, activeWebhooks: [],
        activeWatchlistCount: 1, termCount: 2, activeWebhookCount: 0, liveAlertCount: 0,
        sourceCoverage: { sourceCount: 4, activeSourceCount: 3 },
    }).actions
    assert.ok(alertActions?.some(action => action.id === 'open_alert_generation_readiness' && action.href === '/api/findings/alerts/generation-readiness'))
    assert.ok(alertActions?.some(action => action.id === 'rebuild_alerts' && action.href === '/api/findings/alerts/rebuild' && action.disabledReason === undefined))
})

test('organization alert-readiness proxy preserves the request and scopes the TI path', async() => {
    let received: unknown[] = []
    const request = { query: 'unchanged' }
    const response = await proxyOrganizationAlertReadiness(request, 'org/a b', async(...args: unknown[]) => {
        received = args
        return 'proxied'
    })
    assert.equal(response, 'proxied')
    assert.deepEqual(received, [request, '/organizations/org%2Fa%20b/alert-readiness', { method: 'GET' }])
})
