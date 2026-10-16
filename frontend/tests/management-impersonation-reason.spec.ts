import { test, expect, openImpersonationPrompt, openManagementPage } from './management-impersonation-fixtures'

test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

test.beforeEach(({ impersonationHarness }) => impersonationHarness.reset())

test('opens reason prompt, blocks short reasons, and sends valid reason payload', async ({ browser, impersonationHarness }) => {
    const { context, page } = await openManagementPage(browser, impersonationHarness)
    try {
        const prompt = await openImpersonationPrompt(page)
        await expect(prompt.getByLabel('Reason for impersonating Target User')).toBeVisible()
        await prompt.getByRole('button', { name: 'Start session' }).click()
        await expect(prompt.getByText('Enter at least 10 characters')).toBeVisible()
        expect(impersonationHarness.requests).toHaveLength(0)

        await prompt.getByPlaceholder('Describe the support case or audit reason').fill('Support case 1234 investigation')
        await prompt.getByRole('button', { name: 'Start session' }).click()
        await expect.poll(() => impersonationHarness.requests.length).toBe(1)
        expect(impersonationHarness.requests[0]).toMatchObject({
            target_id: 'target-user',
            reason: 'Support case 1234 investigation',
            durationMinutes: 30,
            scope: ['read_profile', 'read_org'],
        })
        await expect(prompt).toBeHidden()
        await expect(page.getByText('Impersonation reason must be at least 10 characters.')).toHaveCount(0)
    } finally {
        await context.close()
    }
})

test('shows backend errors without losing target or reason context', async ({ browser, impersonationHarness }) => {
    impersonationHarness.failNext()
    const { context, page } = await openManagementPage(browser, impersonationHarness)
    try {
        const prompt = await openImpersonationPrompt(page)
        const reasonInput = prompt.getByPlaceholder('Describe the support case or audit reason')
        await reasonInput.fill('Support case API failure')
        await prompt.getByRole('button', { name: 'Start session' }).click()
        await expect.poll(() => impersonationHarness.requests.length).toBe(1)
        await expect(prompt).toBeVisible()
        await expect(prompt.getByText('Mock backend refused impersonation for audit review.')).toBeVisible()
        await expect(reasonInput).toHaveValue('Support case API failure')
        await expect(prompt.getByText('Reason for impersonating Target User')).toBeVisible()
    } finally {
        await context.close()
    }
})
