import { expect, test } from '@playwright/test'
import { authenticateContext, createUser, deleteUser } from './dashboard-resource-auth'
import { password } from './dashboard-resource-data'

test('notes dashboard supports create and delete flow', async ({ browser, request, baseURL }) => {
    const userId = `pdrn${Date.now().toString().slice(-8)}`
    const auth = await createUser(request, userId, 'Dashboard Notes')
    const context = await browser.newContext({ baseURL })
    const title = `Smoke note ${Date.now()}`
    const content = 'Created from the dashboard manage-flow smoke.'

    try {
        await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
        const page = await context.newPage()

        const notesLoaded = page.waitForResponse((response) =>
            response.url().includes('/api/backend/notes') &&
            response.request().method() === 'GET' &&
            response.ok()
        )
        await page.goto('/notes', { waitUntil: 'domcontentloaded' })
        await expect(page).toHaveURL(/\/notes$/)
        await notesLoaded
        await expect(page.getByText('No private notes yet.')).toBeVisible()

        const titleInput = page.getByPlaceholder('Title')
        const contentInput = page.getByPlaceholder('Write a private note...')

        await titleInput.fill(title)
        await contentInput.fill(content)
        await expect(titleInput).toHaveValue(title)
        await expect(contentInput).toHaveValue(content)
        await Promise.all([
            page.waitForResponse((response) =>
                response.url().includes('/api/backend/notes') &&
                response.request().method() === 'POST' &&
                response.ok()
            ),
            page.getByRole('button', { name: 'Save', exact: true }).click(),
        ])

        await expect(page.getByText('Saved.')).toBeVisible()
        await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()

        await Promise.all([
            page.waitForResponse((response) =>
                response.url().includes('/api/backend/notes/') &&
                response.request().method() === 'DELETE' &&
                response.ok()
            ),
            page.getByRole('button', { name: 'Delete', exact: true }).click(),
        ])
        await expect(page.getByText('Deleted.')).toBeVisible()
        await expect(page.getByText('No private notes yet.')).toBeVisible()
        await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(0)
    } finally {
        await context.close()
        await deleteUser(request, userId, password)
    }
})

test('automations dashboard supports create cancel and delete flow', async ({ browser, request, baseURL }) => {
    const userId = `pdrau${Date.now().toString().slice(-7)}`
    const auth = await createUser(request, userId, 'Dashboard Automations')
    const context = await browser.newContext({ baseURL })
    const title = `Smoke automation ${Date.now()}`
    const canceledTitle = `${title} canceled`

    try {
        await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
        const page = await context.newPage()

        const automationsLoaded = page.waitForResponse((response) =>
            response.url().includes('/api/backend/automations') &&
            response.request().method() === 'GET' &&
            response.ok()
        )
        await page.goto('/automation', { waitUntil: 'domcontentloaded' })
        await expect(page).toHaveURL(/\/automations$/)
        await automationsLoaded
        await expect(page.getByText('No automations yet.')).toBeVisible()

        await page.getByRole('button', { name: 'New automation' }).click()
        await expect(page.getByText('Draft ready.')).toBeVisible()

        await page.getByLabel('Automation name').fill(title)
        await page.getByText('Advanced matching rules').click()
        await page.getByRole('textbox', { name: 'Matching instructions', exact: true }).fill('Echo this dashboard smoke without running it.')
        await page.getByLabel('Automation type').selectOption('echo')
        await page.getByText('Advanced schedule and notification policy').click()
        await page.getByLabel('Status').selectOption('paused')

        await Promise.all([
            page.waitForResponse((response) =>
                response.url().includes('/api/backend/automations') &&
                response.request().method() === 'POST' &&
                response.ok()
            ),
            page.getByRole('button', { name: 'Create automation' }).click(),
        ])

        await expect(page.getByText('Automation created.')).toBeVisible()
        await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()

        await page.getByLabel('Automation name').fill(canceledTitle)
        await page.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(page.getByText('Changes discarded.')).toBeVisible()
        await expect(page.getByLabel('Automation name')).toHaveValue(title)
        await expect(page.getByRole('button', { name: new RegExp(canceledTitle) })).toHaveCount(0)

        await Promise.all([
            page.waitForResponse((response) =>
                response.url().includes('/api/backend/automations/') &&
                response.request().method() === 'DELETE' &&
                response.ok()
            ),
            page.getByRole('button', { name: 'Delete', exact: true }).click(),
        ])

        await expect(page.getByText('Automation removed.')).toBeVisible()
        await expect(page.getByText('No automations yet.')).toBeVisible()
        await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(0)
    } finally {
        await context.close()
        await deleteUser(request, userId, password)
    }
})
