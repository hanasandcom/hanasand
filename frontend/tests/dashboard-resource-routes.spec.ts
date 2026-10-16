import { expect, test } from '@playwright/test'
import { authenticateContext, createUser, deleteUser } from './dashboard-resource-auth'
import { dashboardRoutes, privilegedDashboardRoutes, normalSidebarLinks, password } from './dashboard-resource-data'
import { expectNormalUserDestination, expectNormalUserOverviewActions, expectNormalUserSidebar } from './dashboard-resource-sidebar-helpers'

test.describe('dashboard resource routes', () => {
    test.describe.configure({ mode: 'serial' })
    test.setTimeout(180_000)

    test('authenticated dashboard resource routes load without auth or server errors', async ({ browser, request, baseURL }, testInfo) => {
        const userId = `pdr${Date.now().toString().slice(-8)}`
        const auth = await createUser(request, userId, 'Dashboard Smoke')
        const context = await browser.newContext({ baseURL })
        const pageErrors: string[] = []
        const failedResponses: string[] = []

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()

            page.on('pageerror', (error) => pageErrors.push(error.message))
            page.on('response', (response) => {
                if (response.status() >= 500) {
                    failedResponses.push(`${response.status()} ${response.url()}`)
                }
            })

            for (const route of dashboardRoutes) {
                await page.goto(route.path, { waitUntil: 'domcontentloaded' })
                await expect(page).toHaveURL(new RegExp(`${route.path.replace(/\//g, '\\/')}$`))
                await expect(page.locator('main').getByRole('heading', { name: route.heading }).first()).toBeVisible()
                await expect(page.getByText(/401 Unauthorized|Please log in|Failed to load|Internal Server Error/i)).toHaveCount(0)

                if (route.path === '/dashboard') {
                    await expectNormalUserSidebar(page, userId)
                }

                if (route.path === '/dashboard') {
                    await expectNormalUserOverviewActions(page)
                }

                if (route.screenshot) {
                    await page.screenshot({ path: testInfo.outputPath(route.screenshot), fullPage: true })
                }
            }

            expect(pageErrors).toEqual([])
            expect(failedResponses).toEqual([])
        } finally {
            await context.close()
            await deleteUser(request, userId, password)
        }
    })

    test('normal authenticated users are redirected away from privileged dashboard routes', async ({ browser, request, baseURL }) => {
        const userId = `pdrg${Date.now().toString().slice(-8)}`
        const auth = await createUser(request, userId, 'Dashboard Guard')
        const context = await browser.newContext({ baseURL })

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()

            for (const route of privilegedDashboardRoutes) {
                await page.goto(route.path, { waitUntil: 'domcontentloaded' })
                await expect(page).toHaveURL(/\/dashboard\?notAllowed=true/)
                await expect(page.getByText('That console area is not included in this account.')).toBeVisible()
                await expect(page.getByText(/Sign in to continue|Token expired/i)).toHaveCount(0)
            }
        } finally {
            await context.close()
            await deleteUser(request, userId, password)
        }
    })

    test('normal authenticated users can navigate allowed dashboard sidebar links', async ({ browser, request, baseURL }) => {
        const userId = `pdrnav${Date.now().toString().slice(-6)}`
        const auth = await createUser(request, userId, 'Dashboard Navigation')
        const context = await browser.newContext({ baseURL })

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()

            await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
            await expectNormalUserSidebar(page, userId)

            const consoleRoutes = normalSidebarLinks.filter(link => link.href.startsWith('/dashboard') || link.href.startsWith('/ti'))
            for (const link of consoleRoutes) {
                await page.locator('aside nav').getByRole('link', { name: link.name, exact: true }).click()
                await expect(page).toHaveURL(new RegExp(`${link.href.replace(/\//g, '\\/')}$`))
                await expectNormalUserSidebar(page, userId)
                await expectNormalUserDestination(page, link.href)
            }
        } finally {
            await context.close()
            await deleteUser(request, userId, password)
        }
    })
    test('legacy VM detail aliases preserve nested VM names', async ({ browser, request, baseURL }) => {
        const userId = `pdra${Date.now().toString().slice(-8)}`
        const auth = await createUser(request, userId, 'Dashboard Alias')
        const context = await browser.newContext({ baseURL })

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()

            await page.goto('/vm', { waitUntil: 'domcontentloaded' })
            await expect(page).toHaveURL(/\/vms$/)

            await page.goto('/vm/folder/test%20vm', { waitUntil: 'domcontentloaded' })
            expect(new URL(page.url()).pathname).toBe('/vms/folder/test%20vm')
        } finally {
            await context.close()
            await deleteUser(request, userId, password)
        }
    })
})
