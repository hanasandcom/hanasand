// @ts-expect-error Bun provides this module when running focused tests.
import { expect, test } from 'bun:test'
import { restoreCachedActivity, serializeCachedActivity } from '@/app/homepageActivityFeedState'
import type { ExposureQueue } from '@/app/exposureQueue'

function queue(items: ExposureQueue['items'], status: ExposureQueue['status'] = 'live'): ExposureQueue {
    return { generatedAt: '2026-10-16T10:00:00.000Z', status, items, counts: { total: items.length } }
}

function item(id: string): ExposureQueue['items'][number] {
    return { id, actor: 'Actor', company: 'Company', claimedData: 'Data', claimedDataSize: 'Small', status: 'unverified' }
}

test('homepage cache stores bounded stale rows and restores page state', () => {
    const items = Array.from({ length: 120 }, (_, index) => item(`item-${index}`))
    const serialized = serializeCachedActivity(queue(items), items)
    expect(serialized.items).toHaveLength(100)
    expect(serialized.status).toBe('stale')
    expect(serialized.page).toMatchObject({ limit: 100, offset: 0, total: 120, nextOffset: 100, hasMore: true })

    const restored = restoreCachedActivity(JSON.stringify(serialized))
    expect(restored?.items.map(({ id }) => id)).toEqual(items.slice(0, 100).map(({ id }) => id))
    expect(restored?.queue.status).toBe('stale')
    expect(restored?.nextOffset).toBe(100)
})

test('homepage cache keeps explicit exhaustion and ignores empty cache payloads', () => {
    const saved = serializeCachedActivity(queue([item('last')]), [item('last')])
    expect(saved.page).toMatchObject({ total: 1, nextOffset: null, hasMore: false })
    expect(restoreCachedActivity(JSON.stringify(saved))?.nextOffset).toBeNull()
    expect(restoreCachedActivity(JSON.stringify(queue([])))).toBeNull()
})
