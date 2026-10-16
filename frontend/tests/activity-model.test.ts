import { describe, expect, test } from 'bun:test'
import type { ExposureQueueItem } from '../src/app/exposureQueue'
import {
    activityFiltersFromUrl,
    activityFiltersToUrl,
    applyActivityFilters,
    emptyActivityFilters,
} from '../src/app/activity/activityModel'

describe('activity filter model', () => {
    test('preserves supported URL filters and the legacy data alias', () => {
        const filters = activityFiltersFromUrl(new URLSearchParams('q=leak&data=documents&country=NO'))
        expect(filters).toMatchObject({ q: 'leak', category: 'documents', country: 'NO' })
        expect(activityFiltersToUrl(filters).toString()).toBe('q=leak&category=documents&country=NO')
    })

    test('matches company, category, and inclusive UTC date bounds together', () => {
        const filters = { ...emptyActivityFilters(), company: 'north', category: 'document', from: '2026-07-01', to: '2026-07-01' }
        const items = [
            item('start-boundary', 'Northwind', 'Documents', '2026-07-01T00:00:00.000Z'),
            item('inside', 'Northwind', 'Documents', '2026-07-01T12:00:00.000Z'),
            item('end-boundary', 'Northwind', 'Documents', '2026-07-01T23:59:59.999Z'),
            item('before', 'Northwind', 'Documents', '2026-06-30T23:59:59.000Z'),
            item('wrong-company', 'Southwind', 'Documents', '2026-07-01T12:00:00.000Z'),
        ]

        expect(applyActivityFilters(items, filters).map(entry => entry.id)).toEqual(['start-boundary', 'inside', 'end-boundary'])
    })

    test('searches across actor, company, data, size, country, and source', () => {
        const source = item('source', 'Northwind', 'Documents', '2026-07-01T12:00:00.000Z')
        source.actor = 'Red Crew'
        source.claimedDataSize = '5GB'
        source.country = 'Norway'
        source.sourceName = 'Exposure Feed'

        for (const q of ['crew', 'northwind', 'document', '5gb', 'norway', 'exposure feed']) {
            expect(applyActivityFilters([source], { ...emptyActivityFilters(), q })).toHaveLength(1)
        }
    })
})

function item(id: string, company: string, claimedData: string, claimTime: string): ExposureQueueItem {
    return { id, company, claimedData, claimTime, actor: 'Unknown actor', claimedDataSize: 'Unknown size', status: 'unverified' }
}
