import Link from 'next/link'
import { BarChart3, ListFilter, Search, X } from 'lucide-react'
import type { RefObject } from 'react'
import { logTables } from '@/utils/logs/search'
import { dashboardPanelClass } from 'hanasand/dashboard'
import { logFieldClass, logFieldNames } from './logPresentation'
import { isActiveLogPath, logPages, logSeverityValues, logTimeRanges } from './logToolbarOptions'

type LogsView = 'dashboard' | 'realtime' | 'search' | 'errors'

export function LogsToolbar({
    pathname,
    view,
    filterButtonRef,
    filterPanelRef,
    filtersOpen,
    onToggleFilters,
    onCloseFilters,
    analyticsOpen,
    onToggleAnalytics,
    activeFilters,
    error,
    onRetry,
    search,
    onSearchChange,
    advanced,
    onAdvancedChange,
    hql,
    onHqlChange,
    appliedHql,
    onApplyHql,
    service,
    onServiceChange,
    serviceOptions,
    table,
    onTableChange,
    hours,
    onHoursChange,
    severity,
    onSeverityChange,
}: {
    pathname: string
    view: LogsView
    filterButtonRef: RefObject<HTMLButtonElement | null>
    filterPanelRef: RefObject<HTMLDivElement | null>
    filtersOpen: boolean
    onToggleFilters: () => void
    onCloseFilters: () => void
    analyticsOpen: boolean
    onToggleAnalytics: () => void
    activeFilters: number
    error: string
    onRetry: () => void
    search: string
    onSearchChange: (value: string) => void
    advanced: boolean
    onAdvancedChange: (value: boolean) => void
    hql: string
    onHqlChange: (value: string) => void
    appliedHql: string
    onApplyHql: () => void
    service: string
    onServiceChange: (value: string) => void
    serviceOptions: string[]
    table: string
    onTableChange: (value: string) => void
    hours: string
    onHoursChange: (value: string) => void
    severity: string
    onSeverityChange: (value: string) => void
}) {
    const activeTitle = view === 'dashboard' ? 'Logs' : view === 'realtime' ? 'Realtime' : view === 'errors' ? 'Errors' : 'Search logs'

    return <>
        <header className='flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0'>
                <h1 className='text-xl font-semibold sm:text-2xl'>{activeTitle}</h1>
                {view === 'errors' && <p className='mt-1 text-sm text-ui-muted'>Application errors, response codes, and request details.</p>}
            </div>
            <nav aria-label='Log pages' className='flex w-full min-w-0 flex-wrap items-center gap-1 sm:w-auto sm:gap-2'>
                {logPages
                    .filter(([, href]) => (view !== 'realtime' || href !== '/logs/realtime') && (view !== 'dashboard' || href !== '/logs'))
                    .map(([label, href]) => (
                        <Link
                            key={href}
                            href={href}
                            aria-current={isActiveLogPath(pathname, href) ? 'page' : undefined}
                            className={`${logFieldClass} shrink-0 px-2 text-[11px] sm:px-3 sm:text-sm ${isActiveLogPath(pathname, href) ? 'font-semibold text-ui-primary' : ''}`}
                        >
                            {label}
                        </Link>
                    ))}
                {view !== 'errors' && <button
                    ref={filterButtonRef}
                    type='button'
                    onClick={onToggleFilters}
                    aria-label='Filter logs'
                    aria-expanded={filtersOpen}
                    aria-controls='log-filters'
                    aria-keyshortcuts='Meta+J Control+J'
                    title='Filter logs (⌘J)'
                    className={`${logFieldClass} relative inline-flex shrink-0 items-center justify-center px-2 ${activeFilters ? 'border-ui-primary text-ui-primary' : ''}`}
                >
                    <ListFilter size={18} aria-hidden />
                    {!!activeFilters && <span className='absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-ui-primary text-[10px] font-semibold text-ui-on-primary'>
                        {activeFilters}<span className='sr-only'> active filters</span>
                    </span>}
                </button>}
                {view === 'dashboard' && <button
                    type='button'
                    onClick={onToggleAnalytics}
                    aria-label='Toggle log analytics'
                    aria-expanded={analyticsOpen}
                    aria-controls='log-analytics'
                    title='Toggle log analytics'
                    className={`${logFieldClass} shrink-0 px-2 ${analyticsOpen ? 'border-ui-primary text-ui-primary' : ''}`}
                >
                    <BarChart3 size={18} aria-hidden />
                </button>}
            </nav>
        </header>
        {error && <div role='alert' className='flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ui-danger p-3 text-sm text-ui-text'>
            <span>{error}</span>
            <button type='button' className={logFieldClass} onClick={onRetry}>Retry</button>
        </div>}
        {view === 'errors' ? null : <div
            ref={filterPanelRef}
            id='log-filters'
            hidden={!filtersOpen}
            role='region'
            aria-label='Log filters'
            onKeyDown={event => {
                if (event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()
                    onCloseFilters()
                    filterButtonRef.current?.focus()
                }
            }}
            className={`${dashboardPanelClass} p-4`}
            data-logs-toolbar
        >
            <div className='mb-4 flex items-center justify-between'>
                <h2 className='text-sm font-semibold'>Filter logs</h2>
                <button type='button' onClick={() => { onCloseFilters(); filterButtonRef.current?.focus() }} aria-label='Close log filters' className='rounded-md p-1 text-ui-muted hover:bg-ui-raised hover:text-ui-text'>
                    <X size={18} aria-hidden />
                </button>
            </div>
            <div className='grid gap-3'>
                <div className='flex min-w-0 items-center gap-3'>
                    <label className='relative min-w-0 flex-1'>
                        <Search size={16} aria-hidden className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ui-muted' />
                        <input type='search' aria-label='Search log messages' placeholder='Search log messages…' value={search} onChange={event => onSearchChange(event.target.value)} disabled={advanced} className={`${logFieldClass} h-11 w-full min-w-0 pl-9 pr-16 disabled:opacity-50`} />
                        <kbd className='pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-ui-border bg-ui-raised px-1.5 py-0.5 font-sans text-xs text-ui-muted'>⌘J</kbd>
                    </label>
                    <label className={`${logFieldClass} flex h-11 shrink-0 cursor-pointer items-center gap-2 ${advanced ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : ''}`}>
                        <input type='checkbox' checked={advanced} onChange={event => onAdvancedChange(event.target.checked)} className='size-4 accent-ui-primary' />
                        HQL
                    </label>
                </div>
                <div className='grid min-w-0 grid-cols-1 gap-2.5 min-[380px]:grid-cols-2 sm:gap-3 lg:grid-cols-4'>
                    <select aria-label='Service' value={service} onChange={event => onServiceChange(event.target.value)} className={`${logFieldClass} h-11 w-full min-w-0 truncate`} data-logs-service-filter>
                        <option value='all'>All services</option>
                        {serviceOptions.map(value => <option key={value}>{value}</option>)}
                    </select>
                    {!advanced && <select aria-label='Log type' value={table} onChange={event => onTableChange(event.target.value)} className={`${logFieldClass} h-11 w-full min-w-0`}>
                        {logTables.map(value => <option key={value} value={value}>{value === 'Logs' ? 'All log types' : value}</option>)}
                    </select>}
                    <select aria-label='Time range' value={hours} onChange={event => onHoursChange(event.target.value)} className={`${logFieldClass} h-11 w-full min-w-0`}>
                        {logTimeRanges.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    {view !== 'realtime' && <select aria-label='Severity' value={severity} onChange={event => onSeverityChange(event.target.value)} className={`${logFieldClass} h-11 w-full min-w-0`}>
                        <option value='all'>All severities</option>
                        {logSeverityValues.map(value => <option key={value}>{value}</option>)}
                    </select>}
                </div>
                {advanced && <form onSubmit={event => { event.preventDefault(); onApplyHql() }} className='grid gap-3 border-t border-ui-border pt-4'>
                    <textarea autoFocus aria-label='HQL query' value={hql} onChange={event => onHqlChange(event.target.value)} rows={3} spellCheck={false} className={`${logFieldClass} min-w-0 font-mono`} />
                    <button className='justify-self-start rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-on-primary'>Run query</button>
                    {hql !== appliedHql && <p className='text-xs text-ui-warning'>Query edited. Run it to update the results.</p>}
                    <details className='text-xs text-ui-muted'>
                        <summary className='cursor-pointer'>HQL syntax and tables</summary>
                        <p className='mt-2'>Tables: Logs, ProcessLogs, SigninLogs, ApplicationLogs, HttpLogs, SystemLogs. HQL (Hanasand Query Language) supports this subset: where, project, order by, take (1–500), summarize count() by. Conditions: ==, !=, &gt;, &gt;=, &lt;, &lt;=, contains, has, startswith, endswith, in, and, or, not, parentheses and ago(24h). Other operators are rejected.</p>
                        <p className='mt-2'>Put where before order by. After project or summarize, only take is supported. Put take last. Fields: {Object.keys(logFieldNames).join(', ')}. The selected time range, service and severity filters always apply.</p>
                        <pre className='mt-2 whitespace-pre-wrap'>ProcessLogs | where CommandLine contains &quot;whoami&quot; | project TimeGenerated, Host, CommandLine</pre>
                    </details>
                </form>}
            </div>
        </div>}
    </>
}
