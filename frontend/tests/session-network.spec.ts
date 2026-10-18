import { test, expect } from '@playwright/test'
import { registerFixtureBundle } from './fixtureBundle'

const fixture = registerFixtureBundle({
    entrypoint: 'tests/fixtures/session-network.tsx',
    directoryPrefix: 'session-network-test-',
    define: 'process.env={"NODE_ENV":"production"}',
    executableEnvironment: 'BUN_BIN'
})
for (const kind of ['private', 'public', 'missing'] as const) {
    test(`session network distinguishes ${kind} addresses`, async ({ page }) => {
        await page.route('http://session-network.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: fixture.bundle }))
        await page.route('http://session-network.test/', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/fixture.js"></script>' }))
        await page.route('**/auth/sessions', route => route.fulfill({ json: { sessions: [{
            token_id: 1, id: 'session-fixture', ip: kind === 'public' ? '8.8.8.8' : null,
            private_ip: kind === 'private' ? '10.52.246.173' : undefined, current: true,
            network: kind === 'public' ? { provider: 'Google LLC', country: 'United States', city: null, region: null } : null,
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/26.5 Safari/605.1.15',
            created_at: '2026-09-12T22:45:38Z', last_seen_at: '2026-09-13T19:23:00Z', revoked_at: null,
        }] } }))
        await page.goto('http://session-network.test/')
        await expect(page.getByRole('heading', { name: 'Safari on macOS' })).toBeVisible()
        if (kind === 'private') {
            await expect(page.getByText('Private IP 10.52.246.173', { exact: true })).toBeVisible()
            await expect(page.getByText('ISP / network: Private network', { exact: true })).toBeVisible()
            await expect(page.getByText('Approximate location: Not available for private IPs', { exact: true })).toBeVisible()
            await expect(page.getByText('Public IP was not captured for this login', { exact: true })).toHaveCount(0)
        } else if (kind === 'public') {
            await expect(page.getByText('Public IP 8.8.8.8', { exact: true })).toBeVisible()
            await expect(page.getByText('ISP / network: Google LLC', { exact: true })).toBeVisible()
            await expect(page.getByText('Approximate location: United States', { exact: true })).toBeVisible()
        } else {
            await expect(page.getByText('Public IP was not captured for this login', { exact: true })).toBeVisible()
        }
    })
}
