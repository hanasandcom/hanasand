import Link from 'next/link'
import { memo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { dashboardPanelClass } from '@/components/dashboard/ui'
import { formatLogCount } from './logPresentation'

type Severity = 'low' | 'medium' | 'high' | 'critical'
type ScopeSummary = { services: Array<{ service: string, count: number }>, severities: Record<Severity, number> }
export type LogsDashboardSummary = { last_24h: ScopeSummary, total: ScopeSummary }

export const MostActiveServicesPanel = memo(function MostActiveServicesPanel({ summary, fallbackRecent, loaded }: { summary: LogsDashboardSummary | null, fallbackRecent?: Array<{ service: string, count: number }>, loaded: boolean }) {
    const [scope, setScope] = useState<'24h' | 'total'>('24h')
    const [open, setOpen] = useState(true)
    const services = scope === '24h' ? summary?.last_24h.services ?? fallbackRecent : summary?.total.services

    return <section className={`${dashboardPanelClass} overflow-hidden`} aria-label='Most active services' data-most-active>
        <header className='flex items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-4 py-2.5'>
            <button type='button' className='flex min-h-8 flex-1 items-center text-left text-sm font-semibold' aria-expanded={open} aria-controls='most-active-services' onClick={() => setOpen(value => !value)}>Most active</button>
            <div className='flex shrink-0 items-center gap-1.5'>
                <div role='group' aria-label='Most active time range' className='inline-flex rounded-md border border-ui-border p-0.5'>
                    {(['24h', 'total'] as const).map(value => <button key={value} type='button' aria-pressed={scope === value} onClick={() => setScope(value)} className={`rounded px-2 py-1 text-xs ${scope === value ? 'bg-ui-panel font-semibold text-ui-text' : 'text-ui-muted hover:text-ui-text'}`}>{value === '24h' ? '24h' : 'Total'}</button>)}
                </div>
                <button type='button' aria-label={`${open ? 'Collapse' : 'Expand'} most active services`} aria-expanded={open} aria-controls='most-active-services' onClick={() => setOpen(value => !value)} className='rounded p-1 text-ui-muted hover:text-ui-text'>
                    <ChevronDown size={18} aria-hidden className={`${open ? 'rotate-0' : '-rotate-90'} transition-transform`} />
                </button>
            </div>
        </header>
        <div id='most-active-services' hidden={!open} className='p-4'>
            {services?.length ? <dl className='grid gap-2'>{services.map(item => <div key={item.service} className='flex justify-between gap-3 text-sm'><dt>{item.service}</dt><dd>{formatLogCount(item.count)}</dd></div>)}</dl> : services ? <p className='text-sm text-ui-muted'>No services in this period.</p> : <p role='status' className='text-sm text-ui-muted'>{loaded ? 'Service counts are temporarily unavailable.' : 'Loading service counts…'}</p>}
        </div>
    </section>
})

export const LogMetricCard = memo(function LogMetricCard({ label, count24h, countTotal, href, hrefLabel }: { label: string, count24h?: number, countTotal?: number, href?: string, hrefLabel?: string }) {
    const [scope, setScope] = useState<'24h' | 'total'>('24h')
    const total = scope === 'total'
    const count = total ? countTotal : count24h
    return <article className={`${dashboardPanelClass} min-w-0 p-3 sm:p-4`} data-logs-metric-card>
        <div className='flex items-center justify-between gap-1.5'>
            {href ? <Link href={href} aria-label={hrefLabel || `View ${label} logs`} title={hrefLabel || `View ${label} logs`} className='truncate text-xs capitalize text-ui-muted hover:text-ui-primary sm:text-sm'>{label}</Link> : <p className='truncate text-xs capitalize text-ui-muted sm:text-sm'>{label}</p>}
            <button type='button' role='switch' aria-label={`Toggle ${label} count between 24 hours and all time`} aria-checked={total} onClick={() => setScope(value => value === '24h' ? 'total' : '24h')} className={`relative inline-flex h-6 w-[60px] shrink-0 items-center rounded-full border text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary ${total ? 'border-ui-primary bg-ui-primary/10 text-ui-text' : 'border-ui-border bg-ui-raised text-ui-muted'}`}>
                <span className={`relative z-10 ${total ? 'ml-1 mr-auto' : 'ml-auto mr-1'}`}>{total ? 'Total' : '24h'}</span>
                <span aria-hidden className={`absolute left-1 h-3.5 w-3.5 rounded-full bg-ui-primary transition-transform ${total ? 'translate-x-9' : ''}`} />
            </button>
        </div>
        <p className='mt-1.5 text-xl font-semibold tabular-nums sm:mt-2 sm:text-2xl'>{count === undefined ? '—' : formatLogCount(count)}</p>
    </article>
})
