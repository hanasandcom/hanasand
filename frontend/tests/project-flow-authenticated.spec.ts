import { expect, test } from '@playwright/test'
import { isShareCreateUrl, shareCreateUrl } from './project-flow-helpers'

test.describe.configure({ mode: 'serial' })

test('the /s entry automatically opens a saved workspace', async ({ page, context, baseURL }) => {
    const cookieUrl = baseURL || 'http://127.0.0.1:3000'
    let createdShareBody = ''
    let createdShareId = ''

    await context.addCookies([
        { name: 'access_token', value: encodeURIComponent('playwright-token'), url: cookieUrl },
        { name: 'id', value: 'playwright-user', url: cookieUrl },
    ])

    await page.route(shareCreateUrl, async route => {
        createdShareBody = route.request().postData() || ''
        createdShareId = JSON.parse(createdShareBody).id as string
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: createdShareId,
                alias: 'Playwright Share',
                path: 'Playwright Share',
                content: '',
                tree: [],
            }),
        })
    })
    const shareResponse = page.waitForResponse(response => isShareCreateUrl(response.url()))
    await page.goto('/s')
    await expect(page.getByRole('button', { name: 'Create share' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create project' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    await expect(page.getByText('Share flow')).toHaveCount(0)
    await expect(page.getByText('Project flow')).toHaveCount(0)

    await shareResponse
    await expect(page).toHaveURL(new RegExp(`/s/${createdShareId}(?:\\?new=1)?$`))
    await expect(page.locator('main textarea').first()).toBeVisible()
    expect(createdShareBody).toContain('"includeTree":true')
    expect(createdShareBody).toContain('"type":"folder"')
    expect(createdShareBody).toContain(`"name":"${createdShareId}"`)
})
