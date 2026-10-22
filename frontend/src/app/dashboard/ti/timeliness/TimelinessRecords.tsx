'use client'

import type { FormEvent, ReactNode } from 'react'
import { CheckCircle2, Clock3, ExternalLink, LoaderCircle, Send } from 'lucide-react'
import { DashboardPanel } from 'hanasand/dashboard'
import { date, duration, label } from './data'
import { stageOrder, type Item, type QueueStatus, type ReferenceForm } from './types'

export function QueueRow({ item, active, onClick }: { item: Item, active: boolean, onClick: () => void }) {
    return <button type='button' onClick={onClick} className={`grid w-full gap-1 border-b border-ui-border px-3 py-2.5 text-left hover:bg-ui-raised ${active ? 'bg-ui-raised' : ''}`}>
        <span className='flex min-w-0 items-center gap-2'><Status status={item.status} /><span className='truncate text-xs font-semibold text-ui-text'>{item.actorName || item.title || item.incidentId}</span></span>
        <span className='truncate text-[11px] text-ui-muted'>{item.sourceName || item.sourceId} · {item.title || item.incidentId}</span>
        {item.exclusion ? <p className='border-b border-ui-border px-3 py-2 text-xs text-ui-muted'>{item.exclusion.reason} · {item.exclusion.reviewedBy} · {date(item.exclusion.reviewedAt)}</p> : null}
        {!item.exclusion && !item.stages.first_report ? <ReportLookup item={item} /> : null}
        {item.timestampAnomalies.length ? <span className='truncate text-[10px] text-ui-text'>{item.timestampAnomalies.join(', ')}</span> : null}
    </button>
}

