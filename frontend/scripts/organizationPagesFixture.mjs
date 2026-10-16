import assert from 'node:assert/strict'
import { createServer } from 'node:net'

// Real Next pages and proxies use one isolated API matching production response shapes.
async function availablePort() {
    const server = createServer()
    server.listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => {
        server.once('listening', resolve)
        server.once('error', reject)
    })
    const address = server.address()
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    if (!address || typeof address === 'string') throw new Error('Could not reserve a local test port')
    return address.port
}

export async function startOrganizationPagesFixture() {
    const frontendPort = await availablePort()
    const base = `http://127.0.0.1:${frontendPort}`
    const organizations = [
        { id: 'cashflow', name: 'Cashflow', slug: 'cashflow', role: 'reader', lifecycleStatus: 'active' },
        { id: 'hanasand', name: 'Hanasand', slug: 'hanasand', role: 'owner', lifecycleStatus: 'active' },
        { id: 'research-norsk-tipping', name: 'Research - Norsk Tipping', slug: 'research-norsk-tipping', role: 'reader', lifecycleStatus: 'active' },
        { id: 'research-mnemonic', name: 'Research - mnemonic', slug: 'research-mnemonic', role: 'editor', lifecycleStatus: 'active' },
    ]
    const calls = []
    const state = { settingsError: false, eventsError: false, destinationRemoved: false }
    const api = Bun.serve({ port: await availablePort(), hostname: '127.0.0.1', async fetch(request) {
        const url = new URL(request.url)
        calls.push({ path: url.pathname, method: request.method })
        if (url.pathname === '/v1/dwm/alerts') return state.eventsError
            ? Response.json({ error: { message: 'Upstream unavailable.' } }, { status: 502 })
            : Response.json({ alerts: [] })
        if (url.pathname === '/api/cases') return Response.json({ cases: [
            { id: 'HA-47750', status: 'open', organizationId: 'hanasand', updatedAt: '2026-10-05T12:00:00Z' },
        ] })
        if (url.pathname.includes('/auth/token/')) return Response.json({ name: 'Fixture owner' })
        if (url.pathname === '/api/auth/social/providers') return Response.json({ providers: [] })
        if (url.pathname === '/api/auth/social/connections') return Response.json({ connections: [] })
        if (url.pathname.includes('/certificates/user/')) return Response.json([])
        if (url.pathname.endsWith('/profile-stats')) return Response.json({ loginDays: [], counts: { organizations: 1, containers: 0, vms: 0, shares: 0, articles: 0 } })
        if (url.pathname.includes('/user/')) {
            const id = url.pathname.split('/').pop()
            return Response.json({ id, username: id, name: id === 'dashboard-render-proof-user' ? 'Fixture owner' : 'Other person' })
        }
        if (url.pathname === '/api/organizations') {
            if (request.method === 'POST') {
                const { name } = await request.json()
                const organization = { id: 'created-org', name, slug: 'created-org', role: 'owner', lifecycleStatus: 'active' }
                organizations.push(organization)
                return Response.json({ organization }, { status: 201 })
            }
            return Response.json({ organizations })
        }
        if (url.pathname.startsWith('/api/dwm/webhook-destinations')) {
            if (state.eventsError && url.searchParams.get('orgId') === 'hanasand') return Response.json({ error: { message: 'Upstream unavailable.' } }, { status: 503 })
            if (url.searchParams.get('orgId') !== 'research-mnemonic' && !url.pathname.endsWith('/editor-target')) return Response.json({ destinations: [] })
            if (request.method === 'DELETE') { state.destinationRemoved = true; return Response.json({}) }
            return Response.json({ destinations: state.destinationRemoved ? [] : [{ id: 'editor-target', name: 'Editor target', kind: 'webhook', status: 'active', endpointHint: 'example.test', url: 'https://example.test/hook', events: ['dwm.alert.created'] }] })
        }
        if (url.pathname === '/api/dwm/webhook-deliveries') return state.eventsError
            ? Response.json({ error: { message: 'Upstream unavailable.' } }, { status: 502 })
            : Response.json({ items: [] })
        const [, orgId, resource] = url.pathname.match(/^\/api\/organizations\/([^/]+)(?:\/([^/]+))?/) || []
        const organization = organizations.find(item => item.id === orgId)
        if (organization) {
            if (!resource) return Response.json({ organization })
            if (['api-keys', 'invites'].includes(resource) && organization.role === 'reader') return Response.json({ error: { message: 'Owner or admin required.' } }, { status: 403 })
            if (resource === 'settings') {
                if (state.settingsError) return Response.json({ error: { message: 'Settings temporarily unavailable.' } }, { status: 503 })
                if (request.method === 'PUT') {
                    assert.equal(organization.role, 'owner')
                    Object.assign(organization, await request.json())
                }
                return Response.json({ organization, settings: { retentionDays: 365, defaultWebhookPolicy: 'active_destinations', alertVisibilityPolicy: 'members', lifecycleStatus: 'active' } })
            }
            if (resource === 'watchlists') return Response.json({ watchlistItems: [{ id: 'archived-watch', kind: 'domain', value: 'example.test', status: 'archived' }] })
            if (resource === 'members') return Response.json({ members: [
                { userId: 'dashboard-render-proof-user', name: 'Fixture user', role: organization.role, status: 'active' },
                { userId: 'teammate-one', name: 'First teammate', role: organization.role === 'owner' ? 'reader' : 'owner', status: 'active' },
                { userId: 'teammate-two', name: 'Second teammate', role: 'reader', status: 'active' },
            ] })
        }
        return Response.json({})
    } })
    const dev = Bun.spawn(['node', './node_modules/.bin/next', 'dev', '--webpack', '-p', String(frontendPort)], {
        env: { ...process.env, FRONTEND_AUTH_API: `${api.url}api`, FRONTEND_INTERNAL_API: `${api.url}api`, TI_SCRAPER_API_BASE: String(api.url), NEXT_DIST_DIR: '.next/organization-pages' },
        stdout: 'ignore', stderr: 'inherit',
    })
    return { base, organizations, calls, state, api, dev }
}
