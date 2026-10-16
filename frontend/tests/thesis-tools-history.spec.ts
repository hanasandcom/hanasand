import { expect, test } from '@playwright/test'
import { prepareThesisTools } from './helpers/thesisTools'

test.beforeEach(async({ page, context, baseURL }) => {
    test.skip(process.env.THESIS_WORKSPACE_TEST !== '1', 'Requires the disposable thesis API.')
    test.setTimeout(60000)
    await prepareThesisTools(page, context, baseURL)
})

test('undo survives a pending save, redo saves again, and a new edit clears redo', async({ page, context, baseURL }) => {
    const initial = await (await context.request.get(baseURL + '/api/thesis')).json()
    let release!: () => void, started!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const requestStarted = new Promise<void>(resolve => { started = resolve })
    let held = false
    await page.route('**/api/thesis', async route => {
        if (route.request().method() === 'PUT' && !held) { held = true; started(); await gate }
        await route.continue()
    })
    try {
        const b2 = page.getByRole('textbox', { name: 'Cell B2', exact: true })
        await b2.fill('10')
        await requestStarted
        await b2.press('ControlOrMeta+z')
        await expect(b2).toHaveValue('1')
        expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('hanasand-thesis-recovery:')).map(key => JSON.parse(localStorage.getItem(key)!).body))).toContain(initial.body)
        release()
        await expect.poll(async() => (await (await context.request.get(baseURL + '/api/thesis')).json()).revision, { timeout: 18000 }).toBeGreaterThanOrEqual(initial.revision + 2)
        await expect(b2).toHaveValue('1')
        await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled()
        await b2.press('ControlOrMeta+Shift+z')
        await expect(b2).toHaveValue('10')
        await expect.poll(async() => (await (await context.request.get(baseURL + '/api/thesis')).json()).body, { timeout: 12000 }).toContain('| First | 10 |')
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await b2.fill('7')
        await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled()
        await expect.poll(async() => (await (await context.request.get(baseURL + '/api/thesis')).json()).body, { timeout: 12000 }).toContain('| First | 7 |')
        await page.reload()
        await expect(b2).toHaveValue('7')
    } finally { release() }
})

test('remote conflicts disable undo until resolved and reset obsolete edit history', async({ page, context, baseURL }) => {
    const b2 = page.getByRole('textbox', { name: 'Cell B2', exact: true })
    await b2.fill('10')
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled()
    const current = await (await context.request.get(baseURL + '/api/thesis')).json()
    expect((await context.request.put(baseURL + '/api/thesis', {
        headers: { Origin: baseURL! },
        data: { ...current, body: current.body.replace('| First | 1 |', '| First | 9 |') },
    })).ok()).toBe(true)
    await expect(page.getByRole('button', { name: 'Use latest version' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Use latest version' }).click()
    await expect(b2).toHaveValue('9')
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled()
})

test('arrows create temporary edges, clean up empty cells, and save entered text', async({ page, context, baseURL }) => {
    const cell = (name: string) => page.getByRole('textbox', { name: `Cell ${name}`, exact: true })
    const count = () => page.locator('[data-table-cell]').count()
    const saved = await (await context.request.get(baseURL + '/api/thesis')).json()
    for (const [start, key, next, back] of [['B3', 'ArrowDown', 'B4', 'ArrowUp'], ['B1', 'ArrowUp', 'B1', 'ArrowDown'], ['A2', 'ArrowLeft', 'A2', 'ArrowRight'], ['C2', 'ArrowRight', 'D2', 'ArrowLeft']]) {
        await cell(start).focus()
        if (key === 'ArrowLeft' || key === 'ArrowUp') await page.keyboard.press('Home')
        else await page.keyboard.press('End')
        await page.keyboard.press(key)
        await expect(cell(next)).toBeFocused()
        await expect.poll(count).toBe(12)
        await page.keyboard.press(back)
        await expect.poll(count).toBe(9)
    }
    await cell('B3').focus()
    for (let n = 0; n < 20; n++) {
        await page.keyboard.press('ArrowDown')
        await expect(cell('B4')).toBeFocused()
        await expect.poll(count).toBe(12)
    }
    await page.getByRole('separator', { name: 'Resize row 4', exact: true }).press('ArrowDown')
    await page.getByRole('heading', { name: 'Timetable', exact: true }).click()
    await expect.poll(count).toBe(9)
    expect((await (await context.request.get(baseURL + '/api/thesis')).json()).body).toBe(saved.body)
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
    await cell('B3').focus()
    await page.keyboard.press('ArrowDown')
    await cell('B4').fill('New text')
    await page.keyboard.press('ArrowUp')
    await expect.poll(count).toBe(12)
    await expect.poll(async() => (await (await context.request.get(baseURL + '/api/thesis')).json()).body, { timeout: 15000 }).toContain('New text')
    await page.reload()
    await expect(cell('B4')).toHaveValue('New text')
})

test('Shift+Enter moves down and creates the same temporary edge as arrow navigation', async({ page }) => {
    const cell = (name: string) => page.getByRole('textbox', { name: `Cell ${name}`, exact: true })
    await cell('B2').fill('First line\nSecond line')
    await cell('B2').press('ControlOrMeta+a')
    await page.keyboard.press('Shift+Enter')
    await expect(cell('B3')).toBeFocused()
    await expect(cell('B2')).toHaveValue('First line\nSecond line')
    await page.keyboard.press('Shift+Enter')
    await expect(cell('B4')).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(cell('B3')).toBeFocused()
    await expect(cell('B4')).toHaveCount(0)
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await expect(cell('B3')).toHaveValue('2\n')
})

test('cell typing preserves spaces, pasted characters and literal equals text after saving', async({ page, context, baseURL }) => {
    const cell = (name: string) => page.getByRole('textbox', { name: `Cell ${name}`, exact: true })
    const initial = await (await context.request.get(baseURL + '/api/thesis')).json()
    await cell('B2').fill('')
    await cell('B2').pressSequentially('  hello  world  ')
    await expect(cell('B2')).toHaveValue('  hello  world  ')
    const pasted = '\t first | \\ & <br> &#32; **bold** æøå 中文 👩🏽‍💻\n\nlast  '
    await cell('B3').fill(pasted)
    await cell('C2').fill('= ordinary text + 2')
    await cell('B2').focus()
    await expect(cell('C2')).toHaveValue('= ordinary text + 2')
    await expect.poll(async() => (await (await context.request.get(baseURL + '/api/thesis')).json()).revision, { timeout: 15000 }).toBeGreaterThan(initial.revision)
    await page.reload()
    await expect(cell('B2')).toHaveValue('  hello  world  ')
    await expect(cell('B3')).toHaveValue(pasted)
    await expect(cell('C2')).toHaveValue('= ordinary text + 2')
})
