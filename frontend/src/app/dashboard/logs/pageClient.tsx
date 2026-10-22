'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { logTables, type LogEvent as Event, type LogSearchResult as Result } from '@/utils/logs/search'
import LogCatchupProgress from './catchupProgress'
import ThroughputMetrics, { type Metrics } from './throughputMetrics'
import ErrorsPanel from './errorsPanel'
import { emptyErrorEvents } from '@/utils/logs/errorEvents'
import type { ErrorEvent, ErrorEventsResponse, LogService } from '@/utils/logs/types'
import { LogMetricCard, MostActiveServicesPanel, type LogsDashboardSummary } from './summaryPanels'
import { LogResultsPanel } from './LogResultsPanel'
import { useLogSearch } from './useLogSearch'
import { LogsToolbar } from './LogsToolbar'
import { formatLogCount, logFieldClass } from './logPresentation'

export default function LogsPageClient({ initialServices = [], initialErrors, initialServiceFilter = 'all', initialData = null, initialError = '', initialMetrics = null }: { initialServices?: LogService[], initialErrors?: ErrorEventsResponse, initialServiceFilter?: string, initialData?: Result | null, initialError?: string, initialMetrics?: Metrics | null }) {
    const pathname = usePathname()
    const params = useSearchParams()
    const view = pathname.endsWith('/realtime') ? 'realtime' : pathname.endsWith('/search') ? 'search' : pathname.endsWith('/errors') ? 'errors' : 'dashboard'
    const [service, setService] = useState(params.get('service') || initialServiceFilter)
    const [search, setSearch] = useState(params.get('search') || '')
    const [table, setTable] = useState(logTables.includes(params.get('table') || '') ? params.get('table')! : 'Logs')
    const initialHql = params.get('hql') || params.get('kql') || ''
    const [advanced, setAdvanced] = useState(!!initialHql)
    const [hql, setHql] = useState(initialHql || 'ProcessLogs | where Severity in ("high", "critical") | order by TimeGenerated desc | take 100')
    const [appliedHql, setAppliedHql] = useState(initialHql)
    const [hours, setHours] = useState(params.get('hours') || '24')
    const [severity, setSeverity] = useState(params.get('severity') || 'all')
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const [copied, setCopied] = useState('')
    const [errors, setErrors] = useState(initialErrors || emptyErrorEvents())
    const [errorsLoaded, setErrorsLoaded] = useState(Boolean(initialErrors))
    const [mostActiveSummary, setMostActiveSummary] = useState<LogsDashboardSummary | null>(null)
    const [mostActiveLoaded, setMostActiveLoaded] = useState(false)
    const [refresh, setRefresh] = useState(0)
    const filterPanel = useRef<HTMLDivElement>(null)
    const filterButton = useRef<HTMLButtonElement>(null)
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [analyticsOpen, setAnalyticsOpen] = useState(true)
    const refreshData = () => setRefresh(value => value + 1)
    const { data, error, setError, busy, paged, loadMore } = useLogSearch({
        view, hours, advanced, appliedHql, table, search, service, severity, refresh, initialData, initialError,
        onErrorsLoaded: setErrors,
    })
    useEffect(() => {
        if (view === 'errors') return
        const openFilters = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'j' || event.altKey || event.shiftKey || event.repeat || document.querySelector('dialog[open]')) return
            event.preventDefault()
            setFiltersOpen(true)
            filterPanel.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input[type="search"]:enabled, textarea')?.focus()
        }
        window.addEventListener('keydown', openFilters)
        return () => window.removeEventListener('keydown', openFilters)
    }, [view])
    useEffect(() => {
        if (filtersOpen) filterPanel.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input[type="search"]:enabled, textarea')?.focus()
    }, [filtersOpen])
    useEffect(() => {
        if (!copied) return
        const timeout = setTimeout(() => setCopied(''), 3000)
        return () => clearTimeout(timeout)
    }, [copied])
    useEffect(() => {
        if (view === 'errors') return
        const url = new URL(window.location.href)
        url.searchParams.delete('kql')
        for (const [key, value] of Object.entries({ service: service === 'all' ? '' : service, search: advanced ? '' : search, table: advanced || table === 'Logs' ? '' : table, hql: advanced ? appliedHql : '', hours: hours === '24' ? '' : hours, severity: view === 'realtime' || severity === 'all' ? '' : severity })) {
            if (value) url.searchParams.set(key, value)
            else url.searchParams.delete(key)
        }
        window.history.replaceState(null, '', url)
    }, [view, service, search, table, advanced, appliedHql, hours, severity])
    useEffect(() => {
        if (view !== 'dashboard' || initialErrors) return
        const controller = new AbortController()
        void fetch('/api/backend/logs/errors?limit=150', { signal: controller.signal, cache: 'no-store' })
            .then(async response => {
                if (!response.ok) throw new Error('Could not load log error summary.')
                return response.json() as Promise<ErrorEventsResponse>
            })
            .then(body => {
                if (!controller.signal.aborted) { setErrors(body); setErrorsLoaded(true) }
            })
            .catch(() => { if (!controller.signal.aborted) setErrorsLoaded(true) })
        return () => controller.abort()
    }, [view, initialErrors])
    useEffect(() => {
        if (view !== 'dashboard') return
        const controller = new AbortController()
        void fetch('/api/backend/logs/services/summary', { signal: controller.signal, cache: 'no-store' })
            .then(async response => {
                if (!response.ok) throw new Error('Could not load most active services.')
                return response.json() as Promise<LogsDashboardSummary>
            })
            .then(body => {
                if (!controller.signal.aborted) setMostActiveSummary(body)
            })
            .catch(() => undefined)
            .finally(() => {
                if (!controller.signal.aborted) setMostActiveLoaded(true)
            })
        return () => controller.abort()
    }, [view])
    async function copy(event: Event | ErrorEvent) {
        try { await navigator.clipboard.writeText(JSON.stringify('normalized' in event ? event.normalized : event, null, 2)); setCopied(event.id) }
        catch { setCopied(''); setError('Copy failed. Select the event text and copy it manually.') }
    }
    const toggle = (id: string | number) => setExpanded(previous => ({ ...previous, [id]: !previous[id] }))
    const processingError = data?.processing?.last_error?.endsWith('Waiting for active log writes; will retry.') ? null : data?.processing?.last_error
    const serviceOptions = [...new Set([...initialServices.map(item => item.service), ...(data?.services.map(item => item.service) || []), ...(service === 'all' ? [] : [service])])].sort()
    const activeFilters = [service !== 'all', !advanced && !!search, !advanced && table !== 'Logs', advanced && !!appliedHql, hours !== '24', view !== 'realtime' && severity !== 'all'].filter(Boolean).length
    const realtimeLoadMore = view === 'realtime' && !advanced && !busy && !error && data?.next_cursor
        ? () => loadMore(data.next_cursor!) : undefined
    const resultCount = data?.rows.length || 0
    const showRealtimeCount = view === 'realtime' && !advanced && !data?.summarize
    const resultLabel = view === 'realtime'
        ? showRealtimeCount ? `${formatLogCount(resultCount)}/${data?.total_events === undefined ? '—' : formatLogCount(data.total_events)}` : `${resultCount} events`
        : `${resultCount} results${data && resultCount === data.limit && (view !== 'search' || advanced) ? ` · limited to ${data.limit}; narrow your search or use take up to 500` : ''}`
    return <div className={`${view === 'realtime' ? 'flex h-full min-h-0 flex-col gap-3 sm:gap-4' : 'grid gap-3 sm:gap-4'} min-w-0`}>
        <LogsToolbar
            pathname={pathname}
            view={view}
            filterButtonRef={filterButton}
            filterPanelRef={filterPanel}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen(open => !open)}
            onCloseFilters={() => setFiltersOpen(false)}
            analyticsOpen={analyticsOpen}
            onToggleAnalytics={() => setAnalyticsOpen(open => !open)}
            activeFilters={activeFilters}
            error={error}
            onRetry={refreshData}
            search={search}
            onSearchChange={setSearch}
            advanced={advanced}
            onAdvancedChange={value => {
                setAdvanced(value)
                if (value) setAppliedHql(hql)
            }}
            hql={hql}
            onHqlChange={setHql}
            appliedHql={appliedHql}
            onApplyHql={() => {
                setAppliedHql(hql)
                refreshData()
            }}
            service={service}
            onServiceChange={setService}
            serviceOptions={serviceOptions}
            table={table}
            onTableChange={setTable}
            hours={hours}
            onHoursChange={setHours}
            severity={severity}
            onSeverityChange={setSeverity}
        />
        {view === 'errors' ? <><div className='flex items-center justify-between gap-3 text-xs text-ui-muted'><span role='status'>{busy ? 'Refreshing…' : copied ? 'Event copied' : 'Recent application errors'}</span><button type='button' className={logFieldClass} disabled={busy} onClick={refreshData}>Refresh errors</button></div><ErrorsPanel events={errors} expanded={expanded} onToggle={toggle} onCopy={event => void copy(event)} /></> : <>
            {processingError && <p role='alert' className='text-sm text-ui-text'>Event processing is delayed: {processingError}</p>}
            {view === 'dashboard' && analyticsOpen && <ThroughputMetrics initialMetrics={initialMetrics} />}
            {view === 'dashboard' && <LogCatchupProgress progress={data?.processing?.catchup} now={data?.generated_at || new Date().toISOString()} stalled={!!processingError} />}
            {data?.processing?.skipped_events_available === false && <p role='status' className='text-sm text-ui-warning'>{data.processing.skipped_events_warning || 'The historical excluded event count is temporarily unavailable.'}{data.processing.skipped_events_checked_at ? ` Checked ${new Date(data.processing.skipped_events_checked_at).toLocaleString()}.` : ''}</p>}
            {typeof data?.processing?.skipped_events === 'number' && data.processing.skipped_events >= 0 && <p role='status' className='text-sm text-ui-warning'>{formatLogCount(data.processing.skipped_events)} events remain excluded from detection.{data.processing.skipped_events_checked_at ? ` Checked ${new Date(data.processing.skipped_events_checked_at).toLocaleString()}.` : ''}</p>}
            {view !== 'realtime' && data && !data.processing && !busy && <p role='status' className='text-sm text-ui-warning'>Waiting for the log processor to check in.</p>}
            {view === 'dashboard' ? <>
                <section className='grid grid-cols-2 gap-2.5 min-[380px]:gap-3 md:grid-cols-3 xl:grid-cols-5' aria-label='Events by severity' data-logs-metrics>
                    {(['low', 'medium', 'high', 'critical'] as const).map(value => {
                        const params = new URLSearchParams({ hours: '24', ...(service !== 'all' ? { service } : {}), ...(advanced && appliedHql ? { hql: appliedHql } : { table, search }), severity: value })
                        const fallback24h = hours === '24' ? data?.counts.find(item => item.severity === value)?.count : undefined
                        return <LogMetricCard key={value} label={value} href={`/logs/search?${params}`} hrefLabel={`View 24-hour ${value} logs`} count24h={mostActiveSummary?.last_24h.severities[value] ?? fallback24h} countTotal={mostActiveSummary?.total.severities[value]} />
                    })}
                    <LogMetricCard label='Errors' href='/logs/errors' hrefLabel='View error details' count24h={errorsLoaded ? errors.summary.last_24h : undefined} countTotal={errorsLoaded ? errors.summary.total : undefined} />
                </section>
                <MostActiveServicesPanel summary={mostActiveSummary} fallbackRecent={data?.services} loaded={mostActiveLoaded} />
            </> : <LogResultsPanel
                view={view}
                data={data}
                busy={busy}
                copied={copied}
                error={error}
                expanded={expanded}
                resultLabel={resultLabel}
                resultCount={resultCount}
                showRealtimeCount={showRealtimeCount}
                realtimeLoadMore={realtimeLoadMore}
                paged={paged}
                advanced={advanced}
                onRefresh={refreshData}
                onLoadMore={loadMore}
                onRefreshResults={refreshData}
                onToggle={toggle}
                onCopy={event => void copy(event)}
            />}
        </>}
    </div>
}
