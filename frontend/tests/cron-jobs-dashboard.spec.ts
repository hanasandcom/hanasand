import { expect, test } from '@playwright/test'
import { fixtureJobs } from './fixtures/cron-jobs-dashboard'
import { setupRenderProofSession } from './helpers/renderProofSession'

test('cron jobs dashboard renders unified scheduled operations and controls', async ({ context, page, baseURL }) => {
    await setupRenderProofSession(context, baseURL)

    const updates: unknown[] = []
    let emptyInventory = false
    await page.route('**/api/backend/system/cron**', async route => {
        if (route.request().method() === 'GET') {
            await route.fulfill({ json: { jobs: emptyInventory ? [] : fixtureJobs, ready: true } })
            return
        }
        await route.fallback()
    })
    await page.route('**/api/backend/system/cron/ti-public-canary-collection**', async route => {
        const body = await route.request().postDataJSON()
        updates.push(body)
        const nextJob = body.action === 'run_now'
            ? { ...fixtureJobs[0], running: true, status: 'running' }
            : { ...fixtureJobs[0], enabled: false, status: 'paused' }
        await route.fulfill({ json: { job: nextJob, jobs: [nextJob, ...fixtureJobs.slice(1)] } })
    })
    await page.route('**/api/backend/system/cron/ti-source-pack-worker**', async route => {
        updates.push(await route.request().postDataJSON())
        const sourcePack = fixtureJobs.find(job => job.id === 'ti-source-pack-worker')!
        const nextSourcePack = { ...sourcePack, status: 'running', running: true }
        await route.fulfill({ json: { job: nextSourcePack, jobs: fixtureJobs.map(job => job.id === 'ti-source-pack-worker' ? nextSourcePack : job) } })
    })
    await page.route('**/api/backend/system/cron/forgejo-standby-sync**', async route => {
        const body = await route.request().postDataJSON()
        updates.push(body)
        const forgejo = fixtureJobs.find(job => job.id === 'forgejo-standby-sync')!
        const nextForgejo = { ...forgejo, schedule: typeof body.schedule === 'string' ? body.schedule : forgejo.schedule }
        await route.fulfill({ json: { job: nextForgejo, jobs: fixtureJobs.map(job => job.id === 'forgejo-standby-sync' ? nextForgejo : job) } })
    })

    await page.goto('/automation/cron', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Cron jobs' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'All scheduled jobs operating normally' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Next safe action' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Public TI collection loop' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Exposure parser bridge' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'DWM source-pack worker' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'DWM alert generation readiness' })).toBeVisible()
    await expect(page.getByText(/Last success/).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'DWM exposure queue collection' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Forgejo standby sync' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Alerts' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Compact density' })).toBeVisible()
    await expect(page.getByText('Audit only').first()).toBeVisible()
    await expect(page.getByText('Schedule controls')).toBeVisible()
    await expect(page.getByLabel('Cron expression')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Save Forgejo standby sync schedule' })).toBeHidden()
    await expect(page.getByText('$0.09/day').first()).toBeVisible()
    await page.getByRole('button', { name: 'Compact density' }).click()
    await expect(page.getByText('Every 5 minutes').first()).toBeHidden()

    await page.getByText('Runtime, audit, and log details').first().click()
    await expect(page.getByText('$0.0037/hr').first()).toBeVisible()
    await expect(page.getByText('test · ti-scraper').first()).toBeVisible()
    await expect(page.getByText('ok').first()).toBeVisible()

    await page.getByText('Schedule controls').click()
    await expect(page.getByLabel('Cron expression')).toBeVisible()
    await page.getByLabel('Cron expression').fill('*/10 * * * *')
    await page.getByRole('button', { name: 'Save Forgejo standby sync schedule' }).click()
    await expect.poll(() => updates.length).toBe(1)
    expect(updates[0]).toMatchObject({ schedule: '*/10 * * * *' })

    await page.getByRole('button', { name: 'Pause' }).first().click()
    await expect.poll(() => updates.length).toBe(2)
    expect(updates[1]).toMatchObject({ enabled: false })

    await page.getByRole('button', { name: 'Run now' }).first().click()
    await expect.poll(() => updates.length).toBe(3)
    expect(updates[2]).toMatchObject({ action: 'run_now' })
    await expect(page.locator('span').filter({ hasText: /^running$/ })).toBeVisible()

    const sourcePackCard = page.locator('#job-ti-source-pack-worker')
    await expect(sourcePackCard.getByText('Run now supported').first()).toBeVisible()
    await expect(sourcePackCard.getByText('Audit only')).toBeHidden()
    await sourcePackCard.getByRole('button', { name: 'Run now' }).click()
    await expect.poll(() => updates.length).toBe(4)
    expect(updates[3]).toMatchObject({ action: 'run_now' })

    emptyInventory = true
    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect(page.getByRole('heading', { name: 'No scheduled jobs available' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveText('No scheduled jobs are currently available.')
    await expect(page.getByText('DWM source-pack worker started.', { exact: true })).toHaveCount(0)

    emptyInventory = false
    await page.getByRole('button', { name: 'Refresh' }).click()
    await page.getByText('Schedule controls').click()
    await expect(page.getByLabel('Cron expression')).toHaveValue('*/5 * * * *')
})
