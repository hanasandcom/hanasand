import type { ExposureQueueItem } from '../exposureQueue'
import { formatClaimTime } from '../exposureQueue'
import Marquee from '@/components/shared/marquee'
import { emptyActivityDetail, emptyActivityTitle } from './activityModel'

type Props = {
    items: ExposureQueueItem[]
    status: string
    loadingMore: boolean
    nextOffset: number | null
    sentinelRef: { current: HTMLDivElement | null }
}

export function ActivityResults({ items, status, loadingMore, nextOffset, sentinelRef }: Props) {
    return <section className='min-h-0 flex-1 overflow-auto'>
        <div className='hidden min-w-[76rem] xl:block'>
            <ActivityTable items={items} status={status} />
        </div>
        <div className='divide-y divide-ui-border bg-ui-panel xl:hidden'>
            {items.map(item => <ActivityCard key={item.id} item={item} />)}
            {!items.length ? <EmptyActivity status={status} className='px-4 py-10 sm:px-6' /> : null}
        </div>
        <div ref={sentinelRef} className='px-4 py-6 text-center text-xs text-ui-muted'>
            {loadingMore ? 'Loading more activity...' : nextOffset !== null ? 'Scroll for more' : items.length ? 'End of loaded activity' : ''}
        </div>
    </section>
}

function ActivityTable({ items, status }: Pick<Props, 'items' | 'status'>) {
    return <>
        <div className='sticky top-0 z-10 grid grid-cols-[8rem_minmax(14rem,1fr)_minmax(14rem,1fr)_12rem_10rem_9rem_12rem] gap-3 border-b border-ui-border bg-ui-raised px-4 py-2 text-[0.68rem] font-semibold uppercase text-ui-muted md:px-6'>
            <span>Seen</span><span>Actor</span><span>Company</span><span>Data</span><span>Size</span><span>Country</span><span>Source</span>
        </div>
        <div className='divide-y divide-ui-border bg-ui-panel'>
            {items.map(item => <ActivityRow key={item.id} item={item} />)}
            {!items.length ? <EmptyActivity status={status} className='px-6 py-12' /> : null}
        </div>
    </>
}

function EmptyActivity({ status, className }: { status: string, className: string }) {
    return <div className={`grid gap-2 text-sm ${className}`}>
        <p className='font-semibold text-ui-text'>{emptyActivityTitle(status)}</p>
        <p className='text-ui-muted'>{emptyActivityDetail(status)}</p>
    </div>
}

function ActivityCard({ item }: { item: ExposureQueueItem }) {
    const timestamp = item.claimTime || item.collectedAt
    return <article className='grid min-w-0 gap-3 px-4 py-4 sm:px-6'>
        <div className='flex min-w-0 items-start justify-between gap-3'>
            <div className='min-w-0'>
                <p className='wrap-break-word font-semibold text-ui-text'>{item.company}</p>
                <p className='mt-0.5 wrap-break-word text-sm text-ui-muted'>{item.actor}</p>
            </div>
            <time dateTime={timestamp} className='shrink-0 text-right text-xs font-semibold text-ui-muted'>{formatClaimTime(timestamp)}</time>
        </div>
        <div className='grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 text-sm'>
            <ActivityDetail label='Data' value={item.claimedData} />
            <ActivityDetail label='Size' value={item.claimedDataSize} />
            <ActivityDetail label='Country' value={item.country || 'Not disclosed'} />
            <ActivityDetail label='Source' value={item.sourceName || 'Exposure source'} />
        </div>
    </article>
}

function ActivityDetail({ label, value }: { label: string, value: string }) {
    return <div className='min-w-0'>
        <p className='text-[10px] font-semibold uppercase tracking-wide text-ui-muted'>{label}</p>
        <p className='mt-0.5 wrap-break-word text-ui-text'>{value || '—'}</p>
    </div>
}

function ActivityRow({ item }: { item: ExposureQueueItem }) {
    const timestamp = item.claimTime || item.collectedAt
    return <div className='grid grid-cols-[8rem_minmax(14rem,1fr)_minmax(14rem,1fr)_12rem_10rem_9rem_12rem] items-center gap-3 px-4 py-3 text-sm transition hover:bg-ui-raised md:px-6'>
        <time dateTime={timestamp} className='text-xs font-semibold text-ui-muted'>{formatClaimTime(timestamp)}</time>
        <Marquee text={item.actor} innerClassName='font-semibold text-ui-text' />
        <Marquee text={item.company} innerClassName='font-semibold text-ui-text' />
        <Marquee text={item.claimedData} innerClassName='text-ui-muted' />
        <Marquee text={item.claimedDataSize} innerClassName='text-ui-muted' />
        <Marquee text={item.country || 'Not disclosed by TA'} innerClassName='text-ui-muted' />
        <Marquee text={item.sourceName || 'Exposure source'} innerClassName='text-ui-muted' />
    </div>
}
