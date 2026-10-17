import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { dwmNextOperatorAction, type DwmNextOperatorActionInput } from '@/utils/dwm/nextOperatorAction'

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

test('DWM next operator action remains scoped to the available workflow step', () => {
    const base: DwmNextOperatorActionInput = {
        reviewState: 'reviewing',
        deliveryState: 'pending_review',
        caseReady: false,
        transitionReady: true,
        replayReady: false,
        deliverReady: false,
        closeReady: false,
        reopenReady: false,
        suppressReady: false,
    }

    expect(dwmNextOperatorAction({ ...base, caseHref: '/cases/case-1', latestDeliveryStatus: 'delivered', latestDeliverySummary: 'delivered from 2m ago' })).toMatchObject({
        kind: 'open_case_link',
        href: '/cases/case-1',
        label: 'Review case and delivery trail',
    })
    expect(dwmNextOperatorAction({ ...base, deliverReady: true, latestDeliveryStatus: 'dry_run' })).toMatchObject({
        kind: 'send', label: 'Send customer delivery',
    })
    expect(dwmNextOperatorAction({ ...base, deliverReady: true, latestDeliveryStatus: undefined })).toMatchObject({
        kind: 'test', label: 'Test delivery route',
    })
})
