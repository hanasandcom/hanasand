import { expect, test } from '@playwright/test'
import { setupOrganizationWorkspace } from './organization-workspace-harness'

test('retention settings enforce supported bounds and show save progress', async ({ context, page, baseURL }) => {
    await setupOrganizationWorkspace(context, page, baseURL)
    await page.goto('/organizations?organizationId=org_acme&focus=settings')

    const settings = page.locator('#settings')
    const retention = settings.getByLabel('Retention days')
    const save = settings.getByRole('button', { name: 'Save settings' })
    await retention.fill('29')
    await expect(settings).toContainText('Retention days must be between 30 and 2555.')
    await expect(save).toBeDisabled()
    await retention.fill('2556')
    await expect(settings).toContainText('Retention days must be between 30 and 2555.')
    await expect(save).toBeDisabled()

    let releaseSave!: () => void
    let markSaveStarted!: () => void
    const saveGate = new Promise<void>(resolve => { releaseSave = resolve })
    const saveStarted = new Promise<void>(resolve => { markSaveStarted = resolve })
    await page.route('**/api/organizations/org_acme/settings', async route => {
        if (route.request().method() !== 'PUT') return route.fulfill({ json: { settings: { name: 'Acme Security', slug: 'acme-security', retentionDays: 365 } } })
        const body = route.request().postDataJSON() as { retentionDays?: number }
        expect(body.retentionDays).toBe(90)
        markSaveStarted()
        await saveGate
        await route.fulfill({ json: { ok: true, settings: { name: 'Acme Security', slug: 'acme-security', retentionDays: 90 } } })
    })
    await retention.fill('90')
    await save.click()
    await saveStarted
    await expect(settings.locator('[data-org-settings-busy]')).toContainText('Saving settings')
    await expect(save).toBeDisabled()
    releaseSave()
    await expect(settings.locator('[data-org-settings-busy]')).toHaveCount(0)
    await expect(settings).toContainText('Organization settings updated.')
})
