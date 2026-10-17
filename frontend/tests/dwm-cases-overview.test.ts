import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { mock, test } from 'bun:test'
import { createElement, type Dispatch, type SetStateAction } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { caseDetailHref } from '../src/app/dashboard/cases/caseRoutes'
import { caseDetailPath } from '../src/app/dashboard/findings/workflow-values'
import type { CaseListItem, CasesState } from '../src/app/dashboard/findings/types'

mock.module('next/link', () => ({
    default: ({ href, children, ...props }: { href: string, children: unknown }) => createElement('a', { ...props, href }, children),
}))
mock.module('@/components/organizations/workspaceLink', () => ({
    default: ({ href, children, ...props }: { href: string, children: unknown }) => createElement('a', { ...props, href }, children),
}))

const { CaseOverview } = await import('../src/app/dashboard/findings/case-overview')
const { FindingsView } = await import('../src/app/dashboard/findings/findings-view')
const { refreshCases } = await import('../src/app/dashboard/findings/portal-data')

test('case detail links retain organization and finding context', () => {
    assert.equal(caseDetailHref('HA/1'), '/cases/HA%2F1')
    assert.equal(
        caseDetailHref('HA/1', 'alert 1', 'org acme', 'case_overview'),
        '/cases/HA%2F1?organizationId=org+acme&alertId=alert+1&route=case_overview',
    )
    assert.equal(caseDetailPath('HA/1', 'alert 1', 'org acme', 'public_advisory'), caseDetailHref('HA/1', 'alert 1', 'org acme', 'public_advisory'))
})

test('cases overview renders its empty state and case-focused row contract', () => {
    const empty = renderToStaticMarkup(createElement(CaseOverview, {
        organizationId: 'org_outer', state: { status: 'ready', rows: [] }, alerts: [], operations: null,
    }))
    assert.match(empty, /data-dwm-cases-empty="true"/)
    assert.match(empty, /No cases yet\. Matching monitoring events create cases automatically\./)
    assert.doesNotMatch(empty, /data-dwm-cases-table/)

    const state: CasesState = {
        status: 'ready',
        rows: [{ id: 'row-1', caseId: 'HA/1', organizationId: 'org_case', title: 'Credential exposure', actor: 'Lumma', status: 'open', severity: 'high', assignedOwner: 'Alice', updatedAt: '2026-10-16T12:00:00Z' }],
    }
    const populated = renderToStaticMarkup(createElement(CaseOverview, {
        organizationId: 'org_outer', state, alerts: [], operations: null,
    }))
    assert.match(populated, /data-dwm-cases-table="true"/)
    assert.match(populated, /href="\/cases\/HA%2F1\?organizationId=org_case&amp;route=case_overview"/)
    assert.match(populated, /Credential exposure/)
    assert.match(populated, /Lumma/)
    assert.match(populated, /Alice/)
    assert.match(populated, /Title \/ actor[\s\S]*Severity \/ status[\s\S]*Owner[\s\S]*Updated/)
    assert.doesNotMatch(populated, /overflow-hidden/)
})

test('FindingsView renders its real cases branch without workflow controls', () => {
    const html = renderToStaticMarkup(createElement(FindingsView, { view: 'cases', organizationId: 'org-a', casesState: { status: 'ready', rows: [] }, alerts: [], operations: null, workflowActions: createElement('div', { 'data-workflow-actions': true }) } as Parameters<typeof FindingsView>[0]))
    assert.match(html, /data-dwm-cases-overview="true"/)
    assert.match(html, /No cases yet\. Matching monitoring events create cases automatically\./)
    assert.doesNotMatch(html, /data-workflow-actions/)
})

test('refreshCases scopes requests and preserves rows across loading and error states', async () => {
    const previous: CaseListItem[] = [{ id: 'old', caseId: 'old', title: 'Existing case', status: 'open' }]
    const collector = stateCollector({ status: 'ready', rows: previous })
    const originalFetch = globalThis.fetch
    const row: CaseListItem = { id: 'new', caseId: 'new', title: 'New case', status: 'open' }
    let request: { url: string, cache?: RequestCache } | undefined
    try {
        globalThis.fetch = async (input, init) => (request = { url: String(input), cache: init?.cache }, Response.json({ items: [row], total: 3 }))
        const params = new URLSearchParams({ tenantId: 'tenant-a', organizationId: 'org-a' })
        const signal = new AbortController().signal
        await refreshCases(params, signal, collector.setState)
        assert.deepEqual(request, { url: '/api/cases?tenantId=tenant-a&organizationId=org-a', cache: 'no-store' })
        assert.deepEqual(collector.updates.map(state => state.status), ['loading', 'ready'])
        assert.deepEqual(collector.updates[0].rows, previous)
        assert.deepEqual(collector.current, { status: 'ready', rows: [row], total: 3 })

        globalThis.fetch = async () => Response.json({ error: 'Access denied.' }, { status: 403 })
        await refreshCases(params, signal, collector.setState)
        assert.deepEqual(collector.current, { status: 'error', rows: [row], error: 'Access denied.' })
    } finally {
        globalThis.fetch = originalFetch
    }
})

function stateCollector(initial: CasesState) {
    let current = initial
    const updates: CasesState[] = []
    const setState: Dispatch<SetStateAction<CasesState>> = update => (current = typeof update === 'function' ? update(current) : update, updates.push(current))
    return { get current() { return current }, updates, setState }
}
