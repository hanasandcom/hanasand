import { expect, test } from '@playwright/test'
import { authenticateContext, authHeaders, loginAsAdmin, uniqueSuffix } from './dashboard-resource-auth'
import { apiBase } from './dashboard-resource-data'

test('saved thought keeps its draft after a failed update and closes after retry', async ({ browser, request, baseURL }) => {
    const auth = await loginAsAdmin(request)
    const context = await browser.newContext({ baseURL })
    await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
    const originalTitle = `Thought ${uniqueSuffix()}`
    let thoughtId = ''

    try {
        const created = await request.post(`${apiBase}/thoughts`, {
            headers: authHeaders(auth),
            data: { title: originalTitle },
        })
        expect(created.ok()).toBeTruthy()
        thoughtId = (await created.json()).id

        const page = await context.newPage()
        await page.goto(`/content/thoughts/${encodeURIComponent(thoughtId)}`)
        await page.locator('.markdown-preview').click()

        const editor = page.getByRole('textbox')
        const revisedTitle = `${originalTitle} revised`
        await editor.fill(revisedTitle)
        const save = page.getByRole('button', { name: 'Save', exact: true })
        await expect(save).toBeVisible()

        let attempts = 0
        await page.route(`**/api/backend/thought/${encodeURIComponent(thoughtId)}`, route => {
            attempts++
            return route.fulfill({
                status: attempts === 1 ? 409 : 201,
                contentType: 'application/json',
                body: JSON.stringify(attempts === 1 ? { error: 'Thought already exists' } : { message: 'Updated' }),
            })
        })

        await save.click()
        await expect(page.getByText('Thought already exists')).toBeVisible()
        await expect(editor).toHaveValue(revisedTitle)
        await expect(save).toBeVisible()

        await save.click()
        await expect(editor).toHaveCount(0)
        await expect(page.locator('.markdown-preview')).toContainText(revisedTitle)
        expect(attempts).toBe(2)
    } finally {
        try {
            if (thoughtId) {
                const deleted = await request.delete(`${apiBase}/thought/${encodeURIComponent(thoughtId)}`, { headers: authHeaders(auth) })
                expect(deleted.ok(), 'the test thought should be removed').toBeTruthy()
            }
        } finally {
            await context.close()
        }
    }
})
