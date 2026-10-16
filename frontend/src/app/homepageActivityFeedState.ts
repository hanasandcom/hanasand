import { normalizeExposureQueue, type ExposureQueue, type ExposureQueueItem } from './exposureQueue'

export const HOMEPAGE_ACTIVITY_CACHE_KEY = 'hanasand-home-exposure-queue-v1'
export const HOMEPAGE_ACTIVITY_CACHE_SIZE = 100

export type CachedActivityState = {
    queue: ExposureQueue
    items: ExposureQueueItem[]
    nextOffset: number | null
}

export function restoreCachedActivity(raw: string): CachedActivityState | null {
    const saved = normalizeExposureQueue(JSON.parse(raw))
    if (!saved.items.length) return null

    const items = saved.items.slice(0, HOMEPAGE_ACTIVITY_CACHE_SIZE)
    const total = saved.page?.total ?? saved.counts?.total
    const hasMore = typeof total === 'number'
        ? total > items.length
        : typeof saved.page?.hasMore === 'boolean'
            ? saved.page.hasMore
            : typeof saved.page?.nextOffset === 'number' || items.length >= HOMEPAGE_ACTIVITY_CACHE_SIZE
    const nextOffset = hasMore ? items.length : null
    return {
        queue: {
            ...saved,
            status: 'stale',
            page: { ...saved.page, limit: HOMEPAGE_ACTIVITY_CACHE_SIZE, offset: 0, total, nextOffset, hasMore },
        },
        items,
        nextOffset,
    }
}

export function serializeCachedActivity(queue: ExposureQueue, items: ExposureQueueItem[]) {
    const cachedItems = items.slice(0, HOMEPAGE_ACTIVITY_CACHE_SIZE)
    const total = queue.page?.total ?? queue.counts?.total
    const hasMore = typeof total === 'number'
        ? total > cachedItems.length
        : typeof queue.page?.hasMore === 'boolean'
            ? queue.page.hasMore
            : typeof queue.page?.nextOffset === 'number'
    return {
        ...queue,
        status: queue.status === 'live' ? 'stale' : queue.status,
        page: {
            ...queue.page,
            limit: HOMEPAGE_ACTIVITY_CACHE_SIZE,
            offset: 0,
            total,
            nextOffset: hasMore ? cachedItems.length : null,
            hasMore,
        },
        items: cachedItems,
    }
}
