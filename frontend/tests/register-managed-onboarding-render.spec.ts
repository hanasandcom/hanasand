import { expect, test } from '@playwright/test'

test('login and signup routes hand off to Identity with a safe return path', async ({ page }) => {
    await page.route('https://identity.hanasand.com/**', route => route.fulfill({
        contentType: 'text/html',
        body: '<main>Identity</main>',
    }))

    const routes = [
        { source: '/login?path=%2Forganizations', expected: '/login' },
        { source: '/login?mode=signup&path=%2Forganizations', expected: '/signup' },
        { source: '/signup?path=%2Forganizations', expected: '/signup' },
        { source: '/register?path=%2Forganizations', expected: '/signup' },
    ]

    for (const route of routes) {
        await page.goto(route.source)
        const destination = new URL(page.url())
        expect(destination.origin).toBe('https://identity.hanasand.com')
        expect(destination.pathname).toBe(route.expected)
        expect(destination.searchParams.get('returnTo')).toBe('https://hanasand.com/organizations')
        await expect(page.getByText('Identity', { exact: true })).toBeVisible()
    }
})
