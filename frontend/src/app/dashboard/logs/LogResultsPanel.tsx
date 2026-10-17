import Link from 'next/link'
import { Copy, RefreshCw } from 'lucide-react'
import type { LogEvent as Event, LogSearchResult as Result } from '@/utils/logs/search'
import { dashboardPanelClass } from '@/components/dashboard/ui'
import EventFeed from './eventFeed'
import { formatLogCount, logFieldClass, logSeverityClasses, projectedLogFields } from './logPresentation'
import EventDisclosureTrigger from './EventDisclosure'

type LogsView = 'dashboard' | 'realtime' | 'search' | 'errors'

export function LogResultsPanel({
    view,
    data,
    busy,
    copied,
    error,
    expanded,
    resultLabel,
    resultCount,
    showRealtimeCount,
    realtimeLoadMore,
    paged,
    advanced,
    onRefresh,
    onLoadMore,
    onRefreshResults,
    onToggle,
    onCopy,
}: {
    view: LogsView
    data: Result | null
    busy: boolean
    copied: string
    error: string
    expanded: Record<string, boolean>
    resultLabel: string
    resultCount: number
    showRealtimeCount: boolean
    realtimeLoadMore?: () => void
    paged: boolean
    advanced: boolean
    onRefresh: () => void
    onLoadMore: (cursor: string) => void
    onRefreshResults: () => void
    onToggle: (id: string | number) => void
    onCopy: (event: Event) => void
}) {
    return <section className={`${dashboardPanelClass} min-w-0 overflow-hidden ${view === 'realtime' ? 'flex min-h-0 flex-1 flex-col' : ''}`} aria-label='Log events'>
        <div className='flex flex-wrap items-center justify-between gap-2 border-b border-ui-border p-3 text-xs text-ui-muted'>
            <span>{showRealtimeCount ? <><span aria-hidden>{resultLabel}</span><span className='sr-only'>{formatLogCount(resultCount)} of {data?.total_events === undefined ? 'an unknown number of' : formatLogCount(data.total_events)} high and critical events</span></> : resultLabel}</span>
            <div className='inline-flex items-center gap-2'>
                {(busy || copied || view !== 'realtime') && <span role='status'>{busy ? 'Searching…' : view === 'realtime' ? '' : 'Results'}{copied ? ' · Event copied' : ''}</span>}
                {view === 'realtime' && <button type='button' onClick={onRefresh} disabled={busy} aria-label='Refresh events' title='Refresh events · automatically every 10 seconds' className='inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:text-ui-primary disabled:opacity-50'><RefreshCw size={14} aria-hidden /><span>10s</span></button>}
            </div>
        </div>
        <EventFeed rows={data?.rows || []} fill={view === 'realtime'} onLoadMore={realtimeLoadMore}>
            {data?.summarize ? <SummaryTable data={data} /> : data?.rows.map(event => <LogEventRow
                key={event.id}
                event={event}
                data={data}
                expanded={!!expanded[event.id]}
                onToggle={() => onToggle(event.id)}
                onCopy={() => onCopy(event)}
            />)}
        </EventFeed>
        {view === 'search' && !advanced && (data?.next_cursor || paged) && <div className='flex justify-center gap-3 border-t border-ui-border p-3'>
            {data?.next_cursor && <button type='button' disabled={busy} className={logFieldClass} onClick={() => onLoadMore(data.next_cursor!)}>Load more results</button>}
            {paged && <button type='button' disabled={busy} className={logFieldClass} onClick={onRefreshResults}>Refresh results</button>}
        </div>}
        {!busy && !data?.rows.length && !error && <p className='p-6 text-sm text-ui-muted'>No events match this search.</p>}
    </section>
}

function SummaryTable({ data }: { data: Result }) {
    return <table className='w-full text-left text-sm'>
        <thead><tr><th className='p-3'>{data.summarize}</th><th className='p-3'>Count</th></tr></thead>
        <tbody>{(data.rows as unknown as Array<{ value: string, count: number }>).map(row => <tr key={row.value}>
            <td className='p-3'>{row.value}</td>
            <td className='p-3'>{row.count}</td>
        </tr>)}</tbody>
    </table>
}

function LogEventRow({
    event,
    data,
    expanded,
    onToggle,
    onCopy,
}: {
    event: Event
    data: Result
    expanded: boolean
    onToggle: () => void
    onCopy: () => void
}) {
    return <article className='select-text border-b border-ui-border p-4 last:border-b-0'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
            <EventDisclosureTrigger
                id={`log-details-${event.id}`}
                expanded={expanded}
                onToggle={onToggle}
                label={<>{event.normalized.service}<span className='font-normal text-ui-muted'>{event.normalized.host}</span></>}
                buttonClassName='flex min-w-0 flex-wrap items-center gap-2 break-all text-left text-sm font-semibold'
            />
            <div className='flex items-center gap-2'>
                <span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${logSeverityClasses[event.normalized.severity]}`}>{event.normalized.severity}</span>
                <button type='button' aria-label='Copy event JSON' onClick={onCopy} className='rounded-md p-1.5 text-ui-muted hover:text-ui-primary'><Copy size={16} /></button>
            </div>
        </div>
        <p className='mt-1 text-xs text-ui-muted'>
            <time suppressHydrationWarning dateTime={event.event_timestamp}>{new Date(event.event_timestamp).toLocaleString()}</time>
            {' · '}{event.normalized.log_type}{' · Original level: '}{event.normalized.level}
        </p>
        <pre className='mt-2 select-text whitespace-pre-wrap wrap-break-word font-mono text-xs leading-5'>
            {data.projection ? JSON.stringify(projectedLogFields(event, data.projection), null, 2) : event.normalized.process?.command_line || event.normalized.message}
        </pre>
        {!!event.normalized.detections?.length && <div className='mt-2 flex flex-wrap gap-2'>
            {event.normalized.detections.map(rule => <Link key={rule.rule_id} href={`/rules/${encodeURIComponent(rule.rule_id)}`} className='text-xs font-medium text-ui-primary'>{rule.summary}</Link>)}
        </div>}
        {expanded && <div id={`log-details-${event.id}`} className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3'>
            <p className='mb-2 text-xs text-ui-muted'>
                {typeof event.normalized.rules_checked === 'number' ? `Event checked ${event.normalized.rules_checked} enabled rules. ` : ''}
                Full event and detection evidence:
            </p>
            <pre className='max-h-96 select-text overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-xs'>{JSON.stringify(event.normalized, null, 2)}</pre>
        </div>}
    </article>
}
