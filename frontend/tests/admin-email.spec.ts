import { test, expect } from '@playwright/test'
import { registerFixtureBundle } from './fixtureBundle'
const fixture = registerFixtureBundle({
    entrypoint: 'tests/fixtures/admin-email.tsx',
    directoryPrefix: 'admin-email-test-',
    define: 'process.env={"NODE_ENV":"production"}',
    executableEnvironment: 'BUN_BIN'
})
test('organization profiles preserve email visibility and user search', async ({ page }) => {
    await page.route('http://email.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: fixture.bundle }))
    await page.route('http://email.test/', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/fixture.js"></script>' }))
    await page.goto('http://email.test/')
    await expect(page.getByTestId('admin-profile')).toContainText('Email: support@example.com')
    await expect(page.getByTestId('organization-profile')).not.toContainText('Email:')
    await page.getByRole('button', { name: 'Search users (Cmd J)' }).click()
    const search = page.getByRole('textbox', { name: 'Filter users' })
    await expect(search).toHaveAttribute('placeholder', 'Name, username or email')
    await search.fill('SUPPORT@EXAMPLE.COM')
    await expect(page.getByText('1 shown', { exact: true })).toBeVisible()
    await expect(page.getByTestId('user-list').getByRole('heading', { name: 'Member One', exact: true })).toBeVisible()
    await expect(page.getByTestId('user-list').getByRole('heading', { name: 'Other Member', exact: true })).toHaveCount(0)
    await search.fill('second')
    await expect(page.getByText('1 shown', { exact: true })).toBeVisible()
    await expect(page.getByTestId('user-list').getByRole('heading', { name: 'Other Member', exact: true })).toBeVisible()
    await search.fill('no-match@example.com')
    await expect(page.getByText('0 shown', { exact: true })).toBeVisible()
    await search.press('Escape')
    await expect(page.getByText('2 shown', { exact: true })).toBeVisible()
})

test('organization profile copy feedback reflects clipboard fallback success and failure', async ({ page }) => {
    await page.route('http://email.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: fixture.bundle }))
    await page.route('http://email.test/', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/fixture.js"></script>' }))
    await page.goto('http://email.test/')
    const profile = page.getByTestId('organization-profile')

    await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard unavailable') } } })
        document.execCommand = () => true
    })
    await profile.getByRole('button', { name: 'Copy profile link' }).click()
    await expect(profile.getByRole('button', { name: 'Link copied' })).toBeVisible()
    await expect(profile.getByRole('status')).toHaveText('Profile link copied to clipboard.')

    await page.evaluate(() => { document.execCommand = () => false })
    await profile.getByRole('button', { name: 'Link copied' }).click()
    await expect(profile.getByRole('alert')).toHaveText('Couldn’t copy the link. You can copy the profile address above.')
    await expect(profile.getByRole('button', { name: 'Copy profile link' })).toBeVisible()
})
