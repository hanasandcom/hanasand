import { expect, test } from '@playwright/test'

test('signed-out SSH key visits go to login and preserve the requested page', async ({ page }) => {
    const response = await page.goto('/profile/eirikhanasand/ssh-keys')

    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/login\?path=/)
    await expect(page.locator('input[name="redirectPath"]')).toHaveValue('/profile/eirikhanasand/ssh-keys')
    await expect(page.getByLabel('Username')).toBeVisible()
    await expect(page.getByText('Sign in to continue to /profile/eirikhanasand/ssh-keys.')).toBeVisible()
})
