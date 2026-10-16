import { useCallback, useEffect, useRef, useState } from 'react'
import { dedupeItems, mergeExposureQueueItems, normalizeExposureQueue, type ExposureQueue } from './exposureQueue'
import { HOMEPAGE_ACTIVITY_CACHE_KEY, HOMEPAGE_ACTIVITY_CACHE_SIZE, restoreCachedActivity, serializeCachedActivity } from './homepageActivityFeedState'

const PAGE_SIZE = 10
const REFRESH_MS = 300_000

export function useHomepageActivityFeed(initialQueue: ExposureQueue) {
    const [queue, setQueue] = useState(initialQueue)
    const [items, setItems] = useState(() => dedupeItems(initialQueue.items))
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
    const [nextOffset, setNextOffset] = useState<number | null>(() => initialQueue.page?.nextOffset ?? (initialQueue.items.length >= PAGE_SIZE ? initialQueue.items.length : null))
    const [loadingMore, setLoadingMore] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')
    const [cacheReady, setCacheReady] = useState(false)
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const itemsRef = useRef(items)

    useEffect(() => {
        itemsRef.current = items
    }, [items])

    useEffect(() => {
        try {
            const cached = window.localStorage.getItem(HOMEPAGE_ACTIVITY_CACHE_KEY)
            if (!initialQueue.items.length && cached) {
                const restored = restoreCachedActivity(cached)
                if (restored) {
                    setQueue(restored.queue)
                    setItems(restored.items)
                    setNextOffset(restored.nextOffset)
                }
            }
        } catch {
            // Storage can be unavailable or contain data from an older version.
        }
        setCacheReady(true)
    }, [initialQueue.items.length])

    useEffect(() => {
        if (!cacheReady || !items.length) return
        try {
            const cachedQueue = serializeCachedActivity(queue, items)
            window.localStorage.setItem(HOMEPAGE_ACTIVITY_CACHE_KEY, JSON.stringify(cachedQueue))
        } catch {
            // Storage quota and privacy settings must not interrupt the live feed.
        }
    }, [cacheReady, items, queue])

    const mergeQueue = useCallback((nextQueue: ExposureQueue, mode: 'replace' | 'append') => {
        setQueue(nextQueue)
        setItems((current) => mergeExposureQueueItems(current, nextQueue.items, mode))
        setNextOffset(nextQueue.page?.nextOffset ?? null)
    }, [])

    const fetchQueue = useCallback(async (offset = 0, limit = PAGE_SIZE) => {
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
        const response = await fetch(`/api/public/exposure-queue?${params.toString()}`, { cache: 'default' })
        if (!response.ok && response.status !== 202) throw new Error(`activity-status:${response.status}`)
        return normalizeExposureQueue(await response.json())
    }, [])

    const refresh = useCallback(async () => {
        setRefreshing(true)
        try {
            const next = await fetchQueue(0, HOMEPAGE_ACTIVITY_CACHE_SIZE)
            mergeQueue(next, 'replace')
            setError('')
        } catch (reason) {
            if (!itemsRef.current.length) setError(activityErrorMessage(reason))
        } finally {
            setRefreshing(false)
        }
    }, [fetchQueue, mergeQueue])

    const loadMore = useCallback(async () => {
        if (loadingMore) return
        if (visibleCount < itemsRef.current.length) {
            setVisibleCount((current) => Math.min(current + PAGE_SIZE, itemsRef.current.length))
            return
        }
        if (nextOffset === null) return
        setLoadingMore(true)
        try {
            const next = await fetchQueue(nextOffset)
            mergeQueue(next, 'append')
            setVisibleCount((current) => current + PAGE_SIZE)
            setError('')
        } catch (reason) {
            if (!itemsRef.current.length) setError(activityErrorMessage(reason))
        } finally {
            setLoadingMore(false)
        }
    }, [fetchQueue, loadingMore, mergeQueue, nextOffset, visibleCount])

    useEffect(() => {
        if (initialQueue.status === 'checking' || initialQueue.status === 'unavailable') {
            void refresh()
        }
    }, [initialQueue.status, refresh])

    useEffect(() => {
        const timer = window.setInterval(() => {
            void refresh()
        }, REFRESH_MS)
        return () => window.clearInterval(timer)
    }, [refresh])

    useEffect(() => {
        const node = sentinelRef.current
        if (!node) return
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                void loadMore()
            }
        }, { root: viewportRef.current, rootMargin: '160px 0px' })
        observer.observe(node)
        return () => observer.disconnect()
    }, [loadMore])

    return { queue, items, visibleCount, nextOffset, loadingMore, refreshing, error, sentinelRef, viewportRef, refresh, loadMore }
}

function activityErrorMessage(reason: unknown) {
    const message = reason instanceof Error ? reason.message : String(reason)
    const status = message.match(/\b(4\d\d|5\d\d)\b/)?.[1]
    if (status) return 'Activity is temporarily unavailable. Try again shortly.'
    return 'Activity could not be updated. Try again shortly.'
}
