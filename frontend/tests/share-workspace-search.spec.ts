import { expect, test } from '@playwright/test'

const shareId = 'workspace-search-active'
const otherId = 'workspace-search-other'

test('workspace search finds files and replace-all updates each matching share', async ({ page }) => {
    const updates: Array<{ id: string, content: string }> = []
    const activeShare = { id: shareId, alias: 'main.ts', path: 'src/main.ts', content: 'const token = "token";', owner: '', parent: '' }
    let activeContent = activeShare.content
    let otherContent = 'Token appears once.'
    await page.route(`**/api/share/${shareId}`, async route => {
        if (route.request().method() === 'PUT') {
            const body = route.request().postDataJSON() as { content: string }
            activeContent = body.content
            updates.push({ id: shareId, content: body.content })
            await route.fulfill({ json: { ...activeShare, content: activeContent } })
            return
        }
        await route.fulfill({ json: { ...activeShare, content: activeContent } })
    })
    await page.route(`**/api/share/tree/${shareId}`, route => route.fulfill({ json: [
        { id: 'source-folder', name: 'src', alias: 'src', parent: null, type: 'folder', children: [
            { id: shareId, name: 'main.ts', alias: 'main.ts', parent: 'source-folder', type: 'file' },
        ] },
        { id: 'test-folder', name: 'tests', alias: 'tests', parent: null, type: 'folder', children: [
            { id: otherId, name: 'other.ts', alias: 'other.ts', parent: 'test-folder', type: 'file' },
        ] },
    ] }))
    await page.route(`**/api/share/${otherId}`, async route => {
        if (route.request().method() === 'PUT') {
            const body = route.request().postDataJSON() as { content: string }
            otherContent = body.content
            updates.push({ id: otherId, content: body.content })
            await route.fulfill({ json: { id: otherId, content: otherContent } })
            return
        }
        await route.fulfill({ json: { id: otherId, content: otherContent } })
    })

    await page.goto(`/s/${shareId}`)
    await page.getByRole('button', { name: 'Search and replace' }).click()
    await page.getByRole('textbox', { name: 'Search files' }).fill('token')
    await expect(page.getByText('3 results in 2 files')).toBeVisible()
    await page.getByRole('textbox', { name: 'Replace text' }).fill('signal')
    await page.getByRole('button', { name: 'Replace all' }).click()

    await expect.poll(() => updates.length).toBe(2)
    expect(updates).toEqual([
        { id: shareId, content: 'const signal = "signal";' },
        { id: otherId, content: 'signal appears once.' },
    ])

    await page.getByRole('button', { name: 'Symbols' }).click()
    await page.getByPlaceholder('Click code or search a symbol').fill('signal')
    await expect(page.getByText('3 references', { exact: true })).toBeVisible()
    await expect(page.getByText('1 definitions', { exact: true })).toBeVisible()
})
