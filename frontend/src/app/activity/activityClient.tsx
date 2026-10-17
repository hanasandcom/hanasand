'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { formatClaimTime, mergeExposureQueueItems, type ExposureQueue } from '../exposureQueue'
import { requestExposureQueue } from '../requestExposureQueue'
import { ActivityFilters } from './ActivityFilters'
import { ActivityResults } from './ActivityResults'
import {
    activityFiltersFromUrl,
    activityFiltersToUrl,
    activityStatus,
    applyActivityFilters,
    emptyActivityFilters,
    type ActivityFilters as ActivityFilterValues,
} from './activityModel'

type Props = {
    initialQueue: ExposureQueue
}

const PAGE_SIZE = 50
const FILTER_QUERY_KEYS = ['company', 'actor', 'category', 'size', 'country', 'from', 'to'] as const

export default function ActivityClient({ initialQueue }: Props) {
    const [filters, setFilters] = useState<ActivityFilterValues>(() => emptyActivityFilters())
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [queue, setQueue] = useState(initialQueue)
    const [items, setItems] = useState(initialQueue.items)
    const [nextOffset, setNextOffset] = useState<number | null>(() => initialQueue.page?.nextOffset ?? (initialQueue.items.length >= PAGE_SIZE ? initialQueue.items.length : null))
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState('')
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const didSyncUrlRef = useRef(false)

    const fetchQueue = useCallback(async (offset = 0) => {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
        if (filters.q) params.set('q', filters.q)
        for (const key of FILTER_QUERY_KEYS) {
            if (filters[key]) params.set(key, filters[key])
        }
        return requestExposureQueue(params)
    }, [filters])

    const replace = useCallback(async () => {
        setLoading(true)
        try {
            const next = await fetchQueue(0)
            setQueue(next)
            setItems(next.items)
            setNextOffset(next.page?.nextOffset ?? null)
            setError('')
        } catch {
            setError('Activity could not refresh. Try again shortly.')
        } finally {
            setLoading(false)
        }
    }, [fetchQueue])

    const loadMore = useCallback(async () => {
        if (loadingMore || nextOffset === null) return
        setLoadingMore(true)
        try {
            const next = await fetchQueue(nextOffset)
            setQueue(next)
            setItems(current => mergeExposureQueueItems(current, next.items, 'append'))
            setNextOffset(next.page?.nextOffset ?? null)
            setError('')
        } catch {
            setError('More activity could not load. Try again shortly.')
        } finally {
            setLoadingMore(false)
        }
    }, [fetchQueue, loadingMore, nextOffset])

    useEffect(() => {
        if (!didSyncUrlRef.current) {
            didSyncUrlRef.current = true
            return
        }
        const params = activityFiltersToUrl(filters)
        window.history.replaceState(null, '', params.size ? `/activity?${params.toString()}` : '/activity')
    }, [filters])

    useEffect(() => {
        setFilters(activityFiltersFromUrl(new URLSearchParams(window.location.search)))
    }, [])

    useEffect(() => {
        const timer = window.setTimeout(() => void replace(), 250)
        return () => window.clearTimeout(timer)
    }, [replace])

    useEffect(() => {
        const node = sentinelRef.current
        if (!node) return
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) void loadMore()
        }, { rootMargin: '520px 0px' })
        observer.observe(node)
        return () => observer.disconnect()
    }, [loadMore])

    const visibleItems = useMemo(() => applyActivityFilters(items, filters), [filters, items])
    const total = queue.page?.total ?? queue.counts?.total ?? items.length
    const newest = visibleItems[0]?.claimTime || visibleItems[0]?.collectedAt || queue.freshness?.latestClaimAt

    function changeFilter(key: keyof ActivityFilterValues, value: string) {
        setFilters(current => ({ ...current, [key]: value }))
    }

    return <main className='flex h-app-viewport min-h-full flex-col bg-ui-canvas text-ui-text'>
        <section className='border-b border-ui-border bg-ui-panel px-4 py-4 md:px-6'>
            <div className='flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>Activity</p>
                    <h1 className='mt-1 text-2xl font-semibold tracking-normal text-ui-text md:text-3xl'>Latest company mentions</h1>
                    <p className='mt-1 text-sm text-ui-muted'>{activityStatus(queue.status, visibleItems.length, total)} · latest {formatClaimTime(newest)}</p>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    <button type='button' onClick={() => void replace()} disabled={loading} className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary disabled:cursor-wait disabled:opacity-60'>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
                    </button>
                    <Link href='/findings' className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-text px-3 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                        <ShieldCheck className='h-4 w-4' />Dark web cases
                    </Link>
                </div>
            </div>
        </section>
        <ActivityFilters
            filters={filters}
            open={filtersOpen}
            onToggle={() => setFiltersOpen(open => !open)}
            onChange={changeFilter}
            onClear={() => setFilters(emptyActivityFilters())}
        />
        <ActivityResults items={visibleItems} status={queue.status} loadingMore={loadingMore} nextOffset={nextOffset} sentinelRef={sentinelRef} />
        {error ? <p className='border-t border-ui-danger/35 bg-ui-raised/10 px-4 py-2 text-xs font-semibold text-ui-text'>{error}</p> : null}
    </main>
}
