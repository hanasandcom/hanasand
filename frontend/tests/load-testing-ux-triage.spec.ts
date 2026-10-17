import { expect, test } from '@playwright/test'
import { setupRenderProofSession } from './helpers/renderProofSession'
test('load testing dashboard renders one primary launch flow and switchable history', async ({ context, page, baseURL }) => {
    await setupRenderProofSession(context, baseURL)

    const startedChecks: unknown[] = []
    await page.route('**/api/tests/mine**', async route => {
        await route.fulfill({ json: [fixtureMineCheck] })
    })
    await page.route('**/api/tests/recent**', async route => {
        await route.fulfill({ json: [fixtureGlobalCheck] })
    })
    await page.route('**/api/test', async route => {
        startedChecks.push(await route.request().postDataJSON())
        await route.fulfill({ json: { ...fixtureMineCheck, id: 'new-check-123' } })
    })

    await page.goto('/load-testing', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Load testing and endpoint evidence' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Check an endpoint you control' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Operations snapshot' })).toBeVisible()
    await expect(page.getByText('1 running').first()).toBeVisible()
    await expect(page.getByText('1280ms').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/test/global-check-1')
    await expect(page.getByText('Run allowance')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start check' })).toBeDisabled()
    await expect(page.getByText('I own this endpoint or have written permission to test it.')).toBeVisible()
    await expect(page.getByText('Ramp: Capacity smoke test')).toBeHidden()
    await expect(page.getByText('Starter')).toBeHidden()
    await expect(page.getByText('https://api.example.com/healthz')).toBeVisible()
    await expect(page.getByText('https://status.example.net/ping')).toBeHidden()
    await expect(page.getByText('Allowed target')).toBeHidden()

    await page.getByRole('button', { name: 'Global' }).click()
    await expect(page.getByText('https://status.example.net/ping')).toBeVisible()
    await expect(page.getByText('https://api.example.com/healthz')).toBeHidden()

    await page.getByText('Scenario settings').click()
    await page.getByRole('button', { name: /Ramp/ }).click()
    await expect(page.getByText('Ramp: Capacity smoke test')).toBeVisible()

    await page.getByPlaceholder('https://api.example.com/health').fill('https://api.example.com/ready')
    await expect(page.getByRole('button', { name: 'Start check' })).toBeDisabled()
    await page.getByLabel('I own this endpoint or have written permission to test it.').check()
    await page.getByRole('button', { name: 'Start check' }).click()
    await expect.poll(() => startedChecks.length).toBe(1)
    expect(startedChecks[0]).toMatchObject({
        url: 'https://api.example.com/ready',
        timeout: 45000,
        stages: [
            { duration: '30s', target: 5 },
            { duration: '1m', target: 20 },
            { duration: '30s', target: 0 },
        ],
    })
    await expect(page).toHaveURL(/\/test\/new-check-123$/)
})

const fixtureMineCheck = {
    id: 'mine-check-1',
    url: 'https://api.example.com/healthz',
    status: 'done',
    visits: 3,
    created_at: '2026-07-03T09:00:00.000Z',
    latest_run_summary: {
        requests: 120,
        duration: { p95: 184 },
        failureRate: 0,
    },
    summary: null,
    p95_delta_ms: 12,
}

const fixtureGlobalCheck = {
    id: 'global-check-1',
    url: 'https://status.example.net/ping',
    status: 'running',
    visits: 7,
    created_at: '2026-07-03T09:02:00.000Z',
    latest_run_summary: {
        requests: 80,
        duration: { p95: 1280 },
        failureRate: 0.02,
    },
    summary: null,
    p95_delta_ms: -96,
}
