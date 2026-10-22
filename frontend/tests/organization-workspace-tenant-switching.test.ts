import assert from 'node:assert/strict'
import { afterAll, afterEach, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { initialOrganizationBundle } from '../src/app/organizations/model/organizationBundle'
import { organizationWorkspaceSelectionHref, requestedSubjectFromSearch } from '../src/app/organizations/model/activityNavigation'
import { inviteEmailConflicts, memberCanMutate, memberMutationDisabledReason } from '../src/app/organizations/model/forms'
import { isDuplicateWatchlistTerm } from '../src/app/organizations/model/watchlists'
import { watchlistMutationMessage } from '../src/app/organizations/model/workspaceApi'
import { WatchlistPanel } from '../src/app/organizations/components/watchlists'
import type { WatchlistItem } from '../src/app/organizations/types/watchlists'

const originalFetch = globalThis.fetch
const originalAuthApi = process.env.FRONTEND_AUTH_API
const cookieValues = new Map([
    ['access_token', 'workspace-session'],
    ['id', 'workspace-user'],
])

process.env.FRONTEND_AUTH_API = 'https://auth.example.test/api'
mock.module('next/headers', () => ({
    headers: async () => new Headers(),
    cookies: async () => ({ get: name => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined }),
}))

afterEach(() => { globalThis.fetch = originalFetch })
afterAll(() => {
    if (originalAuthApi === undefined) delete process.env.FRONTEND_AUTH_API
    else process.env.FRONTEND_AUTH_API = originalAuthApi
})

test('organization proxy routes forward the selected tenant to the matching upstream scope', async () => {
    const calls: Array<{ url: URL, headers: Headers }> = []
    globalThis.fetch = (async (input, init) => {
        calls.push({ url: new URL(String(input)), headers: new Headers(init?.headers) })
        return Response.json({ ok: true })
    }) as typeof fetch

    const { GET: getDestinations } = await import('../src/app/api/organizations/[id]/webhooks/route')
    const { GET: getDeliveries } = await import('../src/app/api/findings/webhooks/deliveries/route')
    const organizationId = 'org/acme'
    const headers = { authorization: 'Bearer request-session', id: 'request-user', 'x-tenant-id': 'tenant-acme' }

    const destinations = await getDestinations(
        new NextRequest('https://app.test/api/organizations/org%2Facme/webhooks', { headers }),
        { params: Promise.resolve({ id: organizationId }) },
    )
    assert.equal(destinations.status, 200)
    await getDeliveries(new NextRequest(
        `https://app.test/api/findings/webhooks/deliveries?organizationId=${encodeURIComponent(organizationId)}&status=failed`,
        { headers },
    ))

    assert.equal(calls.length, 2)
    assert.equal(calls[0].url.pathname, '/api/dwm/webhook-destinations')
    assert.equal(calls[0].url.searchParams.get('orgId'), organizationId)
    assert.equal(calls[1].url.pathname, '/api/dwm/webhook-deliveries')
    assert.equal(calls[1].url.searchParams.get('organizationId'), organizationId)
    assert.equal(calls[1].url.searchParams.get('orgId'), organizationId)
    assert.equal(calls[1].url.searchParams.get('status'), 'failed')
    for (const call of calls) {
        assert.equal(call.headers.get('authorization'), 'Bearer workspace-session')
        assert.equal(call.headers.get('id'), 'workspace-user')
        assert.equal(call.headers.get('x-tenant-id'), 'tenant-acme')
    }
})

test('selected activity subjects update query state and restore from the selected id', () => {
    const originalWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { location: { href: 'https://app.test/organizations?organizationId=old&focus=members&memberId=old&alert=old&filter=active#team' } },
    })
    try {
        const bundle = {
            ...initialOrganizationBundle,
            invites: [{ id: 'invite-1', email: 'new@example.test', role: 'member' as const, status: 'pending' }],
            members: [{ userId: 'member-1', role: 'reader' as const, status: 'active' }],
            watchlists: [{ id: 'watch-1', kind: 'domain' as const, value: 'example.test', status: 'active' }],
            webhooks: [{ id: 'destination-1' }],
            alerts: [{ id: 'alert-1' }],
            cases: [{ id: 'case-1' }],
        }
        const subjects = [
            { type: 'invite' as const, id: 'invite-1', focus: 'invites', key: 'inviteId' },
            { type: 'member' as const, id: 'member-1', focus: 'members', key: 'memberId' },
            { type: 'watchlist' as const, id: 'watch-1', focus: 'watchlists', key: 'watchlistId' },
            { type: 'destination' as const, id: 'destination-1', focus: 'destinations', key: 'destinationId' },
            { type: 'alert' as const, id: 'alert-1', focus: 'events', key: 'alertId' },
            { type: 'case' as const, id: 'case-1', focus: 'cases', key: 'caseId' },
        ]
        for (const subject of subjects) {
            const url = new URL(organizationWorkspaceSelectionHref('org/new', subject))
            assert.equal(url.searchParams.get('org'), 'org/new')
            assert.equal(url.searchParams.get('focus'), subject.focus)
            assert.equal(url.searchParams.get(subject.key), subject.id)
            assert.equal(url.searchParams.has('alert'), false)
            const restored = requestedSubjectFromSearch({
                organizationId: 'org/new', focus: subject.focus, inviteId: url.searchParams.get('inviteId') || '',
                memberId: url.searchParams.get('memberId') || '', watchlistId: url.searchParams.get('watchlistId') || '',
                destinationId: url.searchParams.get('destinationId') || '', deliveryId: '',
                alertId: url.searchParams.get('alertId') || '', caseId: url.searchParams.get('caseId') || '',
            }, bundle)
            assert.deepEqual(restored, { type: subject.type, id: subject.id })
        }
    } finally {
        if (originalWindow === undefined) Reflect.deleteProperty(globalThis, 'window')
        else Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
    }
})

