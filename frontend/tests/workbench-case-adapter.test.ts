import { strict as assert } from 'node:assert'
import test from 'node:test'
import {
    caseDashboardHref,
    dwmCaseToWorkbenchCase,
    normalizeWorkbenchSeverity,
} from '../src/app/dashboard/ti/workbench/pageCaseAdapter'
import type { WorkbenchDwmCaseListItem } from '../src/app/dashboard/ti/workbench/pageTypes'

test('case adapter maps alert references, severity, owner, delivery, and enabled action', () => {
    const row: WorkbenchDwmCaseListItem = {
        id: 'row-id', caseId: 'case/42', alertId: 'alert-42', title: 'Acme case',
        organizationId: 'org-acme', status: 'investigating', severity: 'urgent',
        assignedOwner: 'analyst', watchlistItemIds: ['item-1'],
        webhookDeliveryIds: ['delivery-1', 'delivery-2'], webhookStatuses: ['sent', 'failed'],
        createdAt: '2026-01-01', updatedAt: '2026-01-03',
        latestEvent: { at: '2026-01-04', eventType: 'owner_assigned', summary: 'Owner assigned' },
        nextAllowedActions: [{ label: 'Close case', enabled: true }],
    }

    const result = dwmCaseToWorkbenchCase(row)
    assert.equal(result.id, 'alert-42')
    assert.equal(result.severity, 'critical')
    assert.equal(result.priority, 432)
    assert.equal(result.owner, 'analyst')
    assert.equal(result.recommendedAction, 'Close case')
    assert.equal(result.caseDetailHref, '/cases/case%2F42?organizationId=org-acme&alertId=alert-42&route=ti_workbench')
    assert.deepEqual(result.deliveryEvidence?.map(item => item.status), ['sent', 'failed'])
    assert.equal(result.workflowPath?.find(step => step.id === 'delivery_ref')?.status, 'blocked')
    assert.equal(result.actions?.find(action => action.id === 'replay_alert')?.disabledReason, undefined)
})

test('case adapter falls back to case IDs and disables alert actions without an alert reference', () => {
    const result = dwmCaseToWorkbenchCase({ id: 'case-7', priority: 'p2' })
    assert.equal(result.id, 'case-7')
    assert.equal(result.severity, 'high')
    assert.equal(result.status, 'open')
    assert.equal(result.owner, 'unassigned')
    assert.equal(result.caseDetailHref, '/cases/case-7?route=ti_workbench')
    assert.equal(result.actions?.every(action => action.disabledReason?.includes('syncing')), true)
    assert.equal(result.workflowPath?.find(step => step.id === 'alert_ref')?.status, 'needs_action')
})

test('case adapter uses stable defaults when IDs and event timestamps are absent', () => {
    const result = dwmCaseToWorkbenchCase({})
    assert.equal(result.id, 'case')
    assert.equal(result.title, 'case')
    assert.equal(result.updatedAt, '')
    assert.equal(result.routeLabel, 'case review')
    assert.equal(result.subtitle, 'case is open with 0 webhook delivery rows.')
})

test('case dashboard links encode path and query values and preserve the default route', () => {
    assert.equal(
        caseDashboardHref({ caseId: 'case/a b', organizationId: 'org & one', alertId: 'alert?x' }),
        '/cases/case%2Fa%20b?organizationId=org+%26+one&alertId=alert%3Fx&route=ti_workbench',
    )
    assert.equal(caseDashboardHref({}), '/cases/case?route=ti_workbench')
})

test('case severity normalization retains supported values and aliases', () => {
    assert.deepEqual(
        ['critical', 'high', 'medium', 'low', 'p1', 'review', undefined].map(normalizeWorkbenchSeverity),
        ['critical', 'high', 'medium', 'low', 'critical', 'high', 'medium'],
    )
})
