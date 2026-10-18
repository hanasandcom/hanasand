import { expect, test } from '@playwright/test'
import { registerFixtureBundle } from './fixtureBundle'

const fixture = registerFixtureBundle({
    entrypoint: 'tests/fixtures/vm-access.tsx',
    directoryPrefix: 'vm-access-test-',
    define: 'process.env.NODE_ENV="production"'
})
test.beforeEach(async ({ page }) => {
    await page.clock.install()
    await page.route('http://vm-access.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: fixture.bundle }))
    await page.route('http://vm-access.test/', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<div id="root"></div><script src="/fixture.js"></script>' }))
})
const connection = (name = 'first-vm', ip = '192.0.2.10') => ({ vmName: name, username: 'ubuntu', vmIp: ip, sshCommand: `ssh ubuntu@${ip}`, certificateCount: 2, certificates: [] })

test('seeded access waits 30 seconds before refreshing', async ({ page }) => {
    let requests = 0
    await page.route('**/api/backend/vm/first-vm/connection', route => {
        requests++
        return route.fulfill({ json: connection('first-vm', '192.0.2.20') })
    })
    await page.goto('http://vm-access.test/?seeded')
    await expect(page.getByText('ssh ubuntu@192.0.2.10', { exact: true })).toBeVisible()
    await page.clock.runFor(29_900)
    expect(requests).toBe(0)
    await page.clock.runFor(200)
    await expect.poll(() => requests).toBe(1)
    await expect(page.getByText('ssh ubuntu@192.0.2.20', { exact: true })).toBeVisible()
})

test('missing access recovers automatically, polls updates and preserves data during an outage', async ({ page }) => {
    let requests = 0
    await page.route('**/api/backend/vm/first-vm/connection', route => {
        requests++
        return route.fulfill(requests === 1 || requests === 3 ? { status: 503, json: { error: 'Unavailable' } } : { json: connection('first-vm', requests > 3 ? '192.0.2.20' : '192.0.2.10') })
    })
    await page.goto('http://vm-access.test/')
    await expect(page.getByText('Reloading SSH user, host, and certificate information automatically…')).toBeVisible()
    await expect.poll(() => requests).toBe(1)
    await page.clock.runFor(2100)
    await expect(page.getByText('ssh ubuntu@192.0.2.10', { exact: true })).toBeVisible()
    await page.clock.runFor(30_100)
    await expect.poll(() => requests).toBe(3)
    await expect(page.getByText('ssh ubuntu@192.0.2.10', { exact: true })).toBeVisible()
    await page.clock.runFor(2100)
    await expect(page.getByText('ssh ubuntu@192.0.2.20', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Unmount' }).click()
    const stoppedAt = requests
    await page.clock.runFor(60_000)
    expect(requests).toBe(stoppedAt)
})

test('permission denial clears details and stops automatic retries', async ({ page }) => {
    let requests = 0
    await page.route('**/api/backend/vm/first-vm/connection', route => {
        requests++
        return route.fulfill(requests === 1 ? { json: connection() } : { status: 403, json: { error: 'Forbidden' } })
    })
    await page.goto('http://vm-access.test/')
    await expect(page.getByText('ssh ubuntu@192.0.2.10', { exact: true })).toBeVisible()
    await page.clock.runFor(30_100)
    await expect(page.getByText('You do not have permission to view access details.')).toBeVisible()
    await expect(page.getByText('ssh ubuntu@192.0.2.10', { exact: true })).toHaveCount(0)
    await page.clock.runFor(60_000)
    expect(requests).toBe(2)
})

test('manual refresh recovers after access was denied', async ({ page }) => {
    let requests = 0
    await page.route('**/api/backend/vm/first-vm/connection', route => {
        requests++
        return route.fulfill(requests === 1 ? { status: 403, json: { error: 'Forbidden' } } : { json: connection('first-vm', '192.0.2.20') })
    })
    await page.goto('http://vm-access.test/')
    await expect(page.getByText('You do not have permission to view access details.')).toBeVisible()
    await page.clock.runFor(60_000)
    expect(requests).toBe(1)
    await page.getByRole('button', { name: 'Refresh access' }).click()
    await expect(page.getByText('ssh ubuntu@192.0.2.20', { exact: true })).toBeVisible()
    expect(requests).toBe(2)
})

test('VM navigation cancels stale requests and manual refresh also reloads access', async ({ page }) => {
    let release: (() => void) | undefined
    await page.route('**/api/backend/vm/first-vm/connection', async route => {
        await new Promise<void>(resolve => { release = resolve })
        await route.fulfill({ json: connection() }).catch(() => {})
    })
    let requests = 0
    await page.route('**/api/backend/vm/second-vm/connection', route => {
        requests++
        return route.fulfill({ json: connection('second-vm', '192.0.2.30') })
    })
    await page.goto('http://vm-access.test/')
    await expect.poll(() => Boolean(release)).toBe(true)
    await page.getByRole('button', { name: 'Switch VM' }).click()
    await expect(page.getByText('ssh ubuntu@192.0.2.30', { exact: true })).toBeVisible()
    release!()
    await page.getByRole('button', { name: 'Refresh access' }).click()
    await expect.poll(() => requests).toBe(2)
    await expect(page.getByText('ssh ubuntu@192.0.2.10', { exact: true })).toHaveCount(0)
})

test('expired website session automatically logs out and retains the complete return URL', async ({ page }) => {
    await page.route('**/api/backend/vm/first-vm/connection', route => route.fulfill({ status: 401, json: { error: 'Unauthorized.' } }))
    await page.route('http://vm-access.test/vms/cashflow?tab=access', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<div id="root"></div><script src="/fixture.js"></script>' }))
    await page.route('http://vm-access.test/logout?**', route => route.fulfill({ contentType: 'text/html', body: 'Logging out' }))
    await page.goto('http://vm-access.test/vms/cashflow?tab=access#ssh')
    await expect(page).toHaveURL(/\/logout\?path=/)
    const logout = new URL(page.url())
    const login = new URL(logout.searchParams.get('path')!, logout.origin)
    expect(login.pathname).toBe('/login')
    expect(login.searchParams.get('expired')).toBe('true')
    expect(login.searchParams.get('path')).toBe('/vms/cashflow?tab=access#ssh')
})
