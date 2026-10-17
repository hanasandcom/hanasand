'use client'

import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react'
import { RecentTrafficTable } from '@/components/monitoring/traffic/traffic'
import { getTrafficRecords } from '@/utils/monitoring/data'
import { isTrafficRecords } from '@/utils/monitoring/trafficValidation'
import type { TrafficRecords } from '@/utils/monitoring/types'
import { startTrafficSnapshotRefresh, type TrafficSnapshot } from '@/components/monitoring/traffic/trafficSnapshotRefresh'

const INITIAL_VISIBLE_COUNT = 100
const LOAD_MORE_COUNT = 10
const PREFETCH_AHEAD_COUNT = LOAD_MORE_COUNT * 2

export default function TrafficRecentClient({ initialRecords, selectedDomain }: {
    initialRecords: TrafficRecords
    selectedDomain?: string
}) {
    const [records, setRecords] = useState(initialRecords.result)
    const [visibleCount, setVisibleCount] = useState(Math.min(INITIAL_VISIBLE_COUNT, initialRecords.result.length))
    const [total, setTotal] = useState(initialRecords.total)
    const [loadingMore, setLoadingMore] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const recordsRef = useRef(initialRecords.result)
    const visibleCountRef = useRef(Math.min(INITIAL_VISIBLE_COUNT, initialRecords.result.length))
    const totalRef = useRef(initialRecords.total)
    const nextOffsetRef = useRef(initialRecords.result.length)
    const pendingFetchRef = useRef<Promise<number> | null>(null)
    const loadingMoreRef = useRef(false)
    const mountedRef = useRef(false)

    const fetchNextPage = useCallback(() => {
        if (pendingFetchRef.current) return pendingFetchRef.current

        const offset = nextOffsetRef.current
        if (offset >= totalRef.current) return Promise.resolve(0)

        const page = Math.floor(offset / LOAD_MORE_COUNT) + 1
        const request = getTrafficRecords(selectedDomain, LOAD_MORE_COUNT, page).then(result => {
            if (typeof result === 'string') throw new Error(result)
            if (!isTrafficRecords(result)) throw new Error('Traffic records response is invalid')
            if (!mountedRef.current) return 0

            totalRef.current = result.total
            nextOffsetRef.current = offset + LOAD_MORE_COUNT
            setTotal(result.total)
            const ids = new Set(recordsRef.current.map(record => record.id))
            const merged = [...recordsRef.current, ...result.result.filter(record => !ids.has(record.id))]
            recordsRef.current = merged
            setRecords(merged)
            return result.result.length
        }).finally(() => {
            pendingFetchRef.current = null
        })

        pendingFetchRef.current = request
        return request
    }, [selectedDomain])

    const loadMore = useCallback(async () => {
        if (loadingMoreRef.current) return

        const available = recordsRef.current.length - visibleCountRef.current
        if (available > 0) {
            const nextCount = Math.min(visibleCountRef.current + LOAD_MORE_COUNT, recordsRef.current.length)
            visibleCountRef.current = nextCount
            setVisibleCount(nextCount)
            setLoadError(null)
            return
        }

        if (nextOffsetRef.current >= totalRef.current) return

        loadingMoreRef.current = true
        setLoadingMore(true)
        setLoadError(null)
        try {
            const count = await fetchNextPage()
            if (count > 0 && mountedRef.current) {
                const nextCount = Math.min(visibleCountRef.current + LOAD_MORE_COUNT, recordsRef.current.length)
                visibleCountRef.current = nextCount
                setVisibleCount(nextCount)
            }
        } catch {
            if (mountedRef.current) setLoadError('Could not load more requests. Try again.')
        } finally {
            loadingMoreRef.current = false
            if (mountedRef.current) setLoadingMore(false)
        }
    }, [fetchNextPage])

    const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
        const element = event.currentTarget
        const remaining = element.scrollHeight - element.scrollTop - element.clientHeight
        if (remaining <= Math.max(160, element.clientHeight * 0.5)) void loadMore()
    }, [loadMore])

    const applySnapshot = useCallback((snapshot: TrafficSnapshot) => {
        if (!isTrafficRecords(snapshot.records)) return

        const latest = snapshot.records.result.slice(0, INITIAL_VISIBLE_COUNT)
        totalRef.current = snapshot.records.total
        setTotal(snapshot.records.total)
        const latestIds = new Set(latest.map(record => record.id))
        const merged = [...latest, ...recordsRef.current.filter(record => !latestIds.has(record.id))]
        recordsRef.current = merged
        setRecords(merged)
    }, [])

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    useEffect(() => {
        if (nextOffsetRef.current < visibleCount + PREFETCH_AHEAD_COUNT && nextOffsetRef.current < total) {
            void fetchNextPage().catch(() => {})
        }
    }, [fetchNextPage, records.length, total, visibleCount])

    useEffect(() => {
        return startTrafficSnapshotRefresh(selectedDomain, applySnapshot, INITIAL_VISIBLE_COUNT)
    }, [selectedDomain, applySnapshot])

    return <RecentTrafficTable
        records={records.slice(0, visibleCount)}
        scrollContainerRef={scrollContainerRef}
        hasMore={records.length < total || nextOffsetRef.current < total}
        loadingMore={loadingMore}
        loadError={loadError}
        onLoadMore={loadMore}
        onScroll={handleScroll}
    />
}
