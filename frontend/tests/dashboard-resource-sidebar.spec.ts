import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { authenticateContext, createUser, deleteUser, uniqueSuffix } from './dashboard-resource-auth'
import { adminOnlyOperationHrefs, password, privilegedSidebarLinks, root } from './dashboard-resource-data'
import { scrollConsoleContentToBottom, sidebarLayoutMetrics } from './dashboard-resource-sidebar-helpers'

test.describe('dashboard sidebar resources', () => {
    test('sidebar keeps admin controls internal and out of normal customer navigation', async () => {
        const sidebar = await readFile(path.join(root, 'src/components/dashboard/dashboardSidebar.tsx'), 'utf8')
        const header = await readFile(path.join(root, 'src/components/header/header.tsx'), 'utf8')

        for (const name of privilegedSidebarLinks) {
            expect(sidebar, `Dashboard sidebar should expose ${name} only through privileged sections`).toContain(`label: '${name}'`)
        }

        for (const href of adminOnlyOperationHrefs) {
            expect(header, `Public/customer header should not expose ${href}`).not.toContain(`href='${href}'`)
            expect(header, `Public/customer header should not expose ${href}`).not.toContain(`href: '${href}'`)
        }
    })
    test('console sidebar stays bounded after page scrolling', async ({ browser, request, baseURL }) => {
        const userId = `pdrsb${uniqueSuffix()}`
        const auth = await createUser(request, userId, 'Dashboard Sidebar')
        const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } })

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()
            const routes = ['/dashboard', '/findings', '/subscription', '/ti/apt42']

            for (const route of routes) {
                await page.goto(route, { waitUntil: 'domcontentloaded' })
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
            await context.close()
            await deleteUser(request, userId, password)
        }
    })
})
