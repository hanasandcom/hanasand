import { test, expect, openManagementPage } from './management-impersonation-fixtures'

test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

test.beforeEach(({ impersonationHarness }) => impersonationHarness.reset())

test('row menu supports keyboard dismissal and preserves delete confirmation', async ({ browser, impersonationHarness }) => {
    const { context, page } = await openManagementPage(browser, impersonationHarness)
    try {
        const trigger = page.getByRole('button', { name: 'Actions for target-user', exact: true })
        const action = page.getByRole('button', { name: 'Impersonate target-user', exact: true })
        await expect(action).toBeHidden()
        const before = await trigger.boundingBox()
        await page.getByText('Target User', { exact: true }).hover()
        await expect(trigger).toHaveCSS('opacity', '1')
        expect(await trigger.boundingBox()).toEqual(before)
        await trigger.focus()
        await page.keyboard.press('Enter')
        await expect(action).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(action).toBeHidden()
        await expect(trigger).toBeFocused()
        await trigger.click()
        await page.getByRole('button', { name: 'Delete target-user', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: 'Delete target-user?' })
        await expect(dialog).toBeVisible()
        await expect(dialog.getByLabel('Don’t ask again for this session')).toBeVisible()
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(dialog).toBeHidden()
    } finally {
        await context.close()
    }
})

test('touch users can tap the menu without navigating away', async ({ browser, impersonationHarness }) => {
    const { context, page } = await openManagementPage(browser, impersonationHarness, true)
    try {
        const trigger = page.getByRole('button', { name: 'Actions for target-user', exact: true })
        await expect(trigger).toHaveCSS('opacity', '1')
        await trigger.tap()
        await expect(page).toHaveURL(/\/management\/users$/)
        await page.getByRole('heading', { name: 'Users', exact: true }).tap()
    } finally {
        await context.close()
    }
})
