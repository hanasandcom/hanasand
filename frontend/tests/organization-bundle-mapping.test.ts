import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { createInitialOrganizationBundle, mergeOrganizationPayload } from '../src/app/organizations/model/organizationBundle'

const organization = { id: 'org-1', name: 'Selected name', slug: 'selected-slug' } as const

function merge(key: Parameters<typeof mergeOrganizationPayload>[1], payload: Record<string, unknown>) {
    const bundle = createInitialOrganizationBundle()
    mergeOrganizationPayload(bundle, key, payload, organization)
    return bundle
}

test('settings payload prefers non-empty organization values and falls back to the selected organization', () => {
    const bundle = merge('settings', {
        settings: { retentionDays: 30 },
        organization: { name: ' Response name ', slug: '' },
    })

    assert.deepEqual(bundle.settings, { retentionDays: 30, name: 'Response name', slug: 'selected-slug' })
    assert.deepEqual(merge('settings', { settings: {} }).settings, {
        name: 'Selected name', slug: 'selected-slug',
    })
})

test('watchlist payload accepts each supported collection alias and normalizes alert generation references', () => {
    for (const key of ['watchlistItems', 'watchlists', 'items']) {
        const bundle = merge('watchlists', { [key]: [{ id: key, alertGenerationRef: { dedupe: { key: ' stable-ref ' } } }] })
        assert.deepEqual(bundle.watchlists, [{ id: key, alertGenerationRef: 'stable-ref' }], key)
    }
})

test('alert term payload accepts direct, exported, and legacy collection shapes', () => {
    const payloads = [
        { activeTerms: [{ id: 'direct' }] },
        { alertTermsExport: { activeTerms: [{ id: 'exported' }] } },
        { terms: [{ id: 'legacy' }] },
    ]
    assert.deepEqual(payloads.map(payload => merge('alertTerms', payload).alertTerms.map(term => term.id)), [
        ['direct'], ['exported'], ['legacy'],
    ])
})

test('activity payloads accept supported aliases for alerts, cases, webhooks, and deliveries', () => {
    const aliases = [
        { key: 'events' as const, aliases: ['alerts', 'items', 'results'] },
        { key: 'cases' as const, aliases: ['cases', 'items', 'results'] },
        { key: 'webhooks' as const, aliases: ['destinations', 'webhooks'] },
        { key: 'deliveries' as const, aliases: ['deliveries', 'items', 'results'] },
    ]
    for (const { key, aliases: payloadKeys } of aliases) {
        for (const payloadKey of payloadKeys) {
            const recordId = `${key}-${payloadKey}`
            const bundle = merge(key, { [payloadKey]: [{ id: recordId }] })
            const mapped = key === 'events' ? bundle.alerts : bundle[key]
            assert.deepEqual(mapped.map(row => row.id), [recordId], `${key}.${payloadKey}`)
        }
    }
})
