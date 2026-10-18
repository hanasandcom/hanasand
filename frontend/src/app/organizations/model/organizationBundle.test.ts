import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInitialOrganizationBundle, initialOrganizationBundle } from './organizationBundle'

test('organization bundle defaults are empty and isolated between workspace states', () => {
    const first = createInitialOrganizationBundle()
    const second = createInitialOrganizationBundle()

    assert.deepEqual(first, initialOrganizationBundle)
    for (const collection of ['members', 'invites', 'watchlists', 'alertTerms', 'alerts', 'cases', 'webhooks', 'deliveries', 'apiKeys', 'loadErrors'] as const) {
        assert.notEqual(first[collection], second[collection], `${collection} should not be shared`)
    }
    first.members.push({ userId: 'member', role: 'reader', status: 'active' })
    assert.deepEqual(second.members, [])
    assert.deepEqual(initialOrganizationBundle.members, [])
})
