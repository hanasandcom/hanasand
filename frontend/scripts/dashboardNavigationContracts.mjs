import { strict as assert } from 'node:assert'
import { hasAppSidebar } from '../src/utils/routes/appRoutes.ts'
import { getDashboardNavigation, navigationLinks } from '../src/utils/layout/dashboardNavigation.ts'

export const access = { id: 'sidebar-test', canViewInternalPages: true, canManageOrganizations: true, hasVMs: true }
export const memberAccess = { ...access, canViewInternalPages: false, canManageOrganizations: false }

export function assertDashboardNavigationContracts() {
    const all = navigationLinks(getDashboardNavigation(access))
    assert.equal(all.length, new Set(all.map(item => item.href)).size)
    assert.deepEqual(getDashboardNavigation(memberAccess).map(item => item.label), ['Security & intelligence', 'Logs & rules', 'Infrastructure', 'Automation', 'Content', 'Communication', 'Organization', 'Resources', 'Account'])
    for (const permissions of [access, memberAccess]) {
        const automation = getDashboardNavigation(permissions).find(item => item.label === 'Automation')
        assert.deepEqual(automation.items.map(({ label, href, items }) => ({ label, href, items })), [
            { label: 'Health Checks', href: '/automation/health', items: undefined },
            { label: 'Cron Jobs', href: '/automation/cron', items: undefined },
        ])
    }
    const memberContentLinks = navigationLinks(getDashboardNavigation(memberAccess)).filter(item => item.ancestors.includes('Content'))
    assert.deepEqual(memberContentLinks.map(item => item.href), ['/gallery', '/upload', '/repositories'])
    assert.equal(memberContentLinks.find(item => item.href === '/repositories')?.label, 'Repositories')
    const reviewer = navigationLinks(getDashboardNavigation({ ...memberAccess, canReviewIntel: true }))
    assert.deepEqual(reviewer.filter(item => item.href === '/ti/timeliness').map(item => item.label), ['Delivery Health'])
    assert(reviewer.find(item => item.href === '/ti/timeliness').ancestors.includes('Collection'))
    assert(![...all, ...reviewer].some(item => item.href === '/ti/evaluation'))
    const operator = navigationLinks(getDashboardNavigation({ ...memberAccess, canViewInternalPages: true }))
    assert(operator.some(item => item.href === '/system'))
    assert.deepEqual(navigationLinks(getDashboardNavigation(memberAccess)).filter(item => item.ancestors.includes('Infrastructure')).map(item => item.href), ['/system', '/system/containers', '/vms'])
    assert(navigationLinks(getDashboardNavigation(memberAccess)).some(item => item.href === '/system/virtual-machines' && item.ancestors.includes('Monitoring')))
    const withoutVms = navigationLinks(getDashboardNavigation({ ...memberAccess, hasVMs: false }))
    assert(!withoutVms.some(item => ['/system/virtual-machines', '/vms'].includes(item.href)))
    assert(withoutVms.some(item => item.href === '/system/containers'))
    assert(!navigationLinks(getDashboardNavigation(memberAccess)).some(item => ['/db', '/system/updates'].includes(item.href)))
    for (const href of ['/logs', '/logs/realtime', '/logs/search', '/logs/errors']) assert(operator.some(item => item.href === href), `System administrators need access to ${href}`)
    assert.equal(all.find(item => item.href === '/findings/actors')?.label, 'Actors')
    assert.deepEqual(all.filter(item => item.ancestors.includes('Logs & rules')).map(item => item.href), ['/logs', '/logs/realtime', '/logs/search', '/logs/errors', '/traffic', '/traffic/recent', '/traffic/map', '/traffic/blocklist', '/rules/match', '/rules/analysis', '/rules/detection', '/rules/tuning'])
    for (const href of ['/vulnerabilities', '/system/rates', '/load-testing']) assert.deepEqual(all.find(item => item.href === href)?.ancestors, ['Infrastructure', 'Health'])
    assert(!all.some(item => item.ancestors.includes('Observability') || item.ancestors.includes('Security & recovery')))
    for (const path of ['/management/users']) {
        assert.deepEqual(all.find(item => item.href === path)?.ancestors, ['Administration'])
    }
    assert(!navigationLinks(getDashboardNavigation(memberAccess)).some(item => item.href.startsWith('/management')))
    assert.deepEqual(all.find(item => item.href === '/cases')?.ancestors, ['Security & intelligence', 'Investigations'])
    assert.deepEqual(all.find(item => item.href === '/findings/actors')?.ancestors, ['Security & intelligence', 'Intelligence'])
    assert(!getDashboardNavigation(access).some(item => item.href === '/dashboard'), 'Home must stay in the sidebar header instead of the navigation list')
    assert.deepEqual(all.find(item => item.href === '/management/service-accounts')?.ancestors, ['Organization', 'Access & credentials'])
    assert.deepEqual(all.find(item => item.href === '/mail')?.ancestors, ['Communication'])
    assert.deepEqual(all.find(item => item.href === '/organizations')?.ancestors, ['Organization'])
    const orgManager = navigationLinks(getDashboardNavigation({ ...memberAccess, canManageOrganizations: true }))
    assert.deepEqual(orgManager.find(item => item.href === '/management/organizations')?.ancestors, ['Administration'])
    assert(!orgManager.some(item => item.href === '/management/users'))

    for (const permissions of [access, memberAccess]) {
        const links = navigationLinks(getDashboardNavigation(permissions))
        assert(!links.some(item => item.href === '/solutions'), 'Marketing catalog must not appear in the internal menu')
        for (const href of ['/findings', '/cases', '/rules/match', '/rules/analysis', '/rules/detection', '/ti', '/organizations', '/pwned', '/test']) assert(links.some(item => item.href === href), `Missing product destination: ${href}`)
        assert(links.some(item => item.label === 'Security Scanner' && item.href === (permissions.canViewInternalPages ? '/scanner' : '/solutions/scanner')))
        for (const category of ['match', 'analysis', 'detection']) assert.deepEqual(links.find(item => item.href === `/rules/${category}`)?.ancestors, ['Logs & rules', 'Rules'])
    }
    for (const path of ['/solutions/scanner', '/solutions/security-monitoring', '/pwned', '/test']) assert(hasAppSidebar(path), `Product loses the signed-in sidebar: ${path}`)
    assert(!hasAppSidebar('/browser-unrelated'))
    return all.length
}
