import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { organizationBundleKeysByPage } from '../src/app/organizations/model/organizationBundle'

const pageDataContract = {
    overview: ['settings', 'members', 'invites', 'watchlists', 'alertTerms', 'events', 'cases', 'webhooks', 'deliveries'],
    settings: ['settings'],
    team: ['members', 'invites'],
    watchlists: ['members', 'watchlists', 'alertTerms', 'events', 'webhooks', 'deliveries'],
    'api-keys': ['apiKeys'],
    privacy: ['settings', 'privacy'],
    events: ['alertTerms', 'events', 'cases', 'deliveries', 'members', 'watchlists', 'webhooks', 'alertCaseVisibility'],
    activity: ['settings', 'members', 'invites', 'watchlists', 'alertTerms', 'events', 'cases', 'webhooks', 'deliveries'],
} as const

test('organization page bundle requests match their data contract', () => {
    assert.deepEqual(Object.keys(organizationBundleKeysByPage).sort(), Object.keys(pageDataContract).sort())
    for (const [page, expectedKeys] of Object.entries(pageDataContract)) {
        assert.deepEqual(
            [...organizationBundleKeysByPage[page as keyof typeof pageDataContract]].sort(),
            [...expectedKeys].sort(),
            `${page} page data contract`,
        )
    }
})