test('invite conflicts and closed member states do not allow repeated access changes', () => {
    const invites = [
        { id: 'pending', email: 'pending@example.test', role: 'member' as const, status: 'pending' },
        { id: 'revoked', email: 'revoked@example.test', role: 'member' as const, status: 'revoked' },
        { id: 'expired', email: 'expired@example.test', role: 'member' as const, status: 'expired' },
    ]
    const members = [
        { userId: 'active-user', email: 'active@example.test', role: 'reader' as const, status: 'active' },
        { userId: 'removed-user', email: 'removed@example.test', role: 'reader' as const, status: 'removed' },
        { userId: 'inactive-user', email: 'inactive@example.test', role: 'reader' as const, status: 'inactive' },
        { userId: 'revoked-user', email: 'revoked-member@example.test', role: 'reader' as const, status: 'revoked' },
    ]
    assert.deepEqual(inviteEmailConflicts([
        'PENDING@example.test', 'active@example.test', 'revoked@example.test', 'expired@example.test',
        'removed@example.test', 'inactive@example.test', 'revoked-member@example.test',
    ], invites, members), ['PENDING@example.test', 'active@example.test'])
    const owner = { userId: 'owner', role: 'owner' as const, status: 'active' }
    assert.equal(memberCanMutate(owner), false)
    assert.equal(memberMutationDisabledReason(true, owner), 'Owner role cannot be changed here')
    for (const status of ['removed', 'revoked', 'inactive']) {
        const member = { userId: status, role: 'reader' as const, status }
        assert.equal(memberCanMutate(member), false)
        assert.equal(memberMutationDisabledReason(true, member), 'Access is closed')
    }
    const active = { userId: 'active', role: 'reader' as const, status: 'active' }
    assert.equal(memberCanMutate(active), true)
    assert.equal(memberMutationDisabledReason(true, active), '')
    assert.equal(memberMutationDisabledReason(false, active), 'Owner or admin required')
})

test('watchlist creation disables blank and duplicate terms', () => {
    const item: WatchlistItem = { id: 'watch-1', kind: 'domain', value: 'example.test', status: 'active' }
    const renderPanel = (value: string, duplicate: boolean) => renderToStaticMarkup(createElement(WatchlistPanel, {
        watchlists: [item], activeTerms: [], members: [], canManage: true, canCleanup: true, busy: '',
        draft: { kind: 'domain', value, notes: '' }, setDraft: () => {}, suggestions: [], editing: {}, setEditing: () => {},
        onCreate: () => {}, onSave: () => {}, onAction: () => {}, onDelete: () => {},
        organization: { id: 'org-1', name: 'Example' }, alerts: [], deliveries: [], onCleanup: () => {},
        onRefreshAlerts: () => {}, onRequestFreshCollection: () => {}, onRefreshCollectionStatus: () => {},
        collectionRequest: null, rowMessages: {}, draftDuplicate: duplicate,
        selectedSubject: { type: 'organization', id: 'org-1' }, onSelectSubject: () => {},
    }))
    const addButton = (html: string) => html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find(button => button.includes('Add term')) || ''

    assert.equal(isDuplicateWatchlistTerm([item], 'domain', 'https://www.example.test/'), true)
    assert.match(addButton(renderPanel('', false)), /disabled=""/)
    assert.match(addButton(renderPanel('example.test', true)), /disabled=""/)
    assert.doesNotMatch(addButton(renderPanel('new.example.test', false)), /disabled=""/)
})

test('watchlist mutation feedback distinguishes generated events from empty captures', () => {
    assert.match(String(watchlistMutationMessage({ ok: true, savedAlertCount: 2 }, 'Term saved.')), /2 events generated/)
    assert.equal(watchlistMutationMessage({ ok: true, matchedTerms: ['example.test'] }, 'Term saved.'), 'Term saved. No matching captures found for example.test.')
})
