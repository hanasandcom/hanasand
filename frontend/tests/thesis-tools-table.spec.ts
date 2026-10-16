import { expect, test } from '@playwright/test'
import { encodeThesisWorkspace, prepareThesisTools, thesisToolsTable } from './helpers/thesisTools'

test.beforeEach(async({ page, context, baseURL }) => {
    test.skip(process.env.THESIS_WORKSPACE_TEST !== '1', 'Requires the disposable thesis API.')
    test.setTimeout(60000)
    await prepareThesisTools(page, context, baseURL)
})

test('table actions follow the selected cell and history help is expandable', async({ page }) => {
    const tools = page.getByRole('group', { name: 'Active table controls' })
    await expect(tools).toHaveCount(0)
    await expect(page.getByText('Write here…', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/Click a cell to edit\. Enter adds a line/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Table help', exact: true })).toHaveCount(0)
    const b2 = page.getByRole('textbox', { name: 'Cell B2', exact: true })
    await b2.click()
    await expect(tools).toContainText('Table 1 · B2')
    await expect(tools.getByRole('button', { name: 'Remove column B', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cell above', exact: true })).toBeHidden()
    await b2.press('ArrowDown')
    await expect(page.getByRole('textbox', { name: 'Cell B3', exact: true })).toBeFocused()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByRole('textbox', { name: 'Cell A3', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('textbox', { name: 'Cell B3', exact: true })).toBeFocused()
    await tools.getByRole('button', { name: 'Add column right of B', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Cell C3', exact: true })).toBeFocused()
    await expect(page.getByRole('textbox', { name: 'Cell D3', exact: true })).toHaveValue('Two')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Cell D3', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Cell D3', exact: true })).toHaveValue('Two')
    await page.getByRole('textbox', { name: 'Cell B2', exact: true }).click()
    await page.getByRole('button', { name: 'Add column left of B', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Cell B2', exact: true })).toHaveValue('')
    await expect(page.getByRole('textbox', { name: 'Cell C2', exact: true })).toHaveValue('1')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await page.getByRole('textbox', { name: 'Cell A2', exact: true }).click()
    await page.getByRole('button', { name: 'Add row above 2', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Cell A2', exact: true })).toHaveValue('')
    await expect(page.getByRole('textbox', { name: 'Cell A3', exact: true })).toHaveValue('First')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await page.getByRole('textbox', { name: 'Cell B2', exact: true }).click({ button: 'right' })
    await expect(page.getByRole('menu', { name: 'Table actions' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Insert column left' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('heading', { name: 'Timetable', exact: true }).click()
    await expect(tools).toHaveCount(0)
    await page.getByRole('button', { name: 'History', exact: true }).click()
    const history = page.getByRole('region', { name: 'Version history' })
    await expect(history.getByRole('heading', { name: 'Previous version', exact: true })).toBeVisible()
    await expect(page.getByText(/A checkpoint is saved/)).toHaveCount(0)
    await history.getByRole('button', { name: 'About version history' }).click()
    await expect(history.getByText(/A checkpoint is saved every 20 minutes/)).toBeVisible()
    await history.getByRole('button', { name: 'About version history' }).click()
    await expect(page.getByText(/A checkpoint is saved/)).toHaveCount(0)
})

test('custom timetable cells select on one click and expose positional insert actions', async({ page, context, baseURL }) => {
    const current = await (await context.request.get(baseURL + '/api/thesis')).json()
    const timetable = '| Week | Research | Total |\n| --- | --- | --- |\n| 2026-W28 | 2 | 2 |\n| 2026-W29 |  |  |\n'
    const body = encodeThesisWorkspace([
        { id: 'Timetable', name: 'Timetable', title: '# Timetable', body: timetable },
        { id: 'Plan', name: 'Plan', title: '# Plan', body: thesisToolsTable },
    ])
    expect((await context.request.put(baseURL + '/api/thesis', {
        headers: { Origin: baseURL! },
        data: { ...current, body },
    })).ok()).toBe(true)
    await page.goto('/thesis?sheet=Timetable')
    await expect(page.getByRole('tab', { name: 'Timetable', exact: true })).toBeEnabled()
    const cell = page.locator('.thesis-timetable tbody tr[data-week="2026-W28"] td').first()
    await cell.click()
    await expect(page.getByRole('group', { name: 'Active table controls' })).toContainText(/Table 1 · B\d+/)
    await expect(page.getByRole('button', { name: /^Add row above/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add column left of B' })).toBeVisible()
    await page.getByRole('button', { name: 'Add row above 2', exact: true }).click()
    await expect(page.locator('.thesis-timetable tbody tr[data-week="2026-W27"]')).toBeVisible()
    const originalWeek = page.locator('.thesis-timetable tbody tr[data-week="2026-W28"] td').first()
    await originalWeek.click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Insert column right' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Insert column right' }).click()
    await expect(page.locator('.thesis-timetable thead')).toContainText('Category')
})

test('vertical navigation centers cells in a large table', async({ page, context, baseURL }) => {
    const current = await (await context.request.get(baseURL + '/api/thesis')).json()
    const body = '| Task | Hours | Notes |\n| --- | --- | --- |\n' + Array.from({ length: 60 }, (_, index) => `| Task ${index + 1} | ${index + 1} | Notes |`).join('\n')
    expect((await context.request.put(baseURL + '/api/thesis', {
        headers: { Origin: baseURL! },
        data: { ...current, body },
    })).ok()).toBe(true)
    await page.reload()
    const b20 = page.getByRole('textbox', { name: 'Cell B20', exact: true })
    await b20.click()
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp']) {
        await page.keyboard.press(key)
        await expect.poll(async() => page.locator('[data-table-cell]:focus').evaluate(element => {
            const bounds = element.getBoundingClientRect()
            const viewport = element.closest('.enterprise-theme')!
            const frame = viewport.getBoundingClientRect()
            return Math.abs(bounds.top + bounds.height / 2 - (frame.top + viewport.clientHeight / 2))
        })).toBeLessThan(3)
    }
    await expect(page.getByRole('textbox', { name: 'Cell B21', exact: true })).toBeFocused()
})
