import { test, expect } from '@playwright/test'

test('password reset keeps its verified token through client-side navigation without a token URL', async({ page }) => {
    const resetToken = 'reset-flow-test-token'
    let completedReset: Record<string, unknown> | null = null

    await page.route('**/auth/password-reset/request', route => route.fulfill({ json: { ok: true } }))
    await page.route('**/auth/password-reset/verify', route => route.fulfill({ json: { ok: true, resetToken } }))
    await page.route('**/auth/password-reset/complete', async route => {
        completedReset = route.request().postDataJSON()
        return route.fulfill({ json: { ok: true } })
    })

    await page.goto('/reset-password?id=policytest')
    await page.getByRole('button', { name: 'Reset password', exact: true }).click()
    await page.locator('#login-reset-username').fill('policytest')
    await page.getByRole('button', { name: 'Send code', exact: true }).click()
    for (const [index, digit] of '123456'.split('').entries()) {
        await page.getByLabel(`Reset code digit ${index + 1}`).fill(digit)
    }

    await expect(page.getByRole('heading', { name: 'New password', exact: true })).toBeVisible()
    await expect(page.getByText('This reset link is missing or expired.', { exact: true })).toHaveCount(0)
    expect(new URL(page.url()).hash).toBe('')
    expect(page.url()).not.toContain(resetToken)
    await page.getByLabel('New password', { exact: true }).fill('Abcdefghijklmn1!')
    await page.getByLabel('Confirm password', { exact: true }).fill('Abcdefghijklmn1!')
    await page.getByRole('button', { name: 'Set password', exact: true }).click()
    await expect.poll(() => completedReset).toEqual({ id: 'policytest', resetToken, password: 'Abcdefghijklmn1!' })
})

test('reset accepts one of each character type and rejects missing types', async({ page }) => {
    test.skip(process.env.PASSWORD_POLICY_TEST !== '1', 'Requires a local frontend.')
    let resetSubmitted = false
    await page.route('**/auth/password-reset/complete', route => { resetSubmitted = true; return route.fulfill({ json: { ok: true } }) })
    await page.goto('/reset-password?id=policytest#token=test-only-token')
    await expect(page.getByText('Update your password.', { exact: true })).toBeVisible()
    await expect(page.locator('section > div > div:last-child')).toHaveAttribute('class', 'grid w-full gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-md md:p-5')
    await page.getByPlaceholder('New password', { exact: true }).fill('Abcdefghijklmnop1')
    await page.getByPlaceholder('Confirm password', { exact: true }).fill('Abcdefghijklmnop1')
    await page.getByRole('button', { name: 'Set password', exact: true }).click()
    await expect(page.getByText('Use at least 16 characters, including one uppercase letter, one lowercase letter, one number, and one special character.', { exact: true })).toBeVisible()
    expect(resetSubmitted).toBe(false)
    await page.getByPlaceholder('New password', { exact: true }).fill('Abcdefghijklmn1!')
    await page.getByPlaceholder('Confirm password', { exact: true }).fill('Abcdefghijklmn1!')
    await page.getByRole('button', { name: 'Set password', exact: true }).click()
    await expect.poll(() => resetSubmitted).toBe(true)
})
