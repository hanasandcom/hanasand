import { strict as assert } from 'node:assert'
import test from 'node:test'
import {
    buildDwmOrganizationMirrorPayload,
    buildDwmWatchlistMirrorPayloads,
    mirrorOrganizationWatchlistToDwmResult,
    mirrorOrganizationToDwmResult,
} from '@/app/api/organizations/_organizationWatchlistDwmBridge'
import { buildOrganizationWatchlistResponse } from '@/app/api/organizations/organizationWatchlistMutation'

test('mirrors an organization with authenticated owner before watchlist creation', async () => {
    const mirrorPayload = buildDwmOrganizationMirrorPayload({
        organizationPayload: { organization: { id: 'org_acme', name: 'Acme', slug: 'acme', lifecycleStatus: 'active' } },
        ownerUserId: 'owner-1',
    })
    assert.deepEqual(mirrorPayload, { id: 'org_acme', name: 'Acme', slug: 'acme', status: 'active', ownerUserId: 'owner-1' })
    const calls: Array<{ url: string, body: unknown }> = []
    const result = await mirrorOrganizationToDwmResult({
        base: 'http://scraper.local', mirrorPayload: mirrorPayload!,
        authHeaders: { authorization: 'Bearer user-token', id: 'owner-1' },
        fetchImpl: (async (input, init) => {
            calls.push({ url: String(input), body: JSON.parse(String(init?.body)) })
            return Response.json({ organization: { id: 'org_acme' } }, { status: 201 })
        }) as typeof fetch,
    })
    assert.equal(result.ok, true)
    assert.equal(result.organizationId, 'org_acme')
    assert.deepEqual(calls, [{ url: 'http://scraper.local/v1/organizations', body: mirrorPayload }])
})

test('mirrors a watchlist mutation and returns its persisted alert summary', async () => {
    const calls: Array<{ url: string, method: string, body?: unknown, headers: Record<string, string> }> = []
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input)
        const method = init?.method || (input instanceof Request ? input.method : 'GET')
        const headers = Object.fromEntries(new Headers(init?.headers).entries())
        const body = init?.body ? JSON.parse(String(init.body)) : undefined
        calls.push({ url, method, body, headers })
        if (url === 'http://scraper.local/v1/dwm/watchlists') {
            assert.deepEqual(body, {
                id: 'org_watch_item_acme_domain', tenantId: 'org_acme', organizationId: 'org_acme',
                name: 'Org watchlist - acme.com', status: 'active',
                terms: [{ id: 'watch_item_acme_domain', value: 'acme.com', kind: 'domain' }],
                reason: 'organization_watchlist_saved',
            })
            return Response.json({ watchlist: { id: 'org_watch_item_acme_domain' }, alertRebuild: {
                savedAlertCount: 1, alertIds: ['alert_org_acme'], sourceFamilies: ['telegram_public'], matchedTerms: ['acme.com'],
            } }, { status: 201 })
        }
        if (url === 'http://scraper.local/v1/dwm/alerts/alert_org_acme?tenantId=org_acme&organizationId=org_acme') {
            return Response.json({ alert: {
                id: 'alert_org_acme', alertDetailPath: '/v1/dwm/alerts/alert_org_acme?organizationId=org_acme',
                sourceFamily: 'telegram_public', matchedTerm: { value: 'acme.com' }, recommendedRoute: 'identity_response',
                evidence: [{ excerpt: 'Telegram post references acme.com credentials.' }],
                evidenceSummary: { evidenceCount: 1, lastObservedAt: '2026-06-27T21:11:00.000Z' },
            } })
        }
        return Response.json({ error: 'unexpected fetch', url }, { status: 500 })
    }) as typeof fetch
    const mirrorPayloads = buildDwmWatchlistMirrorPayloads({ organizationId: 'org_acme', organizationPayload: {
        watchlistItem: { id: 'watch_item_acme_domain', kind: 'domain', value: 'acme.com', status: 'active' },
    } })
    const result = await mirrorOrganizationWatchlistToDwmResult({
        base: 'http://scraper.local', organizationId: 'org_acme', mirrorPayloads,
        authHeaders: { authorization: 'Bearer user-token', id: 'user-1' }, fetchImpl,
    })
    assert.equal(result.ok, true)
    assert.equal(result.savedAlertCount, 1)
    assert.deepEqual(result.alertIds, ['alert_org_acme'])
    assert.deepEqual(result.sourceFamilies, ['telegram_public'])
    assert.deepEqual(result.matchedTerms, ['acme.com'])
    assert.deepEqual(result.firstAlert, {
        id: 'alert_org_acme', detailRoute: '/v1/dwm/alerts/alert_org_acme?organizationId=org_acme',
        sourceFamily: 'telegram_public', matchedTerm: 'acme.com', severity: undefined,
        recommendedRoute: 'identity_response', evidenceCount: 1,
        evidenceExcerpt: 'Telegram post references acme.com credentials.',
        firstSeenAt: undefined, lastSeenAt: '2026-06-27T21:11:00.000Z',
    })
    assert.equal(calls[0].method, 'POST')
    assert.equal(calls[0].url, 'http://scraper.local/v1/dwm/watchlists')
    assert.equal(calls[0].headers.authorization, 'Bearer user-token')
    assert.equal(calls[0].headers['x-organization-id'], 'org_acme')
    assert.equal(calls[1].url, 'http://scraper.local/v1/dwm/alerts/alert_org_acme?tenantId=org_acme&organizationId=org_acme')
    assert.equal(calls[1].method, 'GET')
    assert.equal(calls[1].headers.authorization, 'Bearer user-token')
    assert.equal(calls[1].headers['x-tenant-id'], 'org_acme')
})

