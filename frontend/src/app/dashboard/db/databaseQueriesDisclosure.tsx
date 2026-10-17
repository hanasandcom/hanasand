'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { DatabaseQueryActivity } from '@/utils/db/internal'
import { formatDatabaseTime } from './formatDatabaseTime'
import QueryCard from './queryCard'

type QueryData = { queries: DatabaseQueryActivity[], longestQuery: DatabaseQueryActivity | null }

export default function DatabaseQueriesDisclosure({
    count,
    longRunningCount,
    longestDurationSeconds,
    thresholdSeconds,
    checkedAt,
}: {
    count: number
    longRunningCount: number
    longestDurationSeconds: number | null
    thresholdSeconds: number
    checkedAt: string
}) {
    const [data, setData] = useState<QueryData | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function loadQueries() {
        if (data || loading) return
        setLoading(true)
        setError('')
        try {
            const response = await fetch('/api/db/queries', { cache: 'no-store' })
            const payload = await response.json()
            if (!response.ok || !Array.isArray(payload.queries)) throw new Error(payload.message || 'Query activity is temporarily unavailable.')
            setData({ queries: payload.queries, longestQuery: payload.longestQuery || null })
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Query activity is temporarily unavailable.')
        } finally {
            setLoading(false)
        }
    }

    const detail = `${count} shown · ${longRunningCount} long-running · Longest ${formatTime(longestDurationSeconds)} · Threshold ${formatTime(thresholdSeconds)} · Checked ${formatDatabaseTime(checkedAt)}`
    return <details id='active-queries' className='group min-w-0 rounded-lg border border-ui-border bg-ui-panel' onToggle={event => { if (event.currentTarget.open) void loadQueries() }}>
        <summary className='flex cursor-pointer list-none flex-wrap items-center gap-3 p-5 focus-visible:outline-ui-primary [&::-webkit-details-marker]:hidden'>
            <ChevronDown aria-hidden className='h-4 w-4 text-ui-muted transition group-open:rotate-180' />
            <h2 className='text-base font-semibold'>Queries</h2>
            <span className='ml-auto text-xs text-ui-muted'>{detail}</span>
        </summary>
        <div className='min-w-0 space-y-5 border-t border-ui-border p-5'>
            {loading && <p role='status' className='text-sm text-ui-muted'>Loading query activity…</p>}
            {error && <p role='alert' className='text-sm text-ui-warning'>{error} <button type='button' onClick={() => void loadQueries()} className='underline'>Retry</button></p>}
            {data && <>
                {data.queries.length ? <div className='space-y-5 divide-y divide-ui-border [&>details+details]:pt-5'>{data.queries.map((query, index) => <QueryCard key={`${query.database}-${query.user}-${query.query}-${index}`} query={query} duration={formatTime(query.durationSeconds)} collapsible codeMode='raw' />)}</div> : <p className='text-sm text-ui-muted'>No active queries.</p>}
                <section className='space-y-3 border-t border-ui-border pt-5'>
                    <h3 className='text-sm font-semibold'>Longest running query · {formatTime(data.longestQuery?.durationSeconds)}</h3>
                    {data.longestQuery ? <QueryCard query={data.longestQuery} duration={formatTime(data.longestQuery.durationSeconds)} collapsible codeMode='raw' /> : <p className='text-sm text-ui-muted'>No query to show.</p>}
                </section>
            </>}
            {!data && !loading && !error && <p className='text-sm text-ui-muted'>Open to load query activity.</p>}
        </div>
    </details>
}

function formatTime(value?: number | null) {
    if (!Number.isFinite(value ?? NaN) || !value) return '0s'
    if (value < 60) return `${Math.round(value)}s`
    if (value < 3600) return `${Math.round(value / 60)}m`
    return `${Math.round(value / 3600)}h`
}