export function RecordDetail({ item, form, setForm, saving, onSubmit }: { item: Item, form: ReferenceForm, setForm: (value: ReferenceForm) => void, saving: boolean, onSubmit: (event: FormEvent) => void }) {
    return <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
        <div className='flex flex-wrap items-start justify-between gap-2 border-b border-ui-border bg-ui-raised px-3 py-2.5'>
            <div className='min-w-0'>
                <p className='text-[10px] font-semibold uppercase text-ui-primary'>{item.actorName || 'Unattributed actor'}</p>
                <h2 className='mt-0.5 truncate text-sm font-semibold text-ui-text'>{item.title || item.incidentId}</h2>
                <p className='mt-1 truncate text-[11px] text-ui-muted'>{item.sourceName || item.sourceId} · {item.incidentId}</p>
            </div>
            <Status status={item.status} />
        </div>
        {!item.stages.first_report ? <ReportLookup item={item} /> : null}
        {item.summary ? <div className='border-b border-ui-border p-3 text-xs leading-relaxed text-ui-text'>
            <p className='whitespace-pre-line'>{item.summary}</p>
            {item.sources?.filter(source => source.url && /^https:\/\//.test(source.url)).map(source => <a key={source.url} href={source.url} target='_blank' rel='noopener noreferrer' className='mr-3 mt-2 inline-block text-ui-primary underline'>{source.title || source.url}</a>)}
        </div> : null}
        {item.timestampAnomalies.length ? <div className='border-b border-ui-danger/30 bg-ui-raised/10 px-3 py-2 text-xs text-ui-text'><strong>Ordering/source anomaly:</strong> {item.timestampAnomalies.join(', ')}</div> : null}
        <div className='grid lg:grid-cols-[minmax(0,1fr)_21rem]'>
            <section className='min-w-0 border-b border-ui-border p-3 lg:border-b-0 lg:border-r'>
                <h3 className='text-xs font-semibold text-ui-text'>Persisted event path</h3>
                <div className='mt-2 grid gap-1'>{stageOrder.map(stage => <StageRow key={stage} stage={stage} timestamp={item.stages[stage]} provenance={item.provenance[stage]} />)}</div>
                <h3 className='mt-4 text-xs font-semibold text-ui-text'>Measured intervals</h3>
                <dl className='mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
                    {Object.entries(item.latencies).map(([name, value]) => <div key={name} className='rounded-md border border-ui-border bg-ui-raised p-2'>
                        <dt className='text-[10px] text-ui-muted'>{label(name)}</dt>
                        <dd className='mt-1 text-xs font-semibold text-ui-text'>{duration(value)}</dd>
                    </div>)}
                </dl>
            </section>
            <ReferenceFormPanel form={form} setForm={setForm} saving={saving} onSubmit={onSubmit} />
        </div>
    </DashboardPanel>
}

function ReportLookup({ item }: { item: Item }) {
    return <div className='border-b border-ui-border px-3 py-2 text-xs text-ui-muted'>
        Report lookup: {reportStatus(item)}
        {item.reportRecovery?.attempts ? ` · ${item.reportRecovery.attempts} attempts` : ''}
        {item.reportRecovery?.reason ? <p className='mt-1'>{item.reportRecovery.reason}</p> : null}
        {item.reportRecovery?.nextAttemptAt && item.reportRecovery.status !== 'running' ? <p className='mt-1'>Next attempt: {date(item.reportRecovery.nextAttemptAt)}</p> : null}
    </div>
}

function reportStatus(item: Item) {
    return ({ running: 'Collecting evidence', failed: 'Retry scheduled', unavailable: 'No verified date found' } as Record<string, string>)[item.reportRecovery?.status || ''] || 'Queued'
}

function ReferenceFormPanel({ form, setForm, saving, onSubmit }: { form: ReferenceForm, setForm: (value: ReferenceForm) => void, saving: boolean, onSubmit: (event: FormEvent) => void }) {
    return <form onSubmit={onSubmit} className='grid content-start gap-3 p-3'>
        <div>
            <h3 className='text-xs font-semibold text-ui-text'>Add public first-report evidence</h3>
            <p className='mt-1 text-[11px] leading-4 text-ui-muted'>Use the timestamp exactly as published by the actor, victim, or publisher and identify the source field.</p>
        </div>
        <Field label='Reporting party'><select required value={form.role} onChange={event => setForm({ ...form, role: event.target.value })} className={inputClass}><option value='actor'>Actor</option><option value='victim'>Victim</option><option value='publisher'>Publisher</option></select></Field>
        <Field label='Timestamp with timezone'><input required value={form.timestamp} onChange={event => setForm({ ...form, timestamp: event.target.value })} placeholder='2026-07-22T10:00:00Z' className={inputClass} /></Field>
        <Field label='Public reference URL'><input required type='url' value={form.referenceUrl} onChange={event => setForm({ ...form, referenceUrl: event.target.value })} placeholder='https://…' className={inputClass} /></Field>
        <Field label='Source-field path'><input required value={form.evidencePath} onChange={event => setForm({ ...form, evidencePath: event.target.value })} placeholder='article.time[datetime]' className={inputClass} /></Field>
        <Field label='Reference title (optional)'><input value={form.referenceTitle} onChange={event => setForm({ ...form, referenceTitle: event.target.value })} className={inputClass} /></Field>
        <button type='submit' disabled={saving} className='inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ui-primary px-3 text-xs font-semibold text-ui-on-primary hover:opacity-90 disabled:opacity-50'>
            {saving ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}Record evidence
        </button>
    </form>
}

function StageRow({ stage, timestamp, provenance }: { stage: string, timestamp?: string, provenance?: Record<string, unknown> }) {
    const url = typeof provenance?.referenceUrl === 'string' ? provenance.referenceUrl : undefined
    const noDate: Record<string, string> = { reviewed: 'No review recorded', alert_created: 'No alert recorded', delivery_attempt: 'No attempt recorded', delivered: 'No delivery confirmed' }
    return <div className='grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 rounded-md border border-ui-border px-2.5 py-2 text-xs'>
        <span className='flex items-center gap-1.5 font-medium text-ui-muted'>
            {timestamp ? <CheckCircle2 className='h-3.5 w-3.5 text-ui-success' /> : <Clock3 className='h-3.5 w-3.5' />}
            {provenance?.event === 'server_first_seen' ? 'First seen on Hanasand' : label(stage)}
        </span>
        <span className='min-w-0'>
            <span className='block font-mono text-[11px] text-ui-text'>{timestamp ? date(timestamp) : noDate[stage] || 'Not supplied by source'}</span>
            {provenance ? <span className='mt-0.5 block truncate text-[10px] text-ui-muted'>
                {String(provenance.evidencePath || provenance.event || 'stored provenance')}
                {url ? <> · <a href={url} target='_blank' rel='noopener noreferrer' className='inline-flex items-center gap-0.5 text-ui-primary hover:underline'>reference<ExternalLink className='h-2.5 w-2.5' /></a></> : null}
            </span> : null}
        </span>
    </div>
}

function Status({ status }: { status: QueueStatus }) {
    const bad = status === 'anomaly'
    const good = status === 'complete'
    const tone = bad ? 'border-ui-danger/40 bg-ui-raised/10 text-ui-text' : good ? 'border-ui-success/40 bg-ui-success/10 text-ui-success' : 'border-ui-warning/40 bg-ui-warning/10 text-ui-warning'
    return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${tone}`}>{label(status)}</span>
}

function Field({ label: name, children }: { label: string, children: ReactNode }) {
    return <label className='grid gap-1 text-[10px] font-semibold uppercase text-ui-muted'>{name}{children}</label>
}

const inputClass = 'h-9 w-full rounded-md border border-ui-border bg-ui-raised px-2 text-xs font-normal normal-case text-ui-text placeholder:text-ui-muted'
