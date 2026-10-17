import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd().endsWith(`${path.sep}frontend`) ? process.cwd() : path.join(process.cwd(), 'frontend')

test('DWM keeps Cases focused and workflow controls on scoped non-Cases views', async () => {
    const [page, view, cases] = await Promise.all([
        readFile(path.join(root, 'src/app/dashboard/findings/findings.tsx'), 'utf8'),
        readFile(path.join(root, 'src/app/dashboard/findings/findings-view.tsx'), 'utf8'),
        readFile(path.join(root, 'src/app/dashboard/findings/case-overview.tsx'), 'utf8'),
    ])

    expect(view).toContain('return <CaseOverview organizationId={organizationId} state={casesState} alerts={alerts} operations={operations} isAdmin={isAdmin} />')
    expect(page).toContain('const workflowActions = view === \'cases\' ? null')
    expect(page).toContain('<DwmWorkflowActions')
    expect(page).toContain('tenantId={tenantId}')
    expect(page).toContain('organizationId={view === \'watchlists\' ? organizationId : selectedOrganizationId}')
    expect(page).toContain('dwmScopeSearchParams(tenantId, organizationId)')
    expect(page).toContain('view === \'cases\' || view === \'watchlists\' ? \'loading\' : \'ready\'')
    expect(cases).toContain('No cases.')
})
