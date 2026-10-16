'use client'

import type { RefObject, UIEvent } from 'react'
import type { TrafficRecord } from '@/utils/monitoring/types'
import statusClasses from './statusClasses'

export function RecentTrafficTable({ records, scrollContainerRef, hasMore, loadingMore, loadError, onLoadMore, onScroll }: {
    records: TrafficRecord[]
    scrollContainerRef: RefObject<HTMLDivElement | null>
    hasMore: boolean
    loadingMore: boolean
    loadError: string | null
    onLoadMore: () => void
    onScroll: (event: UIEvent<HTMLDivElement>) => void
}) {
    return (
        <div className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
            <div className='shrink-0 border-b border-ui-border p-4'>
                <h2 className='text-lg font-semibold text-ui-text'>Recent traffic</h2>
                <p className='mt-1 text-sm text-ui-muted'>{records.length} latest requests</p>
            </div>
            {records.length || hasMore ? (
                <div ref={scrollContainerRef} role='region' aria-label='Recent traffic requests' tabIndex={0} onScroll={onScroll} className='min-h-0 flex-1 overflow-auto overscroll-contain'>
                    <table className='w-full min-w-[44rem] table-fixed text-left text-sm'>
                        <thead className='sticky top-0 z-10 bg-ui-raised text-xs uppercase text-ui-muted'>
                            <tr>
                                <th className='px-4 py-3'>Date</th>
                                <th className='px-4 py-3'>Method</th>
                                <th className='px-4 py-3'>Path</th>
                                <th className='px-4 py-3'>Status</th>
                                <th className='px-4 py-3'>Duration</th>
                                <th className='max-w-72 truncate px-4 py-3'>Domain</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((record, index) => (
                                <tr key={record.id ?? `${record.timestamp}-${index}`} className='border-b border-ui-border hover:bg-ui-raised'>
                                    <td className='px-4 py-3 text-ui-muted'>{new Date(record.timestamp).toLocaleString()}</td>
                                    <td className='px-4 py-3 font-medium text-ui-text'>{record.method}</td>
                                    <td className='px-4 py-3 break-all text-ui-muted'>{record.path}</td>
                                    <td className='px-4 py-3'>
                                        <span className={`rounded px-2 py-1 text-xs ${statusClasses(record.status)}`}>
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 text-ui-muted'>{record.request_time}ms</td>
                                    <td className='max-w-72 truncate px-4 py-3 text-ui-muted'>{record.domain}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {loadError ? <div role='alert' className='flex items-center justify-between gap-3 border-t border-ui-border p-3 text-sm text-ui-muted'><span>{loadError}</span><button type='button' onClick={onLoadMore} className='shrink-0 font-medium text-ui-primary hover:underline'>Retry</button></div> : null}
                    {loadingMore ? <p role='status' className='border-t border-ui-border p-3 text-center text-xs text-ui-muted'>Loading requests…</p> : null}
                    {hasMore ? <button type='button' onClick={onLoadMore} className='w-full border-t border-ui-border p-3 text-xs text-ui-muted hover:bg-ui-raised hover:text-ui-text'>Load 10 more requests</button> : null}
                </div>
            ) : (
                <p className='p-4 text-sm text-ui-muted'>No recent traffic has been recorded yet.</p>
            )}
        </div>
    )
}
