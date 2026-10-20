import { expect, test } from '@playwright/test'

test('signed-out gallery visits go straight to sign-in and preserve the return path', async ({ page }) => {
    await page.goto('/gallery')

    await expect(page).toHaveURL(/\/login\?path=%2Fgallery$/)
    await expect(page.getByLabel('Username')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
})

test('gallery redirects to sign-in when the CDN rejects the session', async ({ context, page, baseURL }) => {
    await context.addCookies([
        { name: 'id', value: 'gallery-test-user', url: baseURL! },
        { name: 'access_token', value: 'expired-gallery-session', url: baseURL! },
    ])
    await page.route('**/files/user/**', route => route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
    }))

    await page.goto('/gallery')

    await expect(page).toHaveURL(/\/login\?path=%2Fgallery$/)
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
})
