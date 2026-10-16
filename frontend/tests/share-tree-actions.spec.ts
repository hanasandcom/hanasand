import { expect, test } from '@playwright/test'

const shareId = 'tree-actions-project'
const fileId = 'tree-actions-report'

test('duplicating a tree file preserves its content and creates a sibling copy', async ({ page }) => {
    const duplicateRequests: Record<string, unknown>[] = []
    let resolveDuplicate!: () => void
    const duplicateCreated = new Promise<void>(resolve => { resolveDuplicate = resolve })

    await page.route(new RegExp(`/api/share/${shareId}$`), route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            id: shareId,
            alias: 'tree-actions-project',
            path: shareId,
            content: '',
            wordCount: 0,
            estimatedMinutes: 0,
            timestamp: new Date().toISOString(),
            git: null,
            locked: false,
            owner: '',
            parent: '',
        }),
    }))
    await page.route(new RegExp(`/api/share/tree/${shareId}$`), route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
            id: fileId,
            name: 'report.md',
            alias: 'report.md',
            parent: null,
            type: 'file',
        }]),
    }))
    await page.route(new RegExp(`/api/share/${fileId}$`), route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: fileId, content: '# Project report' }),
    }))
    await page.route('**/api/share', async route => {
        duplicateRequests.push(JSON.parse(route.request().postData() || '{}'))
        resolveDuplicate()
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'created-copy', content: '# Project report' }),
        })
    })

    await page.goto(`/s/${shareId}`)
    const fileRow = page.getByRole('link', { name: 'report.md' }).locator('..')
    await fileRow.getByRole('button', { name: 'Duplicate item' }).click()
    await duplicateCreated

    expect(duplicateRequests).toHaveLength(1)
    expect(duplicateRequests[0]).toMatchObject({
        includeTree: false,
        content: '# Project report',
        name: 'report copy.md',
        type: 'file',
    })
    expect(duplicateRequests[0].id).toEqual(expect.any(String))
})

test('duplicating a folder creates the folder before its nested files', async ({ page }) => {
    const duplicateRequests: Record<string, unknown>[] = []
    let resolveDuplicates!: () => void
    const duplicatesCreated = new Promise<void>(resolve => { resolveDuplicates = resolve })

    await page.route(new RegExp(`/api/share/${shareId}$`), route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: shareId, alias: shareId, path: shareId, content: '', owner: '', parent: '' }),
    }))
    await page.route(new RegExp(`/api/share/tree/${shareId}$`), route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
            id: 'tree-actions-folder',
            name: 'docs',
            alias: 'docs',
            parent: null,
            type: 'folder',
            children: [{
                id: fileId,
                name: 'report.md',
                alias: 'report.md',
                parent: 'tree-actions-folder',
                type: 'file',
            }],
        }]),
    }))
    await page.route(new RegExp(`/api/share/${fileId}$`), route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: fileId, content: '# Nested report' }),
    }))
    await page.route('**/api/share', async route => {
        duplicateRequests.push(JSON.parse(route.request().postData() || '{}'))
        if (duplicateRequests.length === 2) resolveDuplicates()
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    })

    await page.goto(`/s/${shareId}`)
    await page.getByRole('button', { name: 'Duplicate item' }).first().click()
    await duplicatesCreated

    expect(duplicateRequests).toHaveLength(2)
    expect(duplicateRequests[0]).toMatchObject({ name: 'docs copy', type: 'folder', content: '' })
    expect(duplicateRequests[1]).toMatchObject({
        name: 'report.md',
        type: 'file',
        parent: duplicateRequests[0].id,
        content: '# Nested report',
    })
})
