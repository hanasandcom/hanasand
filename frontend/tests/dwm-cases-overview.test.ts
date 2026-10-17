import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { caseDetailHref } from '../src/app/dashboard/cases/caseRoutes'

test('case detail links retain organization and finding context', () => {
    assert.equal(caseDetailHref('HA/1'), '/cases/HA%2F1')
    assert.equal(
        caseDetailHref('HA/1', 'alert 1', 'org acme', 'case_overview'),
        '/cases/HA%2F1?organizationId=org+acme&alertId=alert+1&route=case_overview',
    )
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
    assert.match(overview, /row\.organizationId \|\| organizationId/)
    assert.match(overview, /data-dwm-cases-empty='true'/)
    assert.match(overview, />No cases\.<\/p>/)
    assert.match(overview, /data-dwm-cases-table='true'/)
    assert.match(overview, /Title \/ actor/)
    assert.match(overview, /Severity \/ status/)
    assert.match(overview, /Owner/)
    assert.match(overview, /Updated/)
    assert.doesNotMatch(overview, /No alert is waiting for review/)
    const casesComponent = overview.slice(overview.indexOf('export function CaseOverview'), overview.indexOf('function DwmSourceCoverageSummary'))
    assert.doesNotMatch(casesComponent, /DwmWorkflowActions|watchlist|webhook|collection/i)
    assert.doesNotMatch(casesComponent, /overflow-hidden/)
    assert.match(portalData, /fetch\(`\/api\/cases\?\$\{params\.toString\(\)\}`/)
    assert.match(route, /proxyTiRequest\(request, '\/v1\/cases'/)
})
