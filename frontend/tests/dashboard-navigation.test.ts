import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getDashboardNavigation, navigationLinks, pinnedNavigation, type NavigationItem } from '../src/utils/layout/dashboardNavigation'
import { organizationNavigationPages } from '../src/utils/organizations/pages'
import { canViewHanasandInternalPages, HANASAND_ORGANIZATION_ID } from '../src/utils/organizations/internalPageAccess'
import { thesisNavigationFromDocument } from '../src/utils/layout/thesisNavigationData'
import { writeSheets } from '../src/app/thesis/workspace'
import { isActiveDashboardNavigationPath } from '../src/components/dashboard/dashboardNavigationPath'

test('dashboard active paths include exact and slash-delimited descendants only', () => {
    assert.equal(isActiveDashboardNavigationPath('Logs/Rules', 'Logs/Rules'), true)
    assert.equal(isActiveDashboardNavigationPath('Logs/Rules/Editor', 'Logs/Rules'), true)
    assert.equal(isActiveDashboardNavigationPath('Logs/Ruleset', 'Logs/Rules'), false)
    assert.equal(isActiveDashboardNavigationPath('Logs/Other', 'Logs/Rules'), false)
})

test('organization pages and standalone watchlists remain reachable after regrouping', () => {
    const links = navigationLinks(getDashboardNavigation({ id: 'member' }))
    for (const page of organizationNavigationPages) {
        const standalone = page.id === 'watchlists'
        const href = standalone ? '/watchlists' : page.href
        const matches = links.filter(link => link.href === href)
        assert.equal(matches.length, 1, `${page.id} appears once in the dashboard navigation`)
        assert.equal(matches[0].ancestors[0], standalone ? 'Security & intelligence' : 'Organization')
    }
})

test('every dropdown has at most five entries, including long pinned lists', () => {
    function check(items: NavigationItem[]) {
        for (const item of items) if (item.items) {
            assert(item.items.length <= 5, item.label)
            check(item.items)
        }
    }
    const sections = getDashboardNavigation({ id: 'admin', canManageOrganizations: true, canViewInternalPages: true, hasVMs: true })
    check(sections)
    const links = navigationLinks(sections)
    const pinned = pinnedNavigation(links)
    check([{ label: 'Pinned', items: pinned }])
    assert.deepEqual(navigationLinks(pinned).map(item => item.href), links.map(item => item.href))
})

test('Sandbox remains available from the dashboard sidebar', () => {
    const links = navigationLinks(getDashboardNavigation({ id: 'member' }))
    assert.equal(links.some(link => link.label === 'Sandbox' && link.href === '/sandbox'), true)
})

test('feeds remain reachable without the removed collection targets entry', () => {
    const links = navigationLinks(getDashboardNavigation({ id: 'admin', canViewInternalPages: true }))
    assert.equal(links.filter(link => link.href === '/ti/sources').length, 1)
    assert.equal(links.some(link => link.href?.startsWith('/ti/domains')), false)
})

test('intelligence reviewers can reach delivery health without internal-page access', () => {
    const reviewerLinks = navigationLinks(getDashboardNavigation({ id: 'reviewer', canReviewIntel: true }))
    const memberLinks = navigationLinks(getDashboardNavigation({ id: 'member' }))

    assert.equal(reviewerLinks.some(link => link.href === '/ti/timeliness'), true)
    assert.equal(memberLinks.some(link => link.href === '/ti/timeliness'), false)
    assert.equal(reviewerLinks.some(link => link.href === '/db'), false)
})

test('traffic has separate overview, recent, map, and blocklist destinations', () => {
    const sections = getDashboardNavigation({ id: 'admin', canViewInternalPages: true })
    const logsAndRules = sections.find(item => item.label === 'Logs & rules')
    assert.deepEqual(logsAndRules?.items?.map(item => item.label), ['Logs', 'Traffic', 'Rules'])

    const traffic = logsAndRules?.items?.find(item => item.label === 'Traffic')
    assert.deepEqual(traffic?.items?.map(item => item.label), ['Overview', 'Recent traffic', 'Live map', 'Blocklist'])
    assert.deepEqual(traffic?.items?.map(item => item.href), ['/traffic', '/traffic/recent', '/traffic/map', '/traffic/blocklist'])
})

