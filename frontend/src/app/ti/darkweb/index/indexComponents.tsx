import type { ReactNode } from 'react'
import type { DarkwebRecord } from './indexTypes'
import { formatDate, formatNumber } from './indexData'
import { formatLabel } from '../../model/reviewLabels'

export function RecordRow({ record }: { record: DarkwebRecord }) {
    return (
        <article className='grid gap-3 border-b border-ui-border px-3 py-4 last:border-b-0 lg:grid-cols-[1fr_0.55fr_0.7fr_0.55fr_0.55fr]'>
            <div className='grid gap-2'>
                <div className='grid gap-1'>
                    <h3 className='wrap-break-word text-sm font-semibold text-ui-text'>{record.title}</h3>
                    <p className='text-xs text-ui-muted'>Reference {record.safeLocatorHash}</p>
                </div>
                <p className='text-sm leading-6 text-ui-muted'>{record.safeSummary}</p>
                <div className='flex flex-wrap gap-2 text-xs text-ui-muted'>
                    <span>{record.network}</span>
                    <span>{formatLabel(record.reviewState)}</span>
                </div>
                <Hints label='Groups' values={record.actorHints} />
                <Hints label='Companies' values={record.victimHints} />
                <Hints label='Data claims' values={record.datasetHints} />
                <Hints label='Sectors' values={record.sectorHints} />
                <Hints label='Countries' values={record.countryHints} />
            </div>
            <Cell label='Activity type' value={formatLabel(record.category)} />
            <Cell label='Review' value={formatLabel(record.legalTriage)} />
            <Cell label='Freshness' value={formatLabel(record.liveness)} />
            <div className='grid content-start gap-1 text-sm text-ui-muted'>
                <span className='text-xs uppercase text-ui-muted lg:hidden'>Last seen</span>
                <span>{formatDate(record.lastSeen)}</span>
            </div>
        </article>
    )
}

export function Input({ label, name, defaultValue, placeholder }: {
    label: string
    name: string
    defaultValue: string
    placeholder: string
}) {
    return (
        <label className='grid min-w-0 gap-2'>
            <span className='text-xs font-semibold uppercase text-ui-primary'>{label}</span>
            <input
                name={name}
                defaultValue={defaultValue}
                placeholder={placeholder}
                className='h-11 w-full min-w-0 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
            />
        </label>
    )
}

function Cell({ label, value }: { label: string; value: string }) {
    return (
        <div className='grid content-start gap-1 text-sm text-ui-muted'>
            <span className='text-xs uppercase text-ui-muted lg:hidden'>{label}</span>
            <span>{value}</span>
        </div>
    )
}

export function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className='flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border border-ui-border bg-ui-panel px-3 py-2'>
            <span className='inline-flex min-w-0 items-center gap-2 text-ui-muted'>
                {icon}<span className='wrap-break-word'>{label}</span>
            </span>
            <span className='min-w-0 wrap-break-word font-semibold text-ui-text sm:text-right'>{value}</span>
        </div>
    )
}

export function Breakdown({ title, values }: { title: string; values?: Record<string, number> }) {
    const entries = Object.entries(values ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8)
    return (
        <section className='grid content-start gap-2 rounded-lg border border-ui-border bg-ui-panel p-3 shadow-sm'>
            <h2 className='text-sm font-semibold text-ui-text'>{title}</h2>
            {entries.length ? entries.map(([key, count]) => (
                <div key={key} className='flex items-center justify-between gap-3 text-sm'>
                    <span className='text-ui-muted'>{formatLabel(key)}</span>
                    <span className='font-semibold text-ui-text'>{formatNumber(count)}</span>
                </div>
            )) : <p className='text-sm text-ui-muted'>Available once matching exposure records are in the current index.</p>}
        </section>
    )
}

function Hints({ label, values }: { label: string; values?: string[] }) {
    if (!values?.length) return null
    return (
        <div className='flex flex-wrap gap-2'>
            <span className='text-xs text-ui-muted'>{label}</span>
            {values.map(value => <span key={value} className='rounded-md bg-ui-raised px-2 py-1 text-xs text-ui-muted'>{value}</span>)}
        </div>
    )
}

export function Badge({ children, tone }: { children: ReactNode; tone: 'ok' | 'watch' }) {
    const className = tone === 'ok'
        ? 'border-ui-primary bg-ui-raised text-ui-primary'
        : 'border-ui-border bg-ui-raised text-ui-muted'
    return <span className={`rounded-md border px-2 py-1 text-xs font-medium uppercase ${className}`}>{children}</span>
}

export function ProductTile({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
    return (
        <article className='grid gap-2 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
            <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                <span className='text-ui-primary'>{icon}</span>
                {title}
            </div>
            <p className='text-sm leading-6 text-ui-muted'>{detail}</p>
        </article>
    )
}
