// @ts-expect-error Bun provides this module when running focused tests.
import { test, expect } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { normalizeAlertRebuildOutcome } from '../src/utils/dwm/alertRebuildOutcome'
import { alertRebuildFromWatchlistOrRequest, hasDurableCase, hasDurableSourceRequest } from '../src/app/dashboard/findings/workflow-http'

test('inline alert rebuild reports only durable outcomes as success', () => {
    expect(normalizeAlertRebuildOutcome({ status: 'failed', error: { message: 'backend failed' }, savedAlertCount: 0 }).ok).toBe(false)
    expect(normalizeAlertRebuildOutcome({ status: 'completed', savedAlertCount: 0, alertIds: [] }).ok).toBe(false)
    expect(normalizeAlertRebuildOutcome({ status: 'queued', savedAlertCount: 0 }).ok).toBe(false)
    expect(normalizeAlertRebuildOutcome({ ok: true, savedAlertCount: 0, alertIds: [] }).ok).toBe(false)
    expect(normalizeAlertRebuildOutcome({ ok: true, savedAlertCount: 1 }).ok).toBe(false)
    expect(normalizeAlertRebuildOutcome({ status: 'completed', savedAlertCount: 1, alertIds: ['alert_1'], tenantId: 'tenant_1', organizationId: 'org_1' })).toMatchObject({ ok: true, tenantId: 'tenant_1', organizationId: 'org_1' })
    expect(normalizeAlertRebuildOutcome({ savedAlertCount: 1, alerts: [{ id: 'alert_1' }] }).ok).toBe(true)
})

test('watchlist rebuild uses the caller scope and accepts only durable saved alerts', async () => {
    const calls: Array<{ path: string, body: Record<string, unknown> }> = []
    const scope = { tenantId: 'tenant_1', organizationId: 'org_1' }
    const post = async (path: string, body: Record<string, unknown>) => {
        calls.push({ path, body })
        return { ok: true, message: '', status: 'completed', savedAlertCount: 1, alertIds: ['alert_1'] }
    }

    const outcome = await alertRebuildFromWatchlistOrRequest({}, scope, post)
    expect(outcome).toMatchObject({ ok: true, savedAlertCount: 1, alertIds: ['alert_1'] })
    expect(calls).toEqual([{ path: '/api/findings/alerts/rebuild', body: scope }])

    const inline = await alertRebuildFromWatchlistOrRequest({ alertRebuild: { status: 'queued', savedAlertCount: 0 } }, scope, post)
    expect(inline.ok).toBe(false)
    expect(calls).toHaveLength(1)
})

test('case and source workflows require durable identifiers', () => {
    expect(hasDurableCase('case_1')).toBe(true)
    expect(hasDurableCase('')).toBe(false)
    expect(hasDurableSourceRequest('request_1', 'source_1', '')).toBe(true)
    expect(hasDurableSourceRequest('request_1', '', 'request_0')).toBe(true)
    expect(hasDurableSourceRequest('request_1', '', '')).toBe(false)
    expect(hasDurableSourceRequest('', 'source_1', '')).toBe(false)
})

test('case detail validates durable updates and notification receipts', async () => {
    const caseActions = await readFile(new URL('../src/app/dashboard/cases/[id]/case-detail/useCaseDetailActions.ts', import.meta.url), 'utf8')
    expect(caseActions).toContain('if (!payload.case || typeof payload.case.id !== \'string\') throw new Error(\'No durable case update was returned.\')')
    expect(caseActions).toContain('if (!payload.receipt || typeof payload.receipt.id !== \'string\') throw new Error(\'No durable notification record was returned.\')')
})
