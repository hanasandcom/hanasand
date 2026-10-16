import { expect, test, type Page } from '@playwright/test'
import { setupOrganizationWorkspace } from './organization-workspace-harness'

test('organization search opens from both Cmd-J and Ctrl-J', async ({ context, page, baseURL }) => {
    await setupOrganizationWorkspace(context, page, baseURL)

    for (const shortcut of ['Control+j', 'Meta+j']) {
        await page.keyboard.press(shortcut)
        const search = page.getByRole('dialog', { name: 'Search organizations' })
        await expect(search).toBeVisible()
        await expect(search.getByRole('textbox', { name: 'Search organizations' })).toBeFocused()
        await page.keyboard.press('Escape')
        await expect(search).toBeHidden()
    }
})

async function expectReadOnlyOrganization(page: Page) {
    await page.locator('[data-org-switcher]').selectOption('org_contoso')
    await expect(page).toHaveURL(/organizationId=org_contoso/)
    await expect(page.locator('#settings').getByLabel('Name')).toBeDisabled()
    await expect(page.locator('#settings')).toContainText('Only admins can edit.')

    await page.locator('#invites > summary').click()
    await expect(page.locator('#invites').getByLabel('Emails')).toBeDisabled()
    await expect(page.locator('#invites').getByLabel('Role')).toBeDisabled()
    await expect(page.locator('#invites').getByRole('button', { name: 'Send invites' })).toBeDisabled()
}

test('viewer organizations expose read-only settings and invite controls', async ({ context, page, baseURL }) => {
    await setupOrganizationWorkspace(context, page, baseURL)
    await expectReadOnlyOrganization(page)
})

test('support access exposes the same read-only organization controls', async ({ context, page, baseURL }) => {
    await setupOrganizationWorkspace(context, page, baseURL, 'support')
    await expectReadOnlyOrganization(page)
})
