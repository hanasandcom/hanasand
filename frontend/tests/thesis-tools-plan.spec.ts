import { expect, test } from '@playwright/test'
import { prepareThesisTools } from './helpers/thesisTools'

test.beforeEach(async({ page, context, baseURL }) => {
    test.skip(process.env.THESIS_WORKSPACE_TEST !== '1', 'Requires the disposable thesis API.')
    test.setTimeout(60000)
    await prepareThesisTools(page, context, baseURL)
})

test('Plan supports estimates, sprint filtering, kanban statuses, expandable details and subgoals', async({ page }) => {
    await page.getByRole('tab', { name: 'Plan', exact: true }).click()
    await expect(page.locator('[aria-label="Plan summary"]')).toContainText('3 h')
    await page.getByRole('button', { name: 'Board', exact: true }).click()
    await expect(page.locator('[aria-label="Kanban board"]')).toBeVisible()
    await page.getByRole('combobox', { name: 'Status for First' }).selectOption('In progress')
    await expect(page.locator('[aria-label="Plan summary"]')).toContainText('In progress')
    await page.getByRole('textbox', { name: 'Sprint for First' }).fill('Sprint 1')
    await page.getByRole('combobox', { name: 'Filter by sprint' }).selectOption('Sprint 1')
    await expect(page.getByRole('combobox', { name: 'Status for Second' })).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Filter by sprint' }).selectOption('')
    await page.getByRole('combobox', { name: 'Status for Second' }).selectOption('Completed')
    await expect(page.locator('[aria-label="Plan summary"]')).toContainText('2 h')
    await page.getByRole('button', { name: 'Details and subgoals' }).first().click()
    const subgoals = page.getByRole('textbox', { name: 'Subgoals for First' })
    await subgoals.fill('- [ ] Draft section\n- [x] Gather sources')
    await expect(subgoals).toHaveValue('- [ ] Draft section\n- [x] Gather sources')
})
