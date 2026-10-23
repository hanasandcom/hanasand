import { expect, test } from '@playwright/test'

test('members can create VMs from System and VMs without requesting host telemetry', async ({ context, page, baseURL }) => {
    test.skip(!process.env.VM_FIXTURE_API, 'Requires the VM fixture API')
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token' }).map(([name, value]) => ({ name, value, url: baseURL! })))
    const rows = [{ name: 'my-machine', owner: 'dashboard-render-proof-user', status: 'running', access_users: [] }]
    await page.route('**/api/backend/vms/**', route => route.fulfill({ json: rows }))
    await page.route('**/api/vm', async route => {
        expect(route.request().postDataJSON()).toEqual({ name: 'new-machine' })
        rows.push({ ...rows[0], name: 'new-machine' })
        await route.fulfill({ status: 201, json: rows.at(-1) })
    })
    for (const route of ['/system', '/vms']) {
        await page.goto(route)
        await expect(page.getByRole('heading', { name: 'Virtual machines', exact: true }).first()).toBeVisible()
        await expect(page.getByRole('button', { name: 'Create VM', exact: true })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'my-machine', exact: true })).toBeVisible()
        await expect(page.locator('[data-system-summary-metrics]')).toHaveCount(0)
        await expect(page.getByText('OVHcloud', { exact: true })).toHaveCount(0)
    }
    await page.getByRole('button', { name: 'Create VM', exact: true }).click()
    await page.getByLabel('VM name', { exact: true }).fill('new-machine')
    await page.getByRole('button', { name: 'Create VM', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'new-machine', exact: true })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Created VM' })).toContainText('Created VM new-machine.')
    // Page membership does not grant access to host telemetry or VM operations.
    await page.goto('/system')
    await expect(page.getByRole('button', { name: 'Create VM', exact: true })).toBeVisible()
    await expect(page.locator('[data-system-summary-metrics]')).toHaveCount(0)
    const requests = await (await fetch(`${process.env.VM_FIXTURE_API}/requests`)).json()
    expect(requests).not.toContain('/api/metrics')
    expect(requests).not.toContain('/api/docker')
})

test('VM pages still require a signed-in session', async ({ page }) => {
    await page.goto('/vms')
    await expect(page).toHaveURL(/\/login\?path=/)
})

test('VM inventory puts every row action behind the hamburger on narrow screens', async ({ context, page, baseURL }) => {
    test.skip(!process.env.VM_FIXTURE_API, 'Requires the VM fixture API')
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token' }).map(([name, value]) => ({ name, value, url: baseURL! })))
    await page.route('**/api/backend/vms/**', route => route.fulfill({ json: [{
        name: 'my-machine', owner: 'dashboard-render-proof-user', status: 'running', access_users: [], can_assign_organization: true,
        device_eth0_ipv4_address: '10.0.0.5', limits_cpu: '2', limits_memory: '2GiB',
        config_image_os: 'ubuntu', config_image_version: '24.04',
    }] }))
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto('/vms', { waitUntil: 'domcontentloaded' })
    const name = page.getByRole('heading', { name: 'my-machine', exact: true })
    await expect(name).toBeVisible()
    const row = page.locator('article').filter({ has: name })
    const more = row.locator('summary[aria-label="More actions for my-machine"]')

    for (const width of [390, 768, 1024]) {
        await page.setViewportSize({ width, height: 900 })
        expect(await page.evaluate(() => window.innerWidth)).toBe(width)
        await expect(more).toBeVisible()
        const desktopConsole = row.locator('a[href="/vms/my-machine/console"]').first()
        const visibility = await desktopConsole.evaluate(element => ({ width: window.innerWidth, breakpoint: matchMedia('(min-width: 1280px)').matches, display: getComputedStyle(element).display }))
        expect(visibility, `Desktop action visibility at ${width}px`).toEqual({ width, breakpoint: false, display: 'none' })
        if (await row.locator('details[data-vm-actions]').getAttribute('open') === null) await more.click()
        const menu = row.locator('details[data-vm-actions] > div')
        for (const action of ['Restart my-machine', 'Stop my-machine', 'Open details', 'Connect locally', 'Show sudo password', 'Delete VM']) {
            await expect(menu.getByRole('button', { name: action, exact: true })).toBeVisible()
        }
        await expect(menu.getByRole('link', { name: 'Open my-machine console', exact: true })).toBeVisible()
        await expect(menu.getByRole('button', { name: 'Add my-machine to organization', exact: true })).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        const bounds = await name.boundingBox()
        expect(bounds).not.toBeNull()
        expect(bounds!.height).toBeLessThan(50)
    }

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(row.getByRole('link', { name: 'Open my-machine console' }).first()).toBeVisible()
    await expect(row.getByRole('button', { name: 'Connect locally' }).first()).toBeVisible()
    await expect(row.getByRole('button', { name: 'Show sudo password' }).first()).toBeVisible()
})