test('does not report empty, queued, or failed alert rebuilds as successful syncs', async () => {
    const mirrorPayloads = buildDwmWatchlistMirrorPayloads({ organizationId: 'org_scope', organizationPayload: {
        watchlistItem: { id: 'term_scope', kind: 'company', value: 'Scoped Company', status: 'active' },
    } })
    for (const alertRebuild of [{ savedAlertCount: 0, alertIds: [] }, { status: 'queued', savedAlertCount: 0, alertIds: [] }]) {
        const result = await mirrorOrganizationWatchlistToDwmResult({
            base: 'http://scraper.local', organizationId: 'org_scope', mirrorPayloads,
            fetchImpl: (async () => Response.json({ watchlist: { id: 'org_term_scope' }, alertRebuild }, { status: 201 })) as typeof fetch,
        })
        assert.equal(result.ok, false)
        assert.equal(result.status, 502)
        assert.equal(result.mirrors[0].rebuildStatus, alertRebuild.status ?? 'completed')
    }
    const failed = await mirrorOrganizationWatchlistToDwmResult({
        base: 'http://scraper.local', organizationId: 'org_scope', mirrorPayloads,
        fetchImpl: (async () => Response.json({ error: { code: 'backend_failed' } }, { status: 503 })) as typeof fetch,
    })
    assert.equal(failed.ok, false)
    assert.equal(failed.status, 502)
    assert.equal(failed.mirrors[0].rebuildStatus, 'failed')
})

test('maps persisted watchlist outcomes to response status and retry guidance', () => {
    const savedPayload = { watchlistItem: { id: 'term-1' } }
    const completed = buildOrganizationWatchlistResponse(savedPayload, 201, { ok: true, rebuildStatus: 'completed' })
    assert.equal(completed.status, 201)
    assert.equal(completed.body.dwmAlertBridge.ok, true)

    const empty = buildOrganizationWatchlistResponse(savedPayload, 201, { ok: false, rebuildStatus: 'completed' })
    assert.equal(empty.status, 201)
    assert.equal(empty.body.retryable, false)
    assert.equal((empty.body.error as { code: string }).code, 'dwm_alert_rebuild_empty')

    const pending = buildOrganizationWatchlistResponse(savedPayload, 200, { ok: false, rebuildStatus: 'running' })
    assert.equal(pending.status, 202)
    assert.equal(pending.body.retryable, true)
    assert.equal((pending.body.error as { code: string }).code, 'dwm_alert_rebuild_pending')

    const failed = buildOrganizationWatchlistResponse(savedPayload, 200, { ok: false, rebuildStatus: 'failed' })
    assert.equal(failed.status, 502)
    assert.equal(failed.body.retryable, true)
    assert.equal((failed.body.error as { code: string }).code, 'dwm_watchlist_sync_failed')
})
