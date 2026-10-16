import { expect, test } from '@playwright/test'
import type { AutomationPayload } from '@/utils/automations/client'
import { automationFixture, createdAutomationFixture } from './fixtures/automations-ux-disclosure'

test('health automation list, details, run, and create flow use the current API contract', async ({ context, page, baseURL }) => {
    test.setTimeout(90_000)
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    for (const [name, value] of Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token' })) {
        await context.addCookies([{ name, value, url: baseURL! }])
    }

    const existing = automationFixture()
    let automations = [existing]
    let submitted: AutomationPayload | undefined
    const runRequests: string[] = []
    await page.route('**/api/backend/automations**', async route => {
        const request = route.request()
        const path = new URL(request.url()).pathname
        if (request.method() === 'GET' && path.endsWith('/api/backend/automations')) {
            await route.fulfill({ json: { automations, canManageSystem: false } })
            return
        }
        if (request.method() === 'GET' && path.endsWith(`/api/backend/automations/${existing.id}`)) {
            await route.fulfill({ json: { automation: existing, runs: [], issues: [], total: 0, nextPage: null } })
            return
        }
        if (request.method() === 'POST' && path.endsWith(`/api/backend/automations/${existing.id}/run`)) {
            runRequests.push(path)
            await route.fulfill({ json: { ok: true, message: 'queued' } })
            return
        }
        if (request.method() === 'GET' && path.endsWith('/api/backend/automations/created-health-check')) {
            const created = automations.find(item => item.id === 'created-health-check')!
            await route.fulfill({ json: { automation: created, runs: [], issues: [], total: 0, nextPage: null } })
            return
        }
        if (request.method() === 'POST' && path.endsWith('/api/backend/automations')) {
            submitted = request.postDataJSON() as AutomationPayload
            automations = [...automations, createdAutomationFixture(submitted)]
            await route.fulfill({ status: 201, json: { automation: automations.at(-1) } })
            return
        }
        await route.fulfill({ status: 404, json: { error: `Unhandled automation fixture request: ${request.method()} ${path}` } })
    })

    await page.goto('/automation/health', { waitUntil: 'domcontentloaded' })
    const retry = page.getByRole('button', { name: 'Try again' })
    if (await retry.isVisible()) await retry.click()

    await expect(page.getByRole('button', { name: existing.name, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: existing.name, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Recent checks/ })).toContainText('(0/0)')
    await page.getByRole('button', { name: 'Check now' }).click()
    await expect.poll(() => runRequests).toHaveLength(1)
    await expect(page.getByText('Check started. Refresh shortly to see the result.')).toBeVisible()

    await page.getByRole('button', { name: 'Create automation', exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('New API check')
    await page.getByLabel('URL to check', { exact: true }).fill('https://status.example.test/health')
    await page.getByLabel('Description', { exact: true }).fill('Check the new status endpoint.')
    await page.getByRole('button', { name: 'Create automation', exact: true }).click()

    await expect.poll(() => submitted).toMatchObject({
        name: 'New API check',
        targetUrl: 'https://status.example.test/health',
        prompt: 'Check the new status endpoint.',
        actionType: 'agent_prompt',
        scheduleKind: 'interval',
        intervalMinutes: 15,
        status: 'active',
    })
    await expect(page.getByRole('button', { name: 'New API check', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'New API check', exact: true })).toBeVisible()
    await expect(page.getByText('https://status.example.test/health')).toBeVisible()
})
