import { expect, test } from '@playwright/test'
import { setupOrganizationWorkspace } from './organization-workspace-harness'

test('organization workspace invite filtering creation copy resend and revoke', async ({ context, page, baseURL }) => {
    const state = await setupOrganizationWorkspace(context, page, baseURL)
    await expect(page.locator('#invites')).not.toHaveAttribute('open')
    await page.locator('#invites > summary').click()
    await expect(page.locator('#invites')).toHaveAttribute('open', '')
    await expect(page.locator('[data-org-invite-filter-strip="true"]')).toBeVisible()
    await expect(page.locator('[data-org-invite-filter-count="true"]')).toContainText('2/2 shown')
    await page.locator('#invites').getByLabel('Emails').fill('new.member@acme.test')
    await page.locator('#invites').getByRole('button', { name: 'Send invites' }).click()
    expect(state.inviteCreates).toContainEqual({ emails: ['new.member@acme.test'], role: 'member' })
    await expect(page.getByRole('status').filter({ hasText: '1 member invite sent.' })).toBeVisible()
    await page.getByLabel('Find invite').fill('revoked')
    await expect(page.locator('[data-org-invite-filter-count="true"]')).toContainText('1/2 shown')
    await expect(page.locator('#invites')).toContainText('former@acme.test')
    await expect(page.locator('#invites')).toContainText('Link closed')
    await expect(page.locator('#invites')).not.toContainText('admin@acme.test')
    await page.locator('[data-org-invite-filter-strip="true"]').getByLabel('Status').selectOption('pending')
    await expect(page.locator('[data-org-invite-filter-count="true"]')).toContainText('0/2 shown')
    await expect(page.locator('#invites')).toContainText('Adjust filters to see pending access requests.')
    await page.locator('[data-org-invite-filter-strip="true"]').getByRole('button', { name: 'Clear' }).click()
    await page.locator('[data-org-invite-filter-strip="true"]').getByLabel('Status').selectOption('pending')
    await expect(page.locator('[data-org-invite-filter-count="true"]')).toContainText('1/2 shown')
    await expect(page.locator('#invites')).toContainText('admin@acme.test')
    await expect(page.locator('#invites')).toContainText('Link available')
    await page.locator('#invites').getByLabel('Copy invite link').click()
    await expect.poll(() => page.evaluate(() => (window as Window & { __copiedInvite?: string }).__copiedInvite)).toBe('/organizations/invites/invite_acme_admin')
    await expect(page.locator('#invites')).toContainText('Invite link copied.')
    await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: async () => { throw new Error('Clipboard unavailable') } },
        })
        document.execCommand = () => false
    })
    await page.locator('#invites').getByLabel('Copy invite link').click()
    await expect(page.locator('#invites')).toContainText('Could not copy invite link.')
    await page.locator('#invites').getByLabel('Resend invite').click()
    expect(state.inviteActions).toContainEqual({ inviteId: 'invite_acme_admin', action: 'resend' })
    await expect(page.locator('#audit')).toContainText('Invite resent to admin@acme.test.')
    await page.locator('#invites').getByLabel('Revoke invite').click()
    await page.locator('#invites').getByLabel('Confirm revoke invite').click()
    expect(state.inviteActions).toContainEqual({ inviteId: 'invite_acme_admin', action: 'revoke' })
    await expect(page.locator('#audit')).toContainText('Invite revoked for admin@acme.test.')
})
