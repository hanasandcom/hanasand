import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    await page.route('https://identity.hanasand.com/**', route => route.fulfill({
        contentType: 'text/html',
        body: '<main>Identity sign-in</main>',
    }))
})

test('main-site sign-in redirects to Identity with a same-site return destination', async ({ page }) => {
    await page.goto('/login?path=%2Forganizations')

    const destination = new URL(page.url())
    expect(destination.origin).toBe('https://identity.hanasand.com')
    expect(destination.pathname).toBe('/login')
    expect(destination.searchParams.get('returnTo')).toBe('https://hanasand.com/organizations')
    await expect(page.getByText('Identity sign-in', { exact: true })).toBeVisible()
})

test('legacy signup URLs lead directly to Identity signup', async ({ page }) => {
    for (const path of ['/login?mode=signup', '/signup', '/register']) {
        await page.goto(path)
        const destination = new URL(page.url())
        expect(destination.origin).toBe('https://identity.hanasand.com')
        expect(destination.pathname).toBe('/signup')
        await expect(page.getByText('Identity sign-in', { exact: true })).toBeVisible()
    }
})
