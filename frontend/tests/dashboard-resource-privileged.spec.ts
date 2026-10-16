import { expect, test } from '@playwright/test'
import { authenticateContext, loginAsAdmin } from './dashboard-resource-auth'
import { adminExpiresAt, adminId, adminName, adminToken, hasAdminLoginCredentials, hasAdminToken, privilegedDashboardRoutes } from './dashboard-resource-data'

test.describe('privileged dashboard smoke', () => {
    test.skip(!hasAdminToken && !hasAdminLoginCredentials, 'Privileged dashboard smoke needs PLAYWRIGHT_ADMIN_TOKEN with PLAYWRIGHT_ADMIN_ID or explicit PLAYWRIGHT_ADMIN_ID/PLAYWRIGHT_ADMIN_PASSWORD.')

    test('privileged dashboard routes load for a system admin when credentials are available', async ({ browser, request, baseURL }) => {
        const auth = hasAdminToken
            ? {
                id: adminId,
                name: adminName,
                token: adminToken,
                expires_at: adminExpiresAt,
            }
            : await loginAsAdmin(request)

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

            for (const route of privilegedDashboardRoutes) {
                await page.goto(route.path, { waitUntil: 'domcontentloaded' })
                await expect(page).toHaveURL(new RegExp(`${route.path.replace(/\//g, '\\/')}$`))
                await expect(page.locator('main').getByRole('heading', { name: route.heading }).first()).toBeVisible()
                await expect(page.getByText(/401 Unauthorized|Please log in|Failed to load|Internal Server Error/i)).toHaveCount(0)
            }

            expect(pageErrors).toEqual([])
            expect(failedResponses).toEqual([])
        } finally {
            await context.close()
        }
    })
})
