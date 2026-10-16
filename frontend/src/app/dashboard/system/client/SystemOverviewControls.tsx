import { createPortal } from 'react-dom'
import { ChartNoAxesCombined, PauseCircle, PlayCircle, RefreshCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SummaryCard } from './SystemUi'
import type { SystemSummary } from './types'

export function SystemOverviewControls({ summary, refreshing, onRefresh, autoRefresh, onToggleAutoRefresh }: {
    summary: SystemSummary[]
    refreshing: boolean
    onRefresh: () => void
    autoRefresh: boolean
    onToggleAutoRefresh: () => void
}) {
    const [visible, setVisible] = useState(false)
    const [actionsTarget, setActionsTarget] = useState<HTMLElement | null>(null)
    const [statisticsTarget, setStatisticsTarget] = useState<HTMLElement | null>(null)
    const [preferenceLoaded, setPreferenceLoaded] = useState(false)

    useEffect(() => {
        setActionsTarget(document.getElementById('system-overview-actions'))
        setStatisticsTarget(document.getElementById('system-overview-statistics-target'))
        try { setVisible(window.localStorage.getItem('system-overview-statistics-visible') === 'true') } catch { /* Storage is optional. */ }
        setPreferenceLoaded(true)
    }, [])

    useEffect(() => {
        if (!preferenceLoaded) return
        try { window.localStorage.setItem('system-overview-statistics-visible', String(visible)) } catch { /* Keep the toggle available for this page view. */ }
    }, [preferenceLoaded, visible])

    return <>
        {statisticsTarget && visible ? createPortal(<details open onToggle={(event) => setVisible(event.currentTarget.open)} className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel' data-system-summary-disclosure>
            <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'><span>Statistics</span></summary>
            <section className='grid gap-3 border-t border-ui-border p-3 sm:grid-cols-2 xl:grid-cols-4' data-system-summary-metrics>
                {summary.map((item) => <SummaryCard key={item.label} item={item} />)}
            </section>
        </details>, statisticsTarget) : null}
        {actionsTarget ? createPortal(<div className='flex items-center gap-2'>
            <button type='button' onClick={onRefresh} aria-label={refreshing ? 'Refreshing system telemetry' : 'Refresh system telemetry'} title='Refresh system telemetry' className='inline-flex h-8 items-center gap-1.5 rounded-md border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text shadow-sm transition hover:border-ui-primary/35 hover:bg-ui-raised'><RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />Refresh</button>
            <button type='button' onClick={onToggleAutoRefresh} aria-pressed={autoRefresh} aria-label={`Auto refresh ${autoRefresh ? 'on' : 'off'}`} title={`Auto refresh ${autoRefresh ? 'on' : 'off'}`} className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold shadow-sm transition ${autoRefresh ? 'border-ui-primary/35 bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-text hover:bg-ui-raised'}`}>{autoRefresh ? <PauseCircle className='h-3.5 w-3.5' /> : <PlayCircle className='h-3.5 w-3.5' />}Auto</button>
            <button type='button' onClick={() => setVisible(value => !value)} aria-pressed={visible} aria-label={`${visible ? 'Hide' : 'Show'} statistics`} title={`${visible ? 'Hide' : 'Show'} statistics`} className={`inline-flex h-8 w-8 items-center justify-center rounded-md border shadow-sm transition ${visible ? 'border-ui-primary/35 bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-text hover:bg-ui-raised'}`}><ChartNoAxesCombined className='h-4 w-4' /></button>
        </div>, actionsTarget) : null}
    </>
}
