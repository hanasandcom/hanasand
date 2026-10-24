import { test, expect } from '@playwright/test'

test('mobile VM access menu fits the viewport and opens the SSH command', async ({ page }) => {
    const origin = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3272'
    await page.setViewportSize({ width: 375, height: 812 })
    await page.context().addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: origin },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin },
    ])
    await page.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await page.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window)
        window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
            if (!url.includes('/api/backend/vm/cashflow/connection')) return nativeFetch(input, init)
            const testWindow = window as Window & { __sshConnectionRequests?: number }
            testWindow.__sshConnectionRequests = (testWindow.__sshConnectionRequests || 0) + 1
            return new Response(JSON.stringify({ sshCommand: 'ssh -p 443 cashflow@203.0.113.10' }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
    })
    await page.routeWebSocket('**/vm/cashflow/console', socket => {
        socket.onMessage(message => {
            if (JSON.parse(String(message)).type === 'auth') socket.send(JSON.stringify({ type: 'ready', username: 'fixture' }))
        })
    })
    await page.goto('/vms/cashflow/console?provisioning=1')
    await expect(page.getByRole('status').first()).toContainText('Connected')

    const trigger = page.getByRole('button', { name: 'VM access actions' })
    const menu = page.getByRole('group', { name: 'VM access actions' })
    const viewports = [{ width: 375, height: 812 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]
    for (const [index, viewport] of viewports.entries()) {
        await page.setViewportSize(viewport)
        await expect(trigger).toBeVisible()
        await trigger.click()
        await menu.hover()
        await expect(menu.getByRole('button', { name: 'Connect locally' })).toBeVisible()
        await expect(menu.getByRole('button', { name: 'Show sudo password' })).toBeVisible()
        const bounds = await menu.boundingBox()
        expect(bounds).not.toBeNull()
        expect(bounds!.x).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
        if (index < viewports.length - 1) await page.keyboard.press('Escape')
    }

    await menu.getByRole('button', { name: 'Connect locally', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Connect to cashflow' })
    await expect(dialog).toBeVisible()
    await expect.poll(() => page.evaluate(() => (window as Window & { __sshConnectionRequests?: number }).__sshConnectionRequests)).toBe(1)
    await expect(dialog.getByText('ssh -p 443 cashflow@203.0.113.10')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Copy SSH command' })).toBeVisible()
})
