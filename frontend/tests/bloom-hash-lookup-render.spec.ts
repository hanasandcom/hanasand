import { expect, test } from '@playwright/test'
import { compactBundleFixture, compactRangeFixture } from './fixtures/compact-range'

for (const signedIn of [false, true]) {
    test(`hash lookup uses the shared navigation when ${signedIn ? 'signed in' : 'signed out'}`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        if (signedIn) {
            await page.context().addCookies([
                { name: 'access_token', value: 'navigation-render-test', url: baseURL! },
                { name: 'id', value: 'navigation-render-test', url: baseURL! },
            ])
            await page.route('**/api/organizations', route => route.fulfill({ json: { organizations: [] } }))
        }
        await page.goto('/pwned')
        const header = page.locator('[data-site-header]')
        await expect(header).toBeVisible()
        for (const name of ['Product', 'Developers', 'Resources']) {
            await expect(header.getByRole('button', { name, exact: true })).toBeVisible()
        }
        await expect(header.getByRole('link', { name: 'API docs', exact: true })).toHaveCount(0)
        await header.getByRole('button', { name: 'Resources', exact: true }).hover()
        await expect(header.getByRole('link', { name: /Check Password/ })).toBeVisible()
        if (signedIn) {
            await header.getByLabel('Account and workspace').click()
            await expect(header.getByRole('combobox', { name: 'Org', exact: true })).toBeVisible()
            await expect(header.getByRole('link', { name: 'Sign out' })).toHaveAttribute('href', '/logout')
        }
    })
}

test('password hash check does not collect a raw password', async ({ page }) => {
    let count = 23
    await page.route('**/api/pwned', async (route) => {
        const body = route.request().postDataJSON() as { prefix?: string }
        expect(body).toEqual({ prefix: '5BAA6' })

        await route.fulfill({
            status: 200,
            contentType: 'application/vnd.hanasand.pwned-prefix',
            body: compactRangeFixture(count),
        })
    })

    await page.goto('/pwned')

    await expect(page).toHaveTitle(/Check Password \| Hanasand/)
    await expect(page.getByRole('heading', { name: 'Has your password been leaked?' })).toBeVisible()
    await expect(page.getByText('Check password', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(page.getByText('Check Password', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expect(page.getByText('Hash your password and check it.').filter({ visible: true })).toBeVisible()
    await expect(page.getByText('Only the first five characters are sent so no one can recreate your password.').filter({ visible: true })).toBeVisible()
    await expect(page.getByText('printf %s \'superman123\' | shasum').filter({ visible: true })).toBeVisible()
    await expect(page.getByText('Exact matches only.', { exact: false })).toHaveCount(0)

    const command = page.getByRole('region', { name: 'Create a hash locally' })
    const formBox = await page.getByRole('button', { name: 'Check', exact: true }).boundingBox()
    const commandBox = await command.boundingBox()
    expect(commandBox!.y).toBeGreaterThan(formBox!.y + formBox!.height)

    await page.getByLabel('SHA-1 hash').filter({ visible: true }).fill('5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8')
    await page.getByRole('button', { name: 'Check', exact: true }).click()

    await expect(page.getByText('Match found', { exact: true })).toBeVisible()
    await expect(page.getByText('Exact match found', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Result', { exact: true })).toBeVisible()
    await expect(page.getByText('This hash appears in the leaked-password records.')).toBeVisible()
    await expect(page.getByText('This password has been breached 23 times.')).toBeVisible()
    await expect(page.getByText('Found in 2 files')).toBeVisible()
    await expect(page.getByText('one.txt', { exact: true })).toBeVisible()
    await expect(page.getByText('two.txt', { exact: true })).toBeVisible()
    await expect(page.getByText(/^Lines 12–33$/)).toBeVisible()
    await expect(page.getByText(/^Line 12,010,103,436$/)).toBeVisible()
    await expect(page.getByText(/^\d+ matches? ·/)).toHaveCount(0)
    await expect(page.getByText(/12,010,103,436/)).toBeVisible()
    await expect(page.getByText(/Privacy check:|Next action:|Rotate the underlying secret/)).toHaveCount(0)
    await expect(command).toHaveCount(0)

    await page.getByRole('button', { name: 'Check another hash' }).click()
    await expect(command).toBeVisible()
    await expect(page.getByLabel('SHA-1 hash').filter({ visible: true })).toHaveValue('')
    count = 0
    await page.getByLabel('SHA-1 hash').filter({ visible: true }).fill('5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8')
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await expect(page.getByText('No exact match found', { exact: true })).toBeVisible()
    await expect(command).toHaveCount(0)
    await expect(page.getByText(/This password has been breached|Privacy check:|Next action:/)).toHaveCount(0)
})

test('local hash command is distinct and copyable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: async (value: string) => { document.documentElement.dataset.copiedCommand = value } },
        })
    })
    await page.goto('/pwned')

    const command = page.getByRole('region', { name: 'Create a hash locally' })
    await command.getByRole('button', { name: 'Copy code' }).click()
    await expect(command.getByRole('button', { name: 'Copy code' })).toHaveText('Copied')
    await expect(page.locator('html')).toHaveAttribute('data-copied-command', 'printf %s \'superman123\' | shasum')
    const colors = await command.evaluate(element => ({
        panel: getComputedStyle(element).backgroundColor,
        code: getComputedStyle(element.querySelector('pre')!).backgroundColor,
        text: getComputedStyle(element.querySelector('pre')!).color,
        fits: element.scrollWidth <= element.clientWidth,
    }))
    expect(colors.code).not.toBe(colors.panel)
    expect(colors.text).not.toBe('rgb(0, 0, 0)')
    expect(colors.text).not.toBe(colors.code)
    expect(colors.fits).toBe(true)
})

test('hash lookup combines master and overlay provenance locally', async ({ page }) => {
    let requests = 0
    await page.route('**/api/pwned', async route => {
        expect(route.request().postDataJSON()).toEqual({ prefix: '5BAA6' })
        requests++
        await route.fulfill({ contentType: 'application/vnd.hanasand.pwned-prefix', body: compactBundleFixture() })
    })
    await page.goto('/pwned')
    await page.getByLabel('SHA-1 hash').filter({ visible: true }).fill('5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8')
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await expect(page.getByText('This password has been breached 6 times.')).toBeVisible()
    await expect(page.getByText('Found in 4 files')).toBeVisible()
    for (const file of ['one.txt', 'two.txt', 'three.txt', 'four.txt']) {
        await expect(page.getByText(file, { exact: true })).toBeVisible()
    }
    await expect(page.getByText(/12,010,103,436/)).toHaveCount(2)
    expect(requests).toBe(1)
})
