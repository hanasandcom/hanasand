import assert from 'node:assert/strict'
import { test } from 'bun:test'
import type { RuntimeDwmAlert } from '../src/app/dashboard/ti/workbench/runtimeAlert'
import type { WorkbenchCase, WorkbenchDeliveryEvidence, WorkbenchOrgContext } from '../src/app/dashboard/ti/workbench/types'
import { deliveryLedgerHref, watchlistLedgerHref } from '../src/app/dashboard/ti/workbench/modules/caseRoutes'
import {
    alertCaseDetailHref,
    alertCaseReference,
    findingsDeliveryLedgerHref,
    findingsWatchlistLedgerHref,
} from '../src/app/dashboard/ti/workbench/references'

const alert = (fields: Partial<RuntimeDwmAlert>) => fields as RuntimeDwmAlert

test('alert case reference keeps current and legacy field precedence', () => {
    assert.deepEqual(alertCaseReference(alert({
        caseId: 'current-id', casePath: '/cases/current-path', caseIdCandidate: 'top-candidate',
        customerReadiness: { caseHandoff: { caseId: 'handoff-id', caseIdCandidate: 'handoff-candidate', casePath: '/cases/handoff-path' } },
        workflowSummary: { casePath: '/cases/summary-path' },
        workflowContext: { caseIdCandidate: 'context-candidate', casePath: '/cases/context-path' },
    })), { caseId: 'current-id', casePath: '/cases/current-path' })

    assert.deepEqual(alertCaseReference(alert({
        caseIdCandidate: 'top-candidate', casePath: undefined,
        customerReadiness: { caseHandoff: { caseId: 'legacy-handoff-id', caseIdCandidate: 'handoff-candidate', casePath: '/cases/handoff-path' } },
        workflowSummary: { casePath: '/cases/summary-path' },
        workflowContext: { caseIdCandidate: 'context-candidate', casePath: '/cases/context-path' },
    })), { caseId: 'legacy-handoff-id', casePath: '/cases/handoff-path' })

    assert.deepEqual(alertCaseReference(alert({
        caseIdCandidate: 'top-candidate',
        workflowSummary: { casePath: '/cases/summary-path' },
        workflowContext: { caseIdCandidate: 'context-candidate', casePath: '/cases/context-path' },
    })), { caseId: 'top-candidate', casePath: '/cases/summary-path' })

    assert.deepEqual(alertCaseReference(alert({
        workflowContext: { caseIdCandidate: 'context-candidate', casePath: '/cases/context-path' },
    })), { caseId: 'context-candidate', casePath: '/cases/context-path' })
})

test('case detail route uses path fallback, encoding, and ordered scope parameters', () => {
    assert.equal(alertCaseDetailHref({
        casePath: '/v1/cases/case%2F12?alertId=old', alertId: 'alert + 1',
        organizationId: 'org/2', tenantId: 'tenant 1',
    }), '/cases/case%2F12?organizationId=org%2F2&tenantId=tenant+1&alertId=alert+%2B+1&route=ti_workbench')
    assert.equal(alertCaseDetailHref({
        caseId: 'current/id', casePath: '/cases/legacy-id', alertId: 'alert',
    }), '/cases/current%2Fid?alertId=alert&route=ti_workbench')
    assert.equal(alertCaseDetailHref({ casePath: '/cases/%E0%A4%A', alertId: 'alert' }), '/cases/%25E0%25A4%25A?alertId=alert&route=ti_workbench')
    assert.equal(alertCaseDetailHref({ alertId: 'alert' }), undefined)
})

test('findings ledger builders preserve personal and scoped URL output', () => {
    assert.equal(findingsWatchlistLedgerHref({}), '/api/findings/watchlists')
    assert.equal(findingsWatchlistLedgerHref({ organizationId: 'org/2', tenantId: 'tenant 1' }), '/api/findings/watchlists?organizationId=org%2F2&tenantId=tenant+1')
    assert.equal(findingsDeliveryLedgerHref({}), '/api/findings/webhooks/deliveries')
    assert.equal(findingsDeliveryLedgerHref({ alertId: 'alert/1' }), '/api/findings/webhooks/deliveries?alertId=alert%2F1')
    assert.equal(findingsDeliveryLedgerHref({
        organizationId: 'org/2', tenantId: 'tenant 1', alertId: 'alert/1',
        deliveryId: 'delivery + 3', webhookDestinationId: 'hook/4',
    }), '/api/findings/webhooks/deliveries?organizationId=org%2F2&tenantId=tenant+1&alertId=alert%2F1&deliveryId=delivery+%2B+3&webhookDestinationId=hook%2F4')
})

test('case route wrappers retain organization fallback and selected delivery filters', () => {
    const context = {
        scope: { tenantId: 'tenant 1', organizationId: 'fallback-org' },
        organization: { id: 'org/2' },
    } as WorkbenchOrgContext
    assert.equal(watchlistLedgerHref(context), '/api/findings/watchlists?organizationId=org%2F2&tenantId=tenant+1')
    assert.equal(watchlistLedgerHref({ scope: { organizationId: 'fallback-org' } } as WorkbenchOrgContext), '/api/findings/watchlists?organizationId=fallback-org')
    assert.equal(watchlistLedgerHref(undefined), '/api/findings/watchlists')
    assert.equal(deliveryLedgerHref(context, { kind: 'dwm_alert', id: 'alert/1' } as WorkbenchCase, {
        id: 'delivery 3', webhookDestinationId: 'hook/4',
    } as WorkbenchDeliveryEvidence), '/api/findings/webhooks/deliveries?organizationId=org%2F2&tenantId=tenant+1&alertId=alert%2F1&deliveryId=delivery+3&webhookDestinationId=hook%2F4')
    assert.equal(deliveryLedgerHref(undefined), '/api/findings/webhooks/deliveries')
})