test('load test shortcut uses a distinct label from the operator load-testing dashboard', () => {
    const sections = getDashboardNavigation({ id: 'admin', canViewInternalPages: true })
    const links = navigationLinks(sections)
    assert.equal(links.find(item => item.href === '/test')?.label, 'Load test')
    assert.equal(links.find(item => item.href === '/load-testing')?.label, 'Load Testing')
})

test('workspaces and files have one Repositories navigation destination', () => {
    const links = navigationLinks(getDashboardNavigation({ id: 'admin', canViewInternalPages: true }))
    const repositoryLinks = links.filter(link => ['/repositories', '/projects', '/shares'].includes(link.href))
    assert.deepEqual(repositoryLinks.map(link => ({ label: link.label, href: link.href, section: link.ancestors.at(-1) })), [
        { label: 'Repositories', href: '/repositories', section: 'Monitoring' },
    ])
})

test('virtual machines are reachable from Monitoring for accounts with VM access', () => {
    const vmAdminLinks = navigationLinks(getDashboardNavigation({ id: 'admin', hasVMs: true }))
    const memberLinks = navigationLinks(getDashboardNavigation({ id: 'member' }))

    const vmLink = vmAdminLinks.find(link => link.href === '/system/virtual-machines')
    assert.deepEqual(vmLink?.ancestors, ['Security & intelligence', 'Monitoring'])
    assert.equal(memberLinks.some(link => link.href === '/system/virtual-machines'), false)
})

test('server-loaded thesis sheets are available under Content before opening Thesis', () => {
    const names = ['Overview', 'Timetable', 'Plan', 'Research', 'Experiments', 'Draft', 'Appendix']
    const document = {
        title: '# Thesis',
        body: writeSheets(names.map(name => ({ id: name, name, title: `# ${name}`, body: `${name} content` }))),
    }
    const thesisSheets = thesisNavigationFromDocument(document)
    const sections = getDashboardNavigation({ id: 'owner', hasHanasandOrganization: true, thesisSheets })
    const content = sections.find(section => section.label === 'Content')
    const thesis = content?.items?.find(item => item.label === 'Thesis')

    assert.deepEqual(thesisSheets.map(sheet => sheet.label), names)
    assert.deepEqual(navigationLinks(sections).filter(link => link.href.startsWith('/thesis?sheet=')).map(link => link.href), names.map(name => `/thesis?sheet=${encodeURIComponent(name)}`))
    assert.equal(thesis?.items?.some(item => item.label === 'More sheets'), true)
})

test('Hanasand owners and editors get internal pages from organization membership', () => {
    for (const role of ['owner', 'editor']) {
        assert.equal(canViewHanasandInternalPages([{ id: HANASAND_ORGANIZATION_ID, role, lifecycleStatus: 'active' }]), true)
    }
    assert.equal(canViewHanasandInternalPages([{ id: HANASAND_ORGANIZATION_ID, role: 'reader', lifecycleStatus: 'active' }]), true)
    assert.equal(canViewHanasandInternalPages([{ id: HANASAND_ORGANIZATION_ID, role: 'editor', lifecycleStatus: 'archived' }]), false)
    assert.equal(canViewHanasandInternalPages([{ id: 'another-org', role: 'owner', lifecycleStatus: 'active' }]), false)

    const links = navigationLinks(getDashboardNavigation({
        id: 'sindre',
        canManageOrganizations: true,
        canViewInternalPages: true, canReviewIntel: true, hasVMs: true,
    }))
    for (const path of ['/logs/realtime', '/traffic', '/ti/timeliness', '/db', '/management/users', '/management/organizations', '/vms', '/system/virtual-machines']) {
        assert.equal(links.some(link => link.href === path), true, path)
    }
})
