import { expect, test } from '@playwright/test'
import { createDashboardUserSession, uniqueSuffix } from './dashboard-resource-auth'
import { adminOnlyOperationHrefs } from './dashboard-resource-data'
import { scrollConsoleContentToBottom, sidebarLayoutMetrics } from './dashboard-resource-sidebar-helpers'
import { getDashboardNavigation, navigationLinks } from '../src/utils/layout/dashboardNavigation'

test.describe('dashboard sidebar resources', () => {
    test('sidebar keeps admin controls internal and out of normal customer navigation', async () => {
        const normalLinks = navigationLinks(getDashboardNavigation({ id: 'normal-user' }))
        const internalLinks = navigationLinks(getDashboardNavigation({
            id: 'hanasand-user', canViewInternalPages: true, canReviewIntel: true, hasVMs: true,
        }))
        const internalHrefs = [
            '/ti/activity', '/ti/profiles', '/ti/sources', '/ti/runs', '/ti/timeliness',
            '/logs', '/logs/realtime', '/logs/search', '/logs/errors', '/traffic',
            '/system/ai', '/vulnerabilities', '/db', '/db/backups', '/system/rates',
            '/load-testing', '/management/users', '/management/service-accounts',
            '/content/articles', '/content/thoughts',
        ]
        for (const href of internalHrefs) {
            expect(normalLinks.some(link => link.href === href), `${href} should be hidden from normal navigation`).toBe(false)
            expect(internalLinks.some(link => link.href === href), `${href} should be available to internal operators`).toBe(true)
        }
    })
    test('console sidebar stays bounded after page scrolling', async ({ browser, request, baseURL }) => {
        const userId = `pdrsb${uniqueSuffix()}`
        const { context, cleanup } = await createDashboardUserSession(
            browser,
            request,
            baseURL,
            userId,
            'Dashboard Sidebar',
            { viewport: { width: 1280, height: 900 } },
        )

        try {
            const page = await context.newPage()
            const routes = ['/dashboard', '/findings', '/subscription', '/ti/apt42']

            for (const route of routes) {
                await page.goto(route, { waitUntil: 'domcontentloaded' })
                const siteHeader = page.locator('[data-site-header]')
                await expect(siteHeader).toBeVisible()
                for (const href of adminOnlyOperationHrefs) {
                    await expect(siteHeader.locator(`a[href="${href}"]`), `Customer header should not expose ${href} on ${route}`).toHaveCount(0)
                }
                await expect(page.locator('aside')).toBeVisible()
                await expect(page.locator('aside').getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
                await expect(page.locator('aside nav').getByRole('link', { name: 'Dark web', exact: true })).toHaveAttribute('href', '/findings')
                await expect(page.locator('aside nav').getByRole('link', { name: 'Subscription', exact: true })).toHaveAttribute('href', '/subscription')
                await expect(page.locator('aside nav').getByRole('link', { name: 'Webhooks', exact: true })).toHaveCount(0)
                await expect(page.locator('aside nav').getByRole('link', { name: 'Pricing', exact: true })).toHaveCount(0)
                await expect(page.locator('aside nav').getByRole('link', { name: 'Articles', exact: true })).toHaveCount(0)

                const before = await sidebarLayoutMetrics(page)
                await page.mouse.wheel(0, 1200)
                await page.waitForTimeout(100)
                const afterWheel = await sidebarLayoutMetrics(page)
                await scrollConsoleContentToBottom(page)
                await page.waitForTimeout(100)
                const afterBottom = await sidebarLayoutMetrics(page)

                expect(before.asideBottom).toBeLessThanOrEqual(before.viewportHeight + 1)
                expect(afterWheel.asideTop).toBeGreaterThanOrEqual(-1)
                expect(afterWheel.asideBottom).toBeLessThanOrEqual(afterWheel.viewportHeight + 1)
                expect(afterWheel.documentScrollHeight).toBeLessThanOrEqual(afterWheel.viewportHeight + 20)
                expect(afterWheel.horizontalOverflow).toBeLessThanOrEqual(1)
                expect(afterBottom.asideTop).toBeGreaterThanOrEqual(-1)
                expect(afterBottom.asideBottom).toBeLessThanOrEqual(afterBottom.viewportHeight + 1)
                expect(afterBottom.documentScrollHeight).toBeLessThanOrEqual(afterBottom.viewportHeight + 20)
                expect(afterBottom.horizontalOverflow).toBeLessThanOrEqual(1)
            }
        } finally {
            await cleanup()
        }
    })
})
