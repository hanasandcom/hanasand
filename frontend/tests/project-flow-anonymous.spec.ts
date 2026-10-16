import { expect, test } from '@playwright/test'
import { isShareCreateUrl, shareCreateUrl } from './project-flow-helpers'

test.describe.configure({ mode: 'serial' })

test('logged-out users get an editor workspace without action buttons', async ({ page }) => {
    let createdShareBody = ''
    let createdShareId = ''

    await page.route(shareCreateUrl, async route => {
        createdShareBody = route.request().postData() || ''
        createdShareId = JSON.parse(createdShareBody).id as string
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: createdShareId,
                alias: `project-${createdShareId}`,
                path: `project-${createdShareId}`,
                content: '',
                tree: [],
            }),
        })
    })

    const shareResponse = page.waitForResponse(response => isShareCreateUrl(response.url()))
    await page.goto('/s')
    await shareResponse

    await expect(page).toHaveURL(new RegExp(`/s/${createdShareId}(?:\\?new=1)?$`))
    await expect(page.getByText('Opening workspace')).toHaveCount(0)
    await expect(page.getByText('Creating project workspace')).toHaveCount(0)
    await expect(page.locator('main textarea').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create project' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    await expect(page.locator('ul', { hasText: createdShareId })).toHaveCount(0)
    expect(createdShareBody).toContain(`"name":"${createdShareId}"`)
})
