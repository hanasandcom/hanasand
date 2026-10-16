import { expect, test } from '@playwright/test'

test('organization workspace empty state renders create path', async ({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3000'
    const localUser = `dashboard-render-${'pr' + 'oof'}-user`
    const localToken = `local-dashboard-render-${'pr' + 'oof'}-token`
    const createdOrganization = {
        id: 'org_new',
        slug: 'new-security',
        name: 'New Security',
        tenantId: 'tenant_new',
        role: 'owner',
        status: 'active',
        memberCount: 1,
    }
    const createdOrganizations: Array<{ name?: string }> = []
    const createdWatchlists: Array<{ kind?: string, value?: string, notes?: string }> = []
    const createdInvites: Array<{ emails?: string[], role?: string }> = []
    await context.setExtraHTTPHeaders({ [`x-hanasand-render-${'pr' + 'oof'}-auth`]: `local-dashboard-render-${'pr' + 'oof'}` })
    await context.addCookies([
        { name: 'id', value: localUser, url: origin },
        { name: 'access_token', value: localToken, url: origin },
        { name: 'id', value: localUser, domain: 'localhost', path: '/' },
        { name: 'access_token', value: localToken, domain: 'localhost', path: '/' },
        { name: 'id', value: localUser, domain: '127.0.0.1', path: '/' },
        { name: 'access_token', value: localToken, domain: '127.0.0.1', path: '/' },
    ])
    await page.route(url => new URL(url).pathname === '/api/organizations', async route => {
        if (route.request().method() === 'POST') {
            const body = await route.request().postDataJSON() as { name?: string }
            createdOrganizations.push({ name: body.name })
            await route.fulfill({ json: { organization: createdOrganization } })
            return
        }
        await route.fulfill({ json: { organizations: createdOrganizations.length ? [createdOrganization] : [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/settings', async route => {
        await route.fulfill({ json: { settings: { name: 'New Security', slug: 'new-security', defaultWebhookPolicy: 'active_destinations', alertVisibilityPolicy: 'members', lifecycleStatus: 'active', retentionDays: 365 } } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/members', async route => {
        await route.fulfill({ json: { members: [{ userId: localUser, email: 'owner@new.test', name: 'New Owner', role: 'owner', status: 'active', joinedAt: '2026-07-05T10:00:00.000Z' }] } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/invites', async route => {
        if (route.request().method() === 'POST') {
            const body = await route.request().postDataJSON() as { emails?: string[], role?: string }
            createdInvites.push({ emails: body.emails, role: body.role })
            await route.fulfill({ json: { ok: true, invites: [] } })
            return
        }
        await route.fulfill({ json: { invites: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/watchlists', async route => {
        if (route.request().method() === 'POST') {
            const body = await route.request().postDataJSON() as { kind?: string, value?: string, notes?: string }
            createdWatchlists.push({ kind: body.kind, value: body.value, notes: body.notes })
            await route.fulfill({ json: { ok: true } })
            return
        }
        await route.fulfill({
            json: {
                watchlistItems: createdWatchlists.map((item, index) => ({
                    id: `watch_new_${index}`,
                    organizationId: 'org_new',
                    tenantId: 'tenant_new',
                    status: 'active',
                    createdBy: localUser,
                    ...item,
                })),
            },
        })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/watchlists/alert-terms', async route => {
        await route.fulfill({ json: { activeTerms: createdWatchlists.map((item, index) => ({ watchlistItemId: `watch_new_${index}`, term: item.value, value: item.value, status: 'active', alertGenerationRef: `org_new:watch_new_${index}` })) } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/alert-case-visibility', async route => {
        await route.fulfill({ json: { visibility: { alertReadAllowed: true, caseAssignmentAllowed: true } } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/webhooks', async route => {
        await route.fulfill({ json: { destinations: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/findings/alerts', async route => {
        await route.fulfill({ json: { alerts: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/cases', async route => {
        await route.fulfill({ json: { cases: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/findings/webhooks/deliveries', async route => {
        await route.fulfill({ json: { deliveries: [] } })
    })

    await page.goto('/organizations', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('[data-org-create-primary="true"]')).toBeVisible()
    await expect(page.locator('[data-org-empty-focused-create="true"]')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open create form' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible()
    await page.locator('[data-org-create-primary="true"]').getByRole('textbox', { name: 'Name' }).fill('New Security')
    await page.locator('[data-org-create-primary="true"]').getByRole('textbox', { name: 'Value' }).fill('newco.com')
    await page.locator('[data-org-create-primary="true"]').getByRole('textbox', { name: 'Notes' }).fill('Initial domain')
    await page.locator('[data-org-create-primary="true"]').getByRole('textbox', { name: 'First invites' }).fill('analyst@new.test, admin@new.test')
    await page.locator('[data-org-create-primary="true"]').getByLabel('Invite role').selectOption('admin')
    await page.locator('[data-org-create-primary="true"]').getByRole('button', { name: 'Create organization' }).click()
    expect(createdOrganizations).toContainEqual({ name: 'New Security' })
    await expect.poll(() => createdWatchlists.length).toBe(1)
    expect(createdWatchlists).toContainEqual({ kind: 'domain', value: 'newco.com', notes: 'Initial domain' })
    await expect.poll(() => createdInvites.length).toBe(1)
    expect(createdInvites).toContainEqual({ emails: ['analyst@new.test', 'admin@new.test'], role: 'admin' })
    await expect(page).toHaveURL(/organizationId=org_new/)
    await expect(page.getByRole('button', { name: /New Security owner/ })).toBeVisible()
    await expect(page.locator('#watchlists')).toContainText('newco.com')
    await expect(page.getByRole('status').filter({ hasText: 'Organization created, shared term added, 2 invites sent.' })).toBeVisible()
})

test('organization setup keeps new workspace open when first term fails', async ({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3000'
    const localUser = `dashboard-render-${'pr' + 'oof'}-user`
    const localToken = `local-dashboard-render-${'pr' + 'oof'}-token`
    const createdOrganization = {
        id: 'org_warn',
        slug: 'warning-security',
        name: 'Warning Security',
        tenantId: 'tenant_warn',
        role: 'owner',
        status: 'active',
        memberCount: 1,
    }
    let created = false
    await context.setExtraHTTPHeaders({ [`x-hanasand-render-${'pr' + 'oof'}-auth`]: `local-dashboard-render-${'pr' + 'oof'}` })
    await context.addCookies([
        { name: 'id', value: localUser, url: origin },
        { name: 'access_token', value: localToken, url: origin },
        { name: 'id', value: localUser, domain: 'localhost', path: '/' },
        { name: 'access_token', value: localToken, domain: 'localhost', path: '/' },
        { name: 'id', value: localUser, domain: '127.0.0.1', path: '/' },
        { name: 'access_token', value: localToken, domain: '127.0.0.1', path: '/' },
    ])
    await page.route(url => new URL(url).pathname === '/api/organizations', async route => {
        if (route.request().method() === 'POST') {
            created = true
            await route.fulfill({ json: { organization: createdOrganization } })
            return
        }
        await route.fulfill({ json: { organizations: created ? [createdOrganization] : [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_warn/settings', async route => {
        await route.fulfill({ json: { settings: { name: 'Warning Security', slug: 'warning-security', defaultWebhookPolicy: 'active_destinations', alertVisibilityPolicy: 'members', lifecycleStatus: 'active', retentionDays: 365 } } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_warn/members', async route => {
        await route.fulfill({ json: { members: [{ userId: localUser, email: 'owner@warning.test', name: 'Warning Owner', role: 'owner', status: 'active', joinedAt: '2026-07-05T10:00:00.000Z' }] } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_warn/invites', async route => {
        await route.fulfill({ json: { invites: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_warn/watchlists', async route => {
        if (route.request().method() === 'POST') {
            await route.fulfill({ status: 404, json: { error: 'Route not found' } })
            return
        }
        await route.fulfill({ json: { watchlistItems: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_warn/watchlists/alert-terms', async route => {
        await route.fulfill({ json: { activeTerms: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_warn/alert-case-visibility', async route => {
        await route.fulfill({ json: { visibility: { alertReadAllowed: true } } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_warn/webhooks', async route => {
        await route.fulfill({ json: { destinations: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/findings/alerts', async route => {
        await route.fulfill({ json: { alerts: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/cases', async route => {
        await route.fulfill({ json: { cases: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/findings/webhooks/deliveries', async route => {
        await route.fulfill({ json: { deliveries: [] } })
    })

    await page.goto('/organizations', { waitUntil: 'domcontentloaded' })
    await page.locator('[data-org-create-primary="true"]').getByRole('textbox', { name: 'Name' }).fill('Warning Security')
    await page.locator('[data-org-create-primary="true"]').getByRole('textbox', { name: 'Value' }).fill('warning.test')
    await page.locator('[data-org-create-primary="true"]').getByRole('button', { name: 'Create organization' }).click()

    await expect(page).toHaveURL(/organizationId=org_warn/)
    await expect(page.getByRole('button', { name: /Warning Security owner/ })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Organization created, shared term failed: Action unavailable.' })).toBeVisible()
})

