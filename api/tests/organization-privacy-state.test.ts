import { expect, test } from 'bun:test'
import { organizationPrivacyStateReadModel } from '../src/utils/organizationPrivacy.ts'

test('organization privacy read model keeps the page cursor tied to remaining items', () => {
    const page = (itemOffset: number, items: unknown[], totalRetentionItems: number | string) => organizationPrivacyStateReadModel({
        organization: { id: 'org-a' },
        runs: [],
        requests: [],
        items,
        page: { itemOffset, itemLimit: 2 },
        totalRetentionItems,
        protection: { total_retention_items: totalRetentionItems, protected_events: 1 },
    })

    const first = page(0, [{ id: 'item-a' }, { id: 'item-b' }], '3')
    expect(first.schemaVersion).toBe('organization.privacy_state.v1')
    expect(first.itemPage).toEqual({ offset: 0, limit: 2, nextOffset: 2 })
    expect(first.protection).toMatchObject({ total_retention_items: '3', protected_events: 1 })

    expect(page(2, [{ id: 'item-c' }], 3).itemPage).toEqual({ offset: 2, limit: 2, nextOffset: null })
    expect(page(0, [], 0).itemPage).toEqual({ offset: 0, limit: 2, nextOffset: null })
})
