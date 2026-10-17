import { ArrowUp, Bell, ChartNoAxesCombined, ListFilter, Maximize2, Minimize2, Search, X } from 'lucide-react'
import { param } from './data'
import type useAuditTimeline from './useAuditTimeline'
import type { AuditEvent } from './data'
import { AuditRows, compactTime } from './timelineRows'
import { DashboardPanel, DashboardTable } from '@/components/dashboard/ui'

type TimelineModel = ReturnType<typeof useAuditTimeline>

export default function AuditTimelinePanel({ model, pendingEvent, acknowledgmentError, onAcknowledge }: {
    model: TimelineModel
    pendingEvent: number | null
    acknowledgmentError: { id: number, message: string } | null
    onAcknowledge: (event: AuditEvent) => void
}) {
    const { audit, sortedEvents, queryResult, fullscreen, showScrollTop, scrollRoot, searchOpen, searchInput, searchError,
        loading, activeFilters, mode, setMode, search, setSearch, loadEvents, setSearchOpen, alertsOpen, setAlertsOpen,
        reviewEvents, setOpenEvent, failedCount, analyticsOpen, setAnalyticsOpen, filtersOpen, setFiltersOpen,
        fullscreenButton, toggleFullscreen, updateScrollTopButton, sentinel, error, loadMore } = model

    return <DashboardPanel className={`min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0${fullscreen ? ' flex h-full flex-col rounded-none border-0' : ''}`}>
        <div className='flex shrink-0 items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-3 py-2'>
            <div>
                <h2 className='text-sm font-semibold text-ui-text'>Timeline</h2>
                <p className='mt-0.5 text-[11px] text-ui-muted'>
                    {queryResult ? `${queryResult.rows.length} ${queryResult.summarized ? 'group' : 'event'}${queryResult.rows.length === 1 ? '' : 's'} · ${audit.total ?? '—'} matches · limit ${queryResult.limit}` : `${sortedEvents.length}/${audit.total ?? '—'} events · newest first`}
                </p>
            </div>
            <div className='flex items-center gap-2'>
                {showScrollTop ? <button type='button' aria-label='Back to top of timeline' title='Back to top' onClick={() => {
                    scrollRoot.current?.scrollTo({ top: 0, behavior: 'instant' })
                    model.setShowScrollTop(false)
                }} className='inline-flex h-8 w-8 items-center justify-center rounded-md border border-ui-border hover:bg-ui-panel'><ArrowUp className='h-4 w-4' /></button> : null}
                <button type='button' aria-label='Search timeline (Cmd J)' aria-keyshortcuts='Meta+J Control+J' aria-expanded={searchOpen} onClick={() => {
                    setSearchOpen(value => !value)
                    requestAnimationFrame(() => searchInput.current?.focus())
                }} className='inline-flex h-8 items-center gap-2 rounded-md border border-ui-border px-2 text-xs hover:bg-ui-panel'>
                    <Search className='h-4 w-4' /><span>Search</span><kbd className='hidden text-ui-muted sm:inline'>⌘J</kbd>
                </button>
                <details className='relative' open={alertsOpen} onToggle={event => setAlertsOpen(event.currentTarget.open)}>
                    <summary aria-label='Audit alerts' className='relative grid h-8 w-8 cursor-pointer list-none place-items-center rounded-md border border-ui-border hover:bg-ui-panel'>
                        <Bell className='h-4 w-4' />
                        {reviewEvents.length > 0 ? <span className='absolute -right-1 -top-1 rounded-full border border-ui-danger/40 bg-ui-raised px-1 text-[10px] text-ui-text'>{reviewEvents.length}</span> : null}
                    </summary>
                    <div className='absolute right-0 z-20 mt-2 max-h-80 w-80 overflow-auto rounded-md border border-ui-border bg-ui-panel p-2 shadow-lg'>
                        <h3 className='px-2 py-1 text-xs font-semibold'>Alerts</h3>
                        {reviewEvents.length ? reviewEvents.map(event => <button key={event.id} type='button' onClick={() => {
                            setOpenEvent(event.id)
                            scrollRoot.current?.querySelector('#event-' + event.id)?.scrollIntoView({ block: 'nearest' })
                        }} className='block w-full rounded px-2 py-2 text-left text-xs hover:bg-ui-raised'>
                            <strong>{event.action}</strong>
                            <span className='block text-ui-text'>{event.result} · {event.service}</span>
                            <span className='block truncate text-ui-muted'>{event.target} · {event.detail}</span>
                        </button>) : <p className='px-2 py-2 text-xs text-ui-muted'>No unacknowledged errors.</p>}
                    </div>
                </details>
                <button type='button' aria-label='Analytics' title='Analytics' aria-expanded={analyticsOpen} onClick={() => setAnalyticsOpen(value => !value)} className={'inline-flex h-8 items-center gap-1 rounded-md border border-ui-border px-2 text-xs ' + (failedCount ? 'text-ui-text' : '')}>
                    <ChartNoAxesCombined className='h-4 w-4' />
                    {failedCount > 0 ? <span className='rounded-full border border-ui-danger/40 bg-ui-raised px-1.5 text-[10px] text-ui-text'>{failedCount}</span> : null}
                </button>
                <button type='button' aria-label='Toggle audit filters' title={filtersOpen ? 'Hide filters' : 'Show filters'} aria-expanded={filtersOpen} aria-controls='audit-filters' onClick={() => setFiltersOpen(value => !value)} className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-ui-border hover:bg-ui-panel ${filtersOpen ? 'bg-ui-panel text-ui-primary' : ''}`}>
                    <ListFilter className='h-4 w-4' aria-hidden />
                </button>
                <button ref={fullscreenButton} type='button' aria-label={fullscreen ? 'Minimize timeline' : 'Fullscreen timeline'} title={fullscreen ? 'Minimize (Esc)' : 'Fullscreen'} onClick={toggleFullscreen} className='inline-flex h-8 items-center gap-2 rounded-md border border-ui-border px-2 text-xs hover:bg-ui-panel'>
                    {fullscreen ? <Minimize2 className='h-4 w-4' /> : <Maximize2 className='h-4 w-4' />}
                    <span className='hidden sm:inline'>{fullscreen ? 'Minimize' : 'Fullscreen'}</span>
                </button>
            </div>
        </div>
        {searchOpen ? <div className='shrink-0 border-b border-ui-border p-3'>
            <form className='flex flex-wrap items-center gap-2' onSubmit={event => {
                event.preventDefault()
                void loadEvents({ ...activeFilters, q: undefined, hql: undefined, [mode]: search.trim() })
            }}>
                <select aria-label='Search mode' value={mode} onChange={event => {
                    setMode(event.target.value)
                    setSearch('')
                    searchInput.current?.focus()
                }} className='h-9 rounded-md border border-ui-border bg-ui-raised px-2 text-sm'>
                    <option value='q'>Free text</option><option value='hql'>HQL</option>
                </select>
                <input ref={searchInput} autoFocus type='search' aria-label={mode === 'hql' ? 'HQL query' : 'Search audit events'} value={search} onChange={event => setSearch(event.target.value)} placeholder={mode === 'hql' ? 'AuditEvents | where Result == "failed" | take 100' : 'Search all audit events…'} maxLength={mode === 'hql' ? 8000 : 1000} spellCheck={mode !== 'hql'} className={`h-9 min-w-32 flex-1 rounded-md border border-ui-border bg-ui-raised px-3 text-sm ${mode === 'hql' ? 'font-mono' : ''}`} />
                <button type='submit' disabled={loading} className='h-9 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary disabled:opacity-50'>{loading ? 'Searching…' : 'Search'}</button>
                {(param(activeFilters, 'q') || param(activeFilters, 'hql')) ? <button type='button' onClick={() => {
                    setSearch('')
                    void loadEvents({ ...activeFilters, q: undefined, hql: undefined })
                }} className='h-9 px-2 text-sm text-ui-muted'>Clear search</button> : null}
                <button type='button' aria-label='Close search' onClick={() => setSearchOpen(false)} className='grid h-9 w-9 place-items-center rounded-md hover:bg-ui-raised'><X className='h-4 w-4' /></button>
            </form>
            {mode === 'hql' ? <details className='mt-2 text-xs text-ui-muted' open={model.hqlSyntaxOpen} onToggle={event => model.setHqlSyntaxOpen(event.currentTarget.open)}>
                <summary className='cursor-pointer'>HQL syntax</summary>
                <p className='mt-2'>Hanasand Query Language. Table: AuditEvents. Fields: TimeGenerated, Service, Actor, Action, Target, Result, Description.</p>
                <p className='mt-1'>Operators: where, project, order by, take (1–500), summarize count() by. Conditions: ==, !=, &gt;, &gt;=, &lt;, &lt;=, contains, has, startswith, endswith, in, and, or, not, parentheses and ago(24h). Put where before order by and take last. Default limit: 100. Existing filters still apply.</p>
            </details> : null}
        </div> : null}
        {searchError ? <p role='alert' className='shrink-0 border-b border-ui-border px-3 py-2 text-sm text-ui-text'>{searchError}</p> : null}
        <div ref={scrollRoot} onScroll={updateScrollTopButton} data-testid='audit-scroll' aria-busy={loading} className={fullscreen ? 'min-h-0 flex-1 overflow-auto' : `min-h-72 overflow-auto ${filtersOpen ? 'max-h-[calc(100dvh-18rem)]' : 'max-h-[calc(100dvh-10rem)]'}`}>
            <AuditTable model={model} pendingEvent={pendingEvent} acknowledgmentError={acknowledgmentError} onAcknowledge={onAcknowledge} />
            <div ref={sentinel} className='p-3 text-center text-xs text-ui-muted' aria-live='polite'>
                {loading ? 'Loading more events…' : error ? <button type='button' onClick={() => void loadMore()} className='text-ui-primary underline'>Could not load more events. Retry</button> : audit.nextCursor ? <button type='button' onClick={() => void loadMore()} className='text-ui-primary'>Load 50 more</button> : audit.available && sortedEvents.length ? 'All events displayed' : null}
            </div>
        </div>
    </DashboardPanel>
}

function AuditTable({ model, pendingEvent, acknowledgmentError, onAcknowledge }: {
    model: TimelineModel
    pendingEvent: number | null
    acknowledgmentError: { id: number, message: string } | null
    onAcknowledge: (event: AuditEvent) => void
}) {
    const { queryResult, sortedEvents, openEvent, setOpenEvent, searchError, audit } = model
    const tableHeaders = queryResult
        ? queryResult.columns.map(column => <th key={column} className='border-b border-ui-border px-3 py-2'>{column === 'TimeGenerated' ? 'Time' : column}</th>)
        : ['Time', 'Service', 'Actor', 'Action', 'Target', 'Result', 'Description'].map(label => <th key={label} className='border-b border-ui-border px-3 py-2'>{label}</th>)

    return <DashboardTable
        className='min-w-full border-separate border-spacing-0 text-xs'
        headClassName={queryResult ? 'sticky top-0 z-10 bg-ui-panel text-left text-ui-muted' : 'sticky top-0 z-10 bg-ui-panel/95 text-left text-[10px] font-semibold text-ui-muted backdrop-blur'}
        bodyClassName={queryResult ? null : 'bg-ui-panel'}
        columnHeaders={tableHeaders}
    >
        {queryResult ? <>
            {queryResult.rows.map((row, index) => <tr key={index} className='align-top hover:bg-ui-raised'>
                {row.map((value, cell) => <td key={cell} className='border-b border-ui-border px-3 py-1.5'>{queryResult.columns[cell] === 'TimeGenerated' && value ? compactTime(String(value)) : String(value ?? '—')}</td>)}
            </tr>)}
            {!queryResult.rows.length ? <tr><td colSpan={queryResult.columns.length} className='p-8 text-center text-ui-muted'>No audit events match this query.</td></tr> : null}
        </> : <>
            {sortedEvents.map(event => <AuditRows key={event.id} event={event} open={openEvent === event.id} pending={pendingEvent === event.id} acknowledgmentError={acknowledgmentError?.id === event.id ? acknowledgmentError.message : ''} toggle={() => setOpenEvent(openEvent === event.id ? null : event.id)} acknowledge={() => onAcknowledge(event)} />)}
            {!sortedEvents.length && !searchError ? <tr><td colSpan={7} className='px-4 py-8 text-center text-sm text-ui-muted'>
                {audit.available ? 'No audit events match these filters.' : 'Audit storage is unavailable. The result is not being treated as an empty log.'}
            </td></tr> : null}
        </>}
    </DashboardTable>
}
