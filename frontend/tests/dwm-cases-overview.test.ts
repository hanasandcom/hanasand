import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
// @ts-expect-error Bun provides this module when running focused tests.
import { mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { caseDetailHref } from '../src/app/dashboard/cases/caseRoutes'
import type { CasesState } from '../src/app/dashboard/findings/types'

mock.module('next/link', () => ({
    default: ({ href, children, ...props }: { href: string, children: unknown }) => createElement('a', { ...props, href }, children),
}))

const { CaseOverview } = await import('../src/app/dashboard/findings/case-overview')

test('case detail links retain organization and finding context', () => {
    assert.equal(caseDetailHref('HA/1'), '/cases/HA%2F1')
    assert.equal(
        caseDetailHref('HA/1', 'alert 1', 'org acme', 'case_overview'),
        '/cases/HA%2F1?organizationId=org+acme&alertId=alert+1&route=case_overview',
    )
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
    assert.match(populated, /href="\/cases\/HA%2F1\?route=case_overview&amp;org=org_case"/)
    assert.match(populated, /Credential exposure/)
    assert.match(populated, /Lumma/)
    assert.match(populated, /Alice/)
    assert.match(populated, /Title \/ actor[\s\S]*Severity \/ status[\s\S]*Owner[\s\S]*Updated/)
    assert.doesNotMatch(populated, /overflow-hidden/)
})

test('the cases view uses the shared cases route without mounting workflow actions', async () => {
    const frontendRoot = process.cwd().endsWith(`${path.sep}frontend`) ? process.cwd() : path.join(process.cwd(), 'frontend')
    const [overview, view, portalData, route] = await Promise.all([
        readFile(path.join(frontendRoot, 'src/app/dashboard/findings/case-overview.tsx'), 'utf8'),
        readFile(path.join(frontendRoot, 'src/app/dashboard/findings/findings-view.tsx'), 'utf8'),
        readFile(path.join(frontendRoot, 'src/app/dashboard/findings/portal-data.ts'), 'utf8'),
        readFile(path.join(frontendRoot, 'src/app/api/cases/route.ts'), 'utf8'),
    ])

    assert.match(view, /if \(view === 'cases'\)/)
    assert.match(view, /<CaseOverview organizationId=\{organizationId\} state=\{casesState\} alerts=\{alerts\} operations=\{operations\} isAdmin=\{isAdmin\} \/>/)
    assert.doesNotMatch(overview, /DwmWorkflowActions|watchlist|webhook/i)
    assert.match(portalData, /fetch\(`\/api\/cases\?\$\{params\.toString\(\)\}`/)
    assert.match(route, /proxyTiRequest\(request, '\/v1\/cases'/)
})
