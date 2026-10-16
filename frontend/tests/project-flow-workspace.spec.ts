import { expect, test } from '@playwright/test'
import { openShareMetadata, shareCreateUrl } from './project-flow-helpers'

test.describe.configure({ mode: 'serial' })

test('new files stay inside the existing project root', async ({ page }) => {
    const shareId = 'pwshare-project'
    const rootId = 'project-root-from-api'
    const createdPaths: string[] = []

    await page.route(new RegExp(`/api/share/${shareId}$`), async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: 'mayapple-snake-vamo',
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
        })
    })

    await page.route(new RegExp(`/api/share/tree/${shareId}$`), async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                {
                    id: rootId,
                    name: 'project-QHNVEX',
                    alias: 'project-QHNVEX',
                    parent: null,
                    type: 'folder',
                    children: [],
                },
            ]),
        })
    })

    await page.route(shareCreateUrl, async route => {
        const body = JSON.parse(route.request().postData() || '{}')
        createdPaths.push(`${body.parent}:${body.name}`)
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id,
                alias: body.name,
                path: body.name,
                content: '',
                tree: [
                    {
                        id: rootId,
                        name: 'project-QHNVEX',
                        alias: 'project-QHNVEX',
                        parent: null,
                        type: 'folder',
                        children: [{
                            id: body.id,
                            name: body.name,
                            alias: body.name,
                            parent: rootId,
                            type: 'file',
                        }],
                    },
                ],
            }),
        })
    })

    await page.goto(`/s/${shareId}`)
    await expect(page.getByText('project-QHNVEX').first()).toBeVisible()
    await expect(page.getByRole('link', { name: shareId })).toBeVisible()
    await page.getByRole('button', { name: 'Create file', exact: true }).click()
    const fileNameInput = page.getByRole('textbox', { name: 'New file name' })
    await fileNameInput.fill('ab')
    await fileNameInput.press('Enter')

    await expect(page.getByRole('link', { name: 'ab' })).toBeVisible()
    await expect(page.getByText('project-QHNVEX').first()).toBeVisible()
    expect(createdPaths).toContain(`${rootId}:ab`)
})

test('phone simulator opens and checks Expo through the share VM', async ({ page }) => {
    const shareId = 'pwshare-phone'

    await page.route(`**/api/share/request/${shareId}*`, async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                status: 200,
                ok: true,
                body: 'packager-status:running',
            }),
        })
    })

    await page.goto(`/s/${shareId}`)
    await openShareMetadata(page)
    await expect(page.getByRole('button', { name: 'Phone simulator' })).toBeVisible()
    await page.getByRole('button', { name: 'Phone simulator' }).click()

    await expect(page.getByText('Expo phone')).toBeVisible()
    await page.getByRole('button', { name: 'Check' }).click()
    await expect(page.getByText('Metro online')).toBeVisible()
    await expect(page.getByText('Expo Metro is running from this project VM.')).toBeVisible()
})

test('metadata reload keeps the current share id instead of opening a random workspace', async ({ page }) => {
    const shareId = 'pwshare-metadata'

    await page.route(new RegExp(`/api/share/${shareId}$`), async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: 'Playwright Share',
                path: `share-${shareId}`,
                content: '',
                wordCount: 1,
                estimatedMinutes: 1,
            }),
        })
    })

    await page.route(new RegExp(`/api/share/tree/${shareId}$`), async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                {
                    id: shareId,
                    alias: 'Playwright Share',
                    path: `share-${shareId}`,
                    content: '',
                    type: 'folder',
                    name: `share-${shareId}`,
                    children: [],
                },
            ]),
        })
    })

    await page.goto(`/s/${shareId}`)
    await openShareMetadata(page)
    await page.getByRole('link', { name: 'Reload current share workspace' }).click()

    await expect(page).toHaveURL(new RegExp(`/s/${shareId}$`))
    await expect(page.getByRole('link', { name: 'Reload current share workspace' })).toHaveAttribute('href', `/s/${shareId}`)
})
