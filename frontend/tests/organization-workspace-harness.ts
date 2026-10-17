import type { BrowserContext, Page } from '@playwright/test'
import { fixtureOrganization, fixtureViewerOrganization, fixtureMembers, fixtureInvites, fixtureWatchlists, fixtureContosoWatchlists, fixtureDestinations, fixtureAlerts, fixtureCases, fixtureDeliveries } from './organization-workspace-fixtures'
import { setupRenderProofSession } from './helpers/renderProofSession'

export async function setupOrganizationWorkspace(context: BrowserContext, page: Page, baseURL?: string, viewerRole: 'viewer' | 'support' = 'viewer') {
    const readOnlyOrganization = { ...fixtureViewerOrganization, role: viewerRole }
    const inviteCreates: Array<{ emails?: string[], role?: string }> = []
    const inviteActions: Array<{ inviteId: string, action: string }> = []
    const memberRoleChanges: Array<{ userId: string, role: string }> = []
    const memberRemovals: string[] = []
    const watchlistUpdates: Array<{ itemId: string, value: string }> = []
    const watchlistArchives: string[] = []
    const destinationTests: Array<{ destinationId: string, dryRun: boolean }> = []
    const watchlistDestinationTests: Array<{ watchlistId?: string, webhookUrl?: string, attachToWatchlist?: boolean }> = []
    const deliveryReplays: Array<{ destinationId?: string, alertId?: string, caseId?: string, watchlistId?: string, replay?: boolean }> = []
    const settingsUpdates: Array<{ name?: string }> = []
    const state = { inviteCreates, inviteActions, memberRoleChanges, memberRemovals, watchlistUpdates, watchlistArchives, destinationTests, watchlistDestinationTests, deliveryReplays, settingsUpdates }
    await setupRenderProofSession(context, baseURL)
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: async (value: string) => {
                    const clipboard = window as Window & { __copiedInvite?: string, __copiedText?: string }
                    clipboard.__copiedInvite = value
                    clipboard.__copiedText = value
                },
            },
        })
    })

    await page.route(url => new URL(url).pathname === '/api/organizations', async route => {
        await route.fulfill({ json: { organizations: [fixtureOrganization, readOnlyOrganization] } })
    })
    await page.route('**/api/organizations/org_acme/settings', async route => {
        if (route.request().method() === 'PUT') {
            const body = await route.request().postDataJSON() as { name?: string }
            settingsUpdates.push({ name: body.name })
            await route.fulfill({ json: { ok: true, settings: { name: body.name || 'Acme Security', slug: 'acme-security', defaultWebhookPolicy: 'active_destinations', alertVisibilityPolicy: 'members', lifecycleStatus: 'active', retentionDays: 365 } } })
            return
        }
        await route.fulfill({ json: { settings: { name: 'Acme Security', slug: 'acme-security', defaultWebhookPolicy: 'active_destinations', alertVisibilityPolicy: 'members', lifecycleStatus: 'active', retentionDays: 365 } } })
    })
    await page.route('**/api/organizations/org_acme/members', async route => {
        await route.fulfill({ json: { members: fixtureMembers } })
    })
    await page.route('**/api/organizations/org_acme/members/*/role', async route => {
        const body = await route.request().postDataJSON() as { role?: string }
        memberRoleChanges.push({ userId: route.request().url().split('/members/')[1]?.split('/')[0] || '', role: body.role || '' })
        await route.fulfill({ json: { ok: true } })
    })
    await page.route('**/api/organizations/org_acme/members/*', async route => {
        memberRemovals.push(route.request().url().split('/members/')[1]?.split('/')[0] || '')
        await route.fulfill({ json: { ok: true } })
    })
    await page.route('**/api/organizations/org_acme/invites', async route => {
        if (route.request().method() === 'POST') {
            const body = await route.request().postDataJSON() as { emails?: string[], role?: string }
            inviteCreates.push({ emails: body.emails, role: body.role })
            await route.fulfill({ json: { ok: true, invites: fixtureInvites } })
            return
        }
        await route.fulfill({ json: { invites: fixtureInvites } })
    })
    await page.route('**/api/organizations/org_acme/invites/*/actions', async route => {
        const body = await route.request().postDataJSON() as { action?: string }
        inviteActions.push({ inviteId: route.request().url().split('/invites/')[1]?.split('/')[0] || '', action: body.action || '' })
        await route.fulfill({ json: { ok: true } })
    })
    await page.route('**/api/organizations/org_acme/watchlists', async route => {
        await route.fulfill({ json: { watchlistItems: fixtureWatchlists } })
    })
    await page.route('**/api/organizations/org_acme/watchlists/*', async route => {
        const itemId = route.request().url().split('/watchlists/')[1]?.split('/')[0] || ''
        if (route.request().method() === 'PUT') {
            const body = await route.request().postDataJSON() as { value?: string }
            watchlistUpdates.push({ itemId, value: body.value || '' })
        }
        if (route.request().method() === 'DELETE') {
            watchlistArchives.push(itemId)
        }
        await route.fulfill({ json: { ok: true } })
    })
    await page.route('**/api/organizations/org_acme/watchlists/alert-terms', async route => {
        await route.fulfill({ json: { activeTerms: fixtureWatchlists.filter(item => item.status === 'active').map(item => ({ watchlistItemId: item.id, term: item.value, value: item.value, status: item.status, alertGenerationRef: item.alertGenerationRef })) } })
    })
    await page.route('**/api/organizations/org_acme/alert-case-visibility', async route => {
        await route.fulfill({ json: { visibility: { alertReadAllowed: true, caseAssignmentAllowed: true, caseRoute: '/api/cases' } } })
    })
    await page.route('**/api/organizations/org_acme/webhooks', async route => {
        if (route.request().url().endsWith('/webhooks/test')) {
            const body = await route.request().postDataJSON() as { destinationId?: string, dryRun?: boolean }
            destinationTests.push({ destinationId: body.destinationId || '', dryRun: Boolean(body.dryRun) })
            await route.fulfill({ json: { deliveries: [fixtureDeliveries[0]] } })
            return
        }
        await route.fulfill({ json: { destinations: fixtureDestinations } })
    })
    await page.route('**/api/organizations/org_acme/webhooks/test', async route => {
        const body = await route.request().postDataJSON() as { destinationId?: string, dryRun?: boolean }
        destinationTests.push({ destinationId: body.destinationId || '', dryRun: Boolean(body.dryRun) })
        await route.fulfill({ json: { deliveries: [fixtureDeliveries[0]] } })
    })
    await page.route('**/api/findings/alerts?organizationId=org_acme', async route => {
        await route.fulfill({ json: { alerts: fixtureAlerts } })
    })
    await page.route('**/api/cases?organizationId=org_acme', async route => {
        await route.fulfill({ json: { cases: fixtureCases } })
    })
    await page.route('**/api/findings/webhooks/deliveries**', async route => {
        await route.fulfill({ json: { deliveries: fixtureDeliveries } })
    })
    await page.route('**/api/findings/webhooks/deliver', async route => {
        const body = await route.request().postDataJSON() as { destinationId?: string, alertId?: string, caseId?: string, watchlistId?: string, replay?: boolean, webhookUrl?: string, attachToWatchlist?: boolean }
        if (body.webhookUrl) {
            watchlistDestinationTests.push({ watchlistId: body.watchlistId, webhookUrl: body.webhookUrl, attachToWatchlist: body.attachToWatchlist })
        }
        deliveryReplays.push({ destinationId: body.destinationId, alertId: body.alertId, caseId: body.caseId, watchlistId: body.watchlistId, replay: body.replay })
        await route.fulfill({ json: { deliveries: [{ ...fixtureDeliveries[0], id: 'delivery_replay_1', status: 'dry_run', error: undefined, errorClass: undefined, responseSummary: 'Dry run replay accepted.', dryRun: true }] } })
    })
    await page.route('**/api/organizations/org_contoso/settings', async route => {
        await route.fulfill({ json: { settings: { name: 'Contoso', slug: 'contoso', defaultWebhookPolicy: 'active_destinations', alertVisibilityPolicy: 'members', lifecycleStatus: 'active', retentionDays: 365 } } })
    })
    await page.route('**/api/organizations/org_contoso/members', async route => {
        await route.fulfill({ json: { members: [{ userId: 'viewer_contoso', email: 'viewer@contoso.test', name: 'Contoso Viewer', role: 'viewer', status: 'active', joinedAt: '2026-07-03T10:00:00.000Z' }] } })
    })
    await page.route('**/api/organizations/org_contoso/invites', async route => {
        await route.fulfill({ json: { invites: [] } })
    })
    await page.route('**/api/organizations/org_contoso/watchlists', async route => {
        await route.fulfill({ json: { watchlistItems: fixtureContosoWatchlists } })
    })
    await page.route('**/api/organizations/org_contoso/watchlists/alert-terms', async route => {
        await route.fulfill({ json: { activeTerms: fixtureContosoWatchlists } })
    })
    await page.route('**/api/organizations/org_contoso/alert-case-visibility', async route => {
        await route.fulfill({ json: { visibility: { alertReadAllowed: true } } })
    })
    await page.route('**/api/organizations/org_contoso/webhooks', async route => {
        await route.fulfill({ json: { destinations: [] } })
    })
    await page.route('**/api/findings/alerts?organizationId=org_contoso', async route => {
        await route.fulfill({ json: { alerts: [] } })
    })
    await page.route('**/api/cases?organizationId=org_contoso', async route => {
        await route.fulfill({ json: { cases: [] } })
    })

    await page.goto('/organizations?organizationId=org_acme&focus=watchlists', { waitUntil: 'domcontentloaded' })
    return state
}
