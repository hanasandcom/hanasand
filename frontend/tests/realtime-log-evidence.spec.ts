import { test, expect } from '@playwright/test'
import { event, openLogs, result } from './fixtures/logs-browser'

test('event text remains selectable and copies full evidence without navigating', async ({ page }) => {
    await page.route('**/api/backend/logs/search?*', route => route.fulfill({ json: result() }))
    await openLogs(page)
    const row = page.locator('article').filter({ hasText: 'whoami' })
    await expect(row).toContainText('Original level: info')
    await expect(row).toContainText('high')
    const text = row.locator('pre').first()
    expect(await text.evaluate(element => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const selection = window.getSelection()!
        selection.removeAllRanges()
        selection.addRange(range)
        return { selected: selection.toString(), userSelect: getComputedStyle(element).userSelect, insideButton: !!element.closest('button') }
    })).toEqual({ selected: 'whoami', userSelect: 'text', insideButton: false })
    await row.getByRole('button', { expanded: false }).click()
    await expect(row).toContainText('Event checked 105 enabled rules.')
    await row.getByRole('button', { name: 'Copy event JSON' }).click()
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('copied-event')!))).toEqual(event().normalized)
    await expect(page).toHaveURL('http://logs.test/logs/realtime')
    await row.getByRole('button', { expanded: true }).click()
    await expect(row).not.toContainText('Full event and detection evidence')
})
