import { expect, test } from '@playwright/test'

test('ordinary members can open the unified Repositories view through its legacy routes and navigation', async ({ context, page, baseURL }) => {
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token' }).map(([name, value]) => ({ name, value, url: baseURL! })))
    for (const route of ['/repositories', '/projects', '/shares', '/dashboard/projects', '/dashboard/shares']) {
        await page.goto(route)
        await expect(page).toHaveURL(/\/repositories$/)
        await expect(page.getByRole('heading', { name: 'Repositories', exact: true })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Files', exact: true })).toBeVisible()
        await expect(page.getByText('Personal test share', { exact: true }).first()).toBeVisible()
        const nav = page.getByRole('navigation', { name: 'Main navigation' })
        await expect(nav.getByRole('link', { name: 'Repositories', exact: true })).toHaveAttribute('href', '/repositories')
        await expect(nav.getByRole('link', { name: 'Content Management', exact: true })).toHaveCount(0)
        await expect(nav.getByRole('link', { name: 'Database', exact: true })).toHaveCount(0)
    }
})

test('signed-out visitors still need to sign in', async ({ page }) => {
    await page.goto('/repositories')
    await expect(page).toHaveURL(/\/login\?path=/)
})
