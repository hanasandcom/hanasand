'use client'

import { useMemo } from 'react'
import type { ExposureQueue } from './exposureQueue'
import { HomepageActivityFeedView } from './homepageActivityFeedView'
import { useHomepageActivityFeed } from './useHomepageActivityFeed'

type Props = {
    initialQueue: ExposureQueue
}

export default function HomepageActivityFeed({ initialQueue }: Props) {
    const feed = useHomepageActivityFeed(initialQueue)
    const visibleItems = useMemo(() => feed.items.slice(0, feed.visibleCount), [feed.items, feed.visibleCount])
    const total = feed.queue.page?.total ?? feed.queue.counts?.total ?? feed.items.length

    return (
        <HomepageActivityFeedView
            queue={feed.queue}
            items={feed.items}
            visibleItems={visibleItems}
            total={total}
            loadingMore={feed.loadingMore}
            refreshing={feed.refreshing}
            error={feed.error}
            visibleCount={feed.visibleCount}
            nextOffset={feed.nextOffset}
            sentinelRef={feed.sentinelRef}
            viewportRef={feed.viewportRef}
            onRefresh={() => void feed.refresh()}
        />
    )
}
