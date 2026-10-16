'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, LoaderCircle, RefreshCw, Search } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { api, buildReadUrl, buildWriteUrl, message } from './data'
import { QueueRow, RecordDetail } from './TimelinessRecords'
import { MetricsPanel, QualityPanel, TimelinessSummary } from './TimelinessMetrics'
import { statuses, type Item, type QueueStatus, type ReferenceForm, type Snapshot } from './types'

export default function TimelinessClient() {
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
    const [selectedId, setSelectedId] = useState('')
    const [scope, setScope] = useState<'tenant' | 'global'>('global')
    const [tenantId, setTenantId] = useState('')
    const [status, setStatus] = useState<'' | QueueStatus>('')
    const [search, setSearch] = useState('')
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [form, setForm] = useState<ReferenceForm>({ role: 'actor', timestamp: '', referenceUrl: '', referenceTitle: '', evidencePath: '' })

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        if (scope === 'tenant' && !tenantId.trim()) {
            setSnapshot(null)
            setLoading(false)
            return
        }
        try {
            const next = await api<Snapshot>(buildReadUrl({ scope, tenantId, status, query }))
            setSnapshot(next)
            setSelectedId(current => next.items.some(item => item.id === current) ? current : next.items[0]?.id || '')
        } catch (cause) {
            setError(message(cause))
        } finally {
            setLoading(false)
        }
    }, [query, scope, status, tenantId])

    useEffect(() => { void load() }, [load])
    const selected = snapshot?.items.find(item => item.id === selectedId)
    const coverage = snapshot?.summary
    const principalMetrics = useMemo(() => snapshot?.metrics.byStage.filter(metric => ['reportToPublicationSeconds', 'reportToVisibilitySeconds', 'reportToAlertSeconds', 'reportToDeliveredSeconds'].includes(metric.name)) ?? [], [snapshot])

    async function addReference(event: FormEvent) {
        event.preventDefault()
        if (!selected) return
        setSaving(true)
        setError('')
        try {
            const response = await api<{ item: Item }>(buildWriteUrl(scope, tenantId), {
                method: 'POST',
                body: JSON.stringify({ recordId: selected.id, ...form, referenceTitle: form.referenceTitle || undefined }),
            })
            setSelectedId(response.item.id)
            setForm({ role: 'actor', timestamp: '', referenceUrl: '', referenceTitle: '', evidencePath: '' })
            await load()
        } catch (cause) {
            setError(message(cause))
        } finally {
            setSaving(false)
        }
    }

    return <>
        <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
            <div className='flex flex-wrap items-end gap-2 border-b border-ui-border bg-ui-raised p-3'>
                <label className='grid gap-1 text-[10px] font-semibold uppercase text-ui-muted'>Scope
                    <select value={scope} onChange={event => setScope(event.target.value as 'tenant' | 'global')} className='h-9 rounded-md border border-ui-border bg-ui-panel px-2 text-xs font-medium normal-case text-ui-text'>
                        <option value='global'>Global records</option>
                        <option value='tenant'>Specific tenant</option>
                    </select>
                </label>
                {scope === 'tenant' ? <label className='grid min-w-64 flex-1 gap-1 text-[10px] font-semibold uppercase text-ui-muted'>Tenant ID
                    <input value={tenantId} onChange={event => setTenantId(event.target.value)} placeholder='Organization or tenant UUID' className='h-9 rounded-md border border-ui-border bg-ui-panel px-2 text-xs font-medium normal-case text-ui-text placeholder:text-ui-muted' />
                </label> : null}
                <label className='grid gap-1 text-[10px] font-semibold uppercase text-ui-muted'>Queue
                    <select value={status} onChange={event => setStatus(event.target.value as '' | QueueStatus)} className='h-9 rounded-md border border-ui-border bg-ui-panel px-2 text-xs font-medium normal-case text-ui-text'>
                        {statuses.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </label>
                <form onSubmit={event => { event.preventDefault(); setQuery(search.trim()) }} className='flex min-w-56 flex-1 gap-1'>
                    <label className='sr-only' htmlFor='timeliness-search'>Search incidents</label>
                    <div className='relative min-w-0 flex-1'>
                        <Search className='pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ui-muted' />
                        <input id='timeliness-search' value={search} onChange={event => setSearch(event.target.value)} placeholder='Actor, source, incident, capture, anomaly' className='h-9 w-full rounded-md border border-ui-border bg-ui-panel pl-8 pr-2 text-xs text-ui-text placeholder:text-ui-muted' />
                    </div>
                    <button type='submit' className='h-9 rounded-md border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text hover:bg-ui-muted/10'>Search</button>
                </form>
                <button type='button' onClick={() => void load()} disabled={loading} aria-label='Refresh timeliness records' className='grid h-9 w-9 place-items-center rounded-md border border-ui-border bg-ui-panel text-ui-muted hover:text-ui-text disabled:opacity-50'>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            {error ? <div role='alert' className='flex items-start gap-2 border-b border-ui-danger/30 bg-ui-raised/10 px-3 py-2 text-xs text-ui-text'><AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />{error}</div> : null}
            <TimelinessSummary summary={coverage} />
        </DashboardPanel>
        <div className='grid min-h-[42rem] gap-3 xl:grid-cols-[22rem_minmax(0,1fr)]'>
            <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex items-center justify-between border-b border-ui-border bg-ui-raised px-3 py-2 text-xs'>
                    <span className='font-semibold text-ui-text'>Timeliness records</span>
                    <span className='text-ui-muted'>{snapshot?.page.total ?? 0} matching</span>
                </div>
                <div className='max-h-[calc(100vh-13rem)] min-h-72 overflow-auto'>
                    {snapshot?.items.map(item => <QueueRow key={item.id} item={item} active={selected?.id === item.id} onClick={() => setSelectedId(item.id)} />)}
                    {!snapshot?.items.length ? <div className='grid min-h-56 place-items-center p-6 text-center text-xs text-ui-muted'>{loading ? <LoaderCircle className='h-5 w-5 animate-spin' /> : 'No retained timeliness records match this scope and queue.'}</div> : null}
                </div>
            </DashboardPanel>
            <div className='grid min-w-0 content-start gap-3'>
                {selected ? <RecordDetail item={selected} form={form} setForm={setForm} saving={saving} onSubmit={addReference} /> : <DashboardPanel className='grid min-h-72 place-items-center p-6 text-center text-sm text-ui-muted'>Select a retained record to inspect its evidence path.</DashboardPanel>}
                <QualityPanel quality={snapshot?.quality} />
                <MetricsPanel stages={principalMetrics} sources={snapshot?.metrics.bySourceFamily ?? []} actors={snapshot?.metrics.byActor ?? []} />
            </div>
        </div>
    </>
}
