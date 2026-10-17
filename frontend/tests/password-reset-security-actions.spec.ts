import { expect, test } from '@playwright/test'

test('the security email lock link requires confirmation and locks after a POST', async({ page }) => {
    let submittedMethod = ''
    let submittedContentType = ''
    let submittedBody: unknown
    await page.route('**/auth/password-reset/lock-account', async route => {
        submittedMethod = route.request().method()
        submittedContentType = route.request().headers()['content-type']
        submittedBody = route.request().postDataJSON()
        await route.fulfill({ json: { ok: true } })
    })

    await page.goto('/secure-account#token=lock-action-test')
    await expect(page.locator('section > div > div:last-child')).toHaveAttribute('class', 'grid w-full gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-md md:p-5')
    await expect(page.getByRole('heading', { name: 'Wasn’t you? Lock your account.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Lock account', exact: true })).toBeVisible()
    expect(submittedMethod).toBe('')
    expect(page.url()).not.toContain('lock-action-test')

    await page.getByRole('button', { name: 'Lock account', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your account is locked' })).toBeVisible()
    expect(submittedMethod).toBe('POST')
    expect(submittedContentType).toBe('application/json')
    expect(submittedBody).toEqual({ token: 'lock-action-test' })
})

test('the email reset action opens the new-password form without exposing its token in the URL', async({ page }) => {
    let submittedMethod = ''
    let submittedContentType = ''
    let submittedBody: unknown
    await page.route('**/auth/password-reset/start-again', async route => {
        submittedMethod = route.request().method()
        submittedContentType = route.request().headers()['content-type']
        submittedBody = route.request().postDataJSON()
        await route.fulfill({ json: { ok: true, id: 'resetuser', resetToken: 'new-reset-session-token' } })
    })

    await page.goto('/reset-password-again#token=reset-action-test')
    await expect(page.locator('section > div > div:last-child')).toHaveAttribute('class', 'grid w-full gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-md md:p-5')
    await expect(page.getByRole('heading', { name: 'Reset your password again' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue to new password' })).toBeVisible()
    expect(submittedMethod).toBe('')
    expect(page.url()).not.toContain('reset-action-test')

    await page.getByRole('button', { name: 'Continue to new password' }).click()
    await expect(page.getByLabel('New password')).toBeVisible()
    expect(submittedMethod).toBe('POST')
    expect(submittedContentType).toBe('application/json')
    expect(submittedBody).toEqual({ token: 'reset-action-test' })
    expect(page.url()).not.toContain('new-reset-session-token')
})

test('password action endpoints keep their distinct API errors and do not enter success states', async({ page }) => {
    await page.route('**/auth/password-reset/lock-account', route => route.fulfill({ status: 400, json: { error: 'Account lock rejected.' } }))
    await page.goto('/secure-account#token=lock-error-test')
    await expect(page.getByRole('button', { name: 'Lock account', exact: true })).toBeVisible()
    expect(page.url()).not.toContain('lock-error-test')
    await page.getByRole('button', { name: 'Lock account', exact: true }).click()
    await expect(page.getByText('Account lock rejected.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Wasn’t you? Lock your account.' })).toBeVisible()

    await page.route('**/auth/password-reset/start-again', route => route.fulfill({ status: 400, json: { error: 'Reset restart rejected.' } }))
    await page.goto('/reset-password-again#token=reset-error-test')
    await expect(page.getByRole('button', { name: 'Continue to new password' })).toBeVisible()
    expect(page.url()).not.toContain('reset-error-test')
    await page.getByRole('button', { name: 'Continue to new password' }).click()
    await expect(page.getByText('Reset restart rejected.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reset your password again' })).toBeVisible()
})
