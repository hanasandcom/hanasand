import { expect, test } from '@playwright/test'
import { prepareThesisTools } from './helpers/thesisTools'

test.beforeEach(async({ page, context, baseURL }) => {
    test.skip(process.env.THESIS_WORKSPACE_TEST !== '1', 'Requires the disposable thesis API.')
    test.setTimeout(60000)
    await prepareThesisTools(page, context, baseURL)
})

test('active toolbar fits phones and tablets, supports multiline cells, and hides on blur', async({ page }) => {
    const b2 = page.getByRole('textbox', { name: 'Cell B2', exact: true })
    await b2.fill('First line\nSecond line')
    await b2.press('Home')
    await b2.press('ArrowUp')
    await expect(b2).toBeFocused()
    for (const [width, height] of [[390, 844], [768, 1024], [820, 1180], [1024, 768], [1180, 820], [1440, 900]]) {
        await page.setViewportSize({ width, height })
        await b2.focus()
        const tools = page.getByRole('group', { name: 'Active table controls' })
        await expect(tools).toBeVisible()
        const toolbar = page.locator('[aria-label="Document actions"]')
        const bounds = (await toolbar.boundingBox())!
        expect(bounds.x).toBeGreaterThanOrEqual(16)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 16)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        const rows = await toolbar.locator('button').evaluateAll(buttons => buttons.filter(button => button.getBoundingClientRect().height).map(button => Math.round(button.getBoundingClientRect().top)))
        expect(new Set(rows).size).toBe(1)
        await tools.getByRole('button', { name: 'Add column right of B', exact: true }).scrollIntoViewIfNeeded()
        await expect(tools.getByRole('button', { name: 'Add column right of B', exact: true })).toBeInViewport()
    }
    await page.setViewportSize({ width: 820, height: 1180 })
    await page.screenshot({ path: '/tmp/thesis-tools-ipad.png' })
    await b2.press('Escape')
    await expect(page.getByRole('group', { name: 'Active table controls' })).toHaveCount(0)
})

test.describe('touch controls', () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })
    test('mobile movement controls navigate the active table', async({ page }) => {
        await page.getByRole('textbox', { name: 'Cell B2', exact: true }).tap()
        await page.getByRole('button', { name: 'Cell below', exact: true }).tap()
        await expect(page.getByRole('textbox', { name: 'Cell B3', exact: true })).toBeFocused()
        await page.getByRole('button', { name: 'Cell above', exact: true }).tap()
        await expect(page.getByRole('textbox', { name: 'Cell B2', exact: true })).toBeFocused()
        await page.screenshot({ path: '/tmp/thesis-tools-mobile.png' })
    })
})
