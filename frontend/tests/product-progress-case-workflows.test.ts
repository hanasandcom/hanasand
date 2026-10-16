import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { proxyCaseAction } from '../src/app/api/cases/caseProxyContract.ts'
import { alertCaseRows } from '../src/app/dashboard/ti/workbench/modules/rail/alertCaseRows.ts'
import { caseCustomerNotificationHref, caseExportHref, customerNotificationActionState } from '../src/app/dashboard/ti/workbench/modules/caseRoutes.ts'
import type { CaseDetailPayload, WorkbenchCase } from '../src/app/dashboard/ti/workbench/types/index.ts'

const caseHref = '/api/cases/case%2F1?organizationId=org-1&alertId=alert-1'
const deliveredCase: CaseDetailPayload = {
    generatedAt: '2026-10-16T10:00:00.000Z',
    case: { id: 'case-1', updatedAt: '2026-10-16T10:00:00.000Z', workflowEvents: [{ id: 'event-1' } as never] },
    customerNotificationContext: { notificationCount: 0, notified: false },
    deliveries: [{ id: 'delivery-1', status: 'delivered', attemptedAt: '2026-10-16T09:00:00.000Z' } as never],
    nextActions: ['review'],
}

test('workbench notification and export actions require backed case evidence and keep scope', () => {
    assert.equal(caseCustomerNotificationHref(caseHref), `${caseHref.split('?')[0]}/customer-notification?organizationId=org-1&alertId=alert-1`)
    const exportUrl = new URL(caseExportHref(caseHref), 'https://hanasand.test')
    assert.equal(exportUrl.pathname, '/api/cases/case%2F1/export')
    assert.equal(exportUrl.searchParams.get('organizationId'), 'org-1')
    assert.equal(exportUrl.searchParams.get('alertId'), 'alert-1')
    for (const key of ['shape', 'timeline', 'evidence', 'nextActionPayloads']) assert.ok(exportUrl.searchParams.has(key), key)

    assert.ok(customerNotificationActionState({ status: 'ready', detail: deliveredCase }).disabledReason === undefined)
    assert.match(customerNotificationActionState({ status: 'ready', detail: { ...deliveredCase, deliveries: [] } }).disabledReason || '', /delivered webhook/)
    assert.match(customerNotificationActionState({ status: 'ready', detail: { ...deliveredCase, access: { readOnly: true } } }).disabledReason || '', /Read-only/)
    assert.match(customerNotificationActionState({ status: 'ready', detail: { ...deliveredCase, customerNotificationContext: { notificationCount: 1, notified: true } } }).disabledReason || '', /already recorded/)

    const rows = alertCaseRows({ id: 'alert-1', kind: 'dwm_alert', caseDetailHref: caseHref, persistent: true, relatedLinks: [] } as WorkbenchCase, undefined, { status: 'ready', detail: deliveredCase }, undefined, 'Reviewed and sent')
    assert.equal(rows.find(row => row.id === 'record_customer_notification')?.tone, 'ready')
    assert.equal(rows.find(row => row.id === 'export_case_evidence')?.href, caseExportHref(caseHref))
})

test('case proxy contract forwards notification POST and export GET to encoded TI paths', async() => {
    const calls: Array<{ request: unknown, path: string, method: string }> = []
    const proxy = async(request: unknown, path: string, options: { method: 'GET' | 'POST' }) => {
        calls.push({ request, path, method: options.method })
        return 'forwarded'
    }
    const request = { body: 'rationale' }
    assert.equal(await proxyCaseAction(request, 'case/a b', 'customer-notification', proxy), 'forwarded')
    assert.equal(await proxyCaseAction(request, 'case/a b', 'export', proxy), 'forwarded')
    assert.deepEqual(calls, [
        { request, path: '/v1/cases/case%2Fa%20b/customer-notification', method: 'POST' },
        { request, path: '/v1/cases/case%2Fa%20b/export', method: 'GET' },
    ])
})
