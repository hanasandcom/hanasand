import { expect, test, type BrowserContext } from '@playwright/test'

async function authenticateDashboard(context: BrowserContext, baseURL: string) {
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: baseURL },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: baseURL },
    ])
}

test('legacy impersonation route redirects to Helpdesk', async ({ context, page, baseURL }) => {
    await authenticateDashboard(context, baseURL || 'http://127.0.0.1:3000')
    await page.goto('/system/impersonation', { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/helpdesk$/)
    await expect(page.getByRole('heading', { name: 'Audit timeline' })).toBeVisible()
})

test('Helpdesk route renders its current audit view', async ({ context, page, baseURL }) => {
    await authenticateDashboard(context, baseURL || 'http://127.0.0.1:3000')
    await page.goto('/helpdesk', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Audit timeline' })).toBeVisible()
    await expect(page.getByPlaceholder('Search audit events')).toBeVisible()
})