test('VM inventory renders its empty state when the VM list is empty', async ({ context, page, baseURL }) => {
    test.skip(!process.env.VM_FIXTURE_API, 'Requires the VM fixture API')
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-empty-user', access_token: 'local-dashboard-render-proof-token' }).map(([name, value]) => ({ name, value, url: baseURL! })))
    await page.goto('/vms')
    await expect(page.getByRole('heading', { name: 'Virtual machines', exact: true })).toBeVisible()
    await expect(page.getByText('0 virtual machines', { exact: true })).toBeVisible()
    await expect(page.getByText('VM controls are ready.')).toBeVisible()
})

test('VM inventory leaves its loading state when the VM response body stalls', async ({ context, page, baseURL }) => {
    test.skip(!process.env.VM_FIXTURE_API, 'Requires the VM fixture API')
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-stalled-user', access_token: 'local-dashboard-render-proof-token' }).map(([name, value]) => ({ name, value, url: baseURL! })))
    await page.goto('/vms', { waitUntil: 'commit' })
    await expect(page.getByRole('status', { name: 'Loading virtual machines' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Virtual machines', exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('VM controls are ready.')).toBeVisible()
})

test('VM inventory leaves its loading state when an error response body stalls', async ({ context, page, baseURL }) => {
    test.skip(!process.env.VM_FIXTURE_API, 'Requires the VM fixture API')
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-stalled-error-user', access_token: 'local-dashboard-render-proof-token' }).map(([name, value]) => ({ name, value, url: baseURL! })))
    await page.goto('/vms', { waitUntil: 'commit' })
    await expect(page.getByRole('status', { name: 'Loading virtual machines' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Virtual machines', exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('VM controls are ready.')).toBeVisible()
})

test('empty accounts only see Infrastructure Overview until their first VM is created', async ({ context, page, baseURL }) => {
    test.skip(!process.env.VM_FIXTURE_API, 'Requires the VM fixture API')
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token' }).map(([name, value]) => ({ name, value, url: baseURL! })))
    const rows: Array<{ name: string, owner: string, status: string, access_users: string[] }> = []
    await page.route('**/api/backend/vms/**', route => route.fulfill({ json: rows }))
    await page.route('**/api/vm', async route => {
        rows.push({ name: 'first-machine', owner: 'dashboard-render-proof-user', status: 'running', access_users: [] })
        await route.fulfill({ status: 201, json: rows[0] })
    })
    await page.goto('/system')
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(page.getByText('0 virtual machines', { exact: true })).toBeVisible()
    await expect(nav.locator('a[href="/system"]')).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Compute', exact: true })).toHaveCount(0)
    await expect(nav.locator('a[href="/vms"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Create VM', exact: true }).click()
    await page.getByLabel('VM name', { exact: true }).fill('first-machine')
    await page.getByRole('button', { name: 'Create VM', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'first-machine', exact: true })).toBeVisible()
    await nav.getByRole('button', { name: 'Compute', exact: true }).click()
    await expect(nav.locator('a[href="/vms"]')).toBeVisible()
    rows.length = 0
    await page.evaluate(() => window.dispatchEvent(new Event('vms-updated')))
    await expect(nav.getByRole('button', { name: 'Compute', exact: true })).toHaveCount(0)
    await expect(nav.locator('a[href="/system"]')).toBeVisible()
})
