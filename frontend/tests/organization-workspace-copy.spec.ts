import { expect, test } from '@playwright/test'
import { setupOrganizationWorkspace } from './organization-workspace-harness'

test('copies selected delivery activity and preserves its DWM context links', async ({ context, page, baseURL }) => {
    await setupOrganizationWorkspace(context, page, baseURL)
    await page.goto('/organizations?organizationId=org_acme&deliveryId=req_acme_1')

    const activity = page.locator('#audit')
    await expect(activity.getByText('SOC Discord', { exact: true })).toBeVisible()
    await expect(activity.getByRole('link', { name: 'Integrations' })).toHaveAttribute('href', '/findings/delivery')
    await expect(activity.getByRole('link', { name: 'Watchlist', exact: true })).toHaveAttribute('href', '/organizations/watchlists#watchlist-watch_acme_domain')
    await activity.getByRole('button', { name: 'Copy', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as Window & { __copiedText?: string }).__copiedText)).toContain('SOC Discord')
    await expect.poll(() => page.evaluate(() => (window as Window & { __copiedText?: string }).__copiedText)).toContain('discord...acme')
    await expect(activity).toContainText('Activity copied.')

    await activity.getByRole('button', { name: 'Copy link', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as Window & { __copiedText?: string }).__copiedText)).toContain('destinationId=dest_acme_discord')
    await activity.getByRole('button', { name: 'All', exact: true }).click()
    await activity.locator('[data-org-activity-row]').filter({ hasText: 'Watchlist term' }).first().click()
    await expect(activity.getByRole('link', { name: 'Open event workspace' })).toHaveAttribute('href', '/ti/workbench?organizationId=org_acme&watchlistId=watch_acme_domain')
})

test('copies an organization-scoped records link from event records', async ({ context, page, baseURL }) => {
    await setupOrganizationWorkspace(context, page, baseURL)
    await page.goto('/organizations?organizationId=org_acme&focus=events')

    const records = page.locator('[data-org-scope-records="true"]')
    await expect(records.getByRole('heading', { name: 'Event, case, and destination records' })).toBeVisible()
    await records.getByRole('button', { name: 'Copy Events records link' }).click()
    await expect.poll(() => page.evaluate(() => (window as Window & { __copiedText?: string }).__copiedText)).toContain('/api/findings/alerts?organizationId=org_acme&org=org_acme')
    await expect(records).toContainText('Records link copied.')

    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => { throw new Error('Clipboard unavailable') } },
    }))
    await records.getByRole('button', { name: 'Copy Events records link' }).click()
    await expect(records).toContainText('Copy failed.')
})
