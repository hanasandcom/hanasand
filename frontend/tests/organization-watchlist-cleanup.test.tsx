import { strict as assert } from 'node:assert'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { WatchlistCleanup, watchlistCleanupSelectionKey } from '../src/app/organizations/components/watchlistCleanup'
import { createOrganizationWatchlistActions } from '../src/app/organizations/organizationWatchlistActions'
import type { WatchlistItem } from '../src/app/organizations/types/watchlists'
import type { WorkspaceActionResult } from '../src/app/organizations/useWorkspaceActionRunner'

const item = (id: string, overrides: Partial<WatchlistItem> = {}): WatchlistItem => ({ id, organizationId: 'org-one', tenantId: 'org-one', value: `${id}.test`, kind: 'domain', status: 'active', ...overrides })
const items = [item('a'), item('b', { status: 'paused' }), item('archived', { status: 'archived' }), item('dated', { archivedAt: '2026-10-01' }), item('foreign', { organizationId: 'org-two' })]
function fixture(rows = items, organizationId = 'org-one', allowed = true) {
    let result: WorkspaceActionResult
    let calls = 0
    const actions = createOrganizationWatchlistActions({
        selectedOrganization: { id: organizationId, name: 'Synthetic organization' }, bundle: { watchlists: rows },
        requireManage: () => { if (!allowed) throw new Error('Not permitted') },
        runAction: async (_label, run) => { calls++; result = await run() },
    } as Parameters<typeof createOrganizationWatchlistActions>[0])
    return { actions, result: () => result, calls: () => calls }
}

test('invalid, foreign, stale, archived and unauthorized selections never fetch', async () => {
    const original = globalThis.fetch
    let fetches = 0
    globalThis.fetch = (async () => { fetches++; throw new Error('Unexpected request') }) as typeof fetch
    try {
        for (const ids of [[], Array.from({ length: 51 }, (_, i) => `a${i}`), ['a', 'a'], ['missing'], ['foreign'], ['archived'], ['dated'], ['a', 'foreign']]) await assert.rejects(fixture().actions.cleanupWatchlists(ids))
        await assert.rejects(fixture(items, 'org-two').actions.cleanupWatchlists(['a']))
        await assert.rejects(fixture(items, 'org-one', false).actions.cleanupWatchlists(['a']), /Not permitted/)
        assert.equal(fetches, 0)
    } finally { globalThis.fetch = original }
})

test('exact reviewed IDs and 50-term maximum submit once, with nested archive/skipped receipt', async () => {
    const original = globalThis.fetch
    const calls: Array<{ url: string, init?: RequestInit }> = []
    globalThis.fetch = (async (url, init) => { calls.push({ url: String(url), init }); return Response.json({ saved: true, cleanup: { archivedCount: 1, skippedItemIds: ['b'] } }) }) as typeof fetch
    try {
        const state = fixture()
        await state.actions.cleanupWatchlists(['b', 'a'])
        assert.equal(calls.length, 1)
        assert.equal(calls[0].url, '/api/organizations/org-one/watchlists/cleanup')
        assert.equal(calls[0].init?.method, 'POST')
        const body = JSON.parse(String(calls[0].init?.body))
        assert.deepEqual(body.itemIds, ['b', 'a'])
        assert.match(body.reason, /Selected shared watchlist terms archived/)
        assert.match(body.requestId, /^org-ui-/)
        assert.equal(state.result(), '1 selected watchlist term archived. 1 selected term was skipped.')
        const fifty = Array.from({ length: 50 }, (_, i) => item(`term${i}`))
        await fixture(fifty).actions.cleanupWatchlists(fifty.map(row => row.id))
        assert.equal(JSON.parse(String(calls[1].init?.body)).itemIds.length, 50)
    } finally { globalThis.fetch = original }
})

test('saved pending/failed projection remains a warning and never retries original archive', async () => {
    const original = globalThis.fetch
    let fetches = 0
    try {
        for (const status of ['pending', 'failed']) {
            globalThis.fetch = (async () => { fetches++; return Response.json({ saved: true, cleanup: { archivedCount: 1 }, dwmAlertBridge: { schemaVersion: 'organization.watchlist_projection_receipt.v1', projection: { status }, alertRebuild: { status: 'not_requested', reason: 'projection_only' } } }) }) as typeof fetch
            const state = fixture()
            await state.actions.cleanupWatchlists(['a'])
            const result = state.result()
            assert.equal(typeof result === 'object' && result?.warning, true)
            assert.match(typeof result === 'object' ? result?.message || '' : '', /1 selected watchlist term archived/)
            assert.match(typeof result === 'object' ? result?.message || '' : '', /Events were not rebuilt/)
            assert.equal(state.calls(), 1)
        }
        assert.equal(fetches, 2)
    } finally { globalThis.fetch = original }
})

test('zero is reported only from explicit receipt, not invented for missing receipt count', async () => {
    const original = globalThis.fetch
    try {
        for (const cleanup of [{ archivedCount: 0, skippedItemIds: ['a'] }, undefined]) {
            globalThis.fetch = (async () => Response.json({ saved: true, cleanup })) as typeof fetch
            const state = fixture()
            await state.actions.cleanupWatchlists(['a'])
            assert.equal(state.result(), cleanup ? '0 selected watchlist terms archived. 1 selected term was skipped.' : 'Selected watchlist archive request saved.')
        }
    } finally { globalThis.fetch = original }
})

test('organization/source changes invalidate selection scope and confirmation is keyed to selected IDs', () => {
    const key = watchlistCleanupSelectionKey('org-one', items)
    assert.equal(key, watchlistCleanupSelectionKey('org-one', [...items]))
    assert.notEqual(key, watchlistCleanupSelectionKey('org-two', items))
    for (const changed of [{ value: 'changed.test' }, { status: 'archived' }, { archivedAt: '2026-10-23' }, { organizationId: 'org-two' }]) assert.notEqual(key, watchlistCleanupSelectionKey('org-one', [item('a', changed), ...items.slice(1)]))
    const source = readFileSync(new URL('../src/app/organizations/components/watchlists.tsx', import.meta.url), 'utf8')
    assert.match(source, /key=\{watchlistCleanupSelectionKey\(organization.id, watchlists\)\}/)
    assert.match(source, /items=\{watchlists\}/)
    assert.doesNotMatch(source, /Cleanup archived/)
    const component = readFileSync(new URL('../src/app/organizations/components/watchlistCleanup.tsx', import.meta.url), 'utf8')
    assert.match(component, /ConfirmActionButton key=\{JSON.stringify\(selectedIds\)\}/)
    assert.match(component, /selectedIds.length >= 50/)
})

test('render exposes eligible unchecked terms only, reversible copy and disabled confirmation', () => {
    const html = renderToStaticMarkup(<WatchlistCleanup organizationId='org-one' items={items} disabled={false} onCleanup={() => { throw new Error('Render must not mutate') }} />)
    assert.equal((html.match(/type="checkbox"/g) || []).length, 2)
    assert.doesNotMatch(html, /checked=""|Select all|archived.test|dated.test|foreign.test/)
    assert.match(html, /0 of 50 selected/)
    assert.match(html, /you can restore them later/)
    assert.match(html, /disabled="" aria-label="Archive 0 selected watchlist terms"/)
    const busy = renderToStaticMarkup(<WatchlistCleanup organizationId='org-one' items={items} disabled onCleanup={() => {}} />)
    assert.match(busy, /<fieldset disabled=""/)
})
