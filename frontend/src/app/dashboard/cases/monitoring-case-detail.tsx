'use client'

import Link from '@/components/organizations/workspaceLink'
import { useEffect, useState } from 'react'
import { MonitoringCaseComments } from './MonitoringCaseComments'
import { MonitoringCaseOverview } from './MonitoringCaseOverview'
import { MonitoringCaseSecondaryPanels } from './MonitoringCaseSecondaryPanels'
import { caseEndpoint, caseTabs, mergeCaseEvents, type CaseTab, type MonitoringCase } from './monitoringCaseTypes'

export type { MonitoringCase } from './monitoringCaseTypes'

const control = 'rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text disabled:cursor-not-allowed disabled:opacity-50'
const severityColor: Record<string, string> = {
    low: 'var(--ui-muted)',
    medium: 'var(--ui-success)',
    high: 'var(--ui-warning)',
    critical: 'var(--ui-danger)',
}
const headerControl = `${control} inline-flex h-10 min-w-28 items-center justify-center whitespace-nowrap`

export function MonitoringCaseDetail({ caseId, organizationId }: { caseId: string, organizationId?: string }) {
    const [tab, setTab] = useState<CaseTab>('overview')
    const [loadingEvents, setLoadingEvents] = useState(false)
    const [item, setItem] = useState<MonitoringCase | null>(null)
    const [error, setError] = useState('')
    const [revision, setRevision] = useState(0)
    const [busy, setBusy] = useState(false)
    const [comment, setComment] = useState('')
    const [notice, setNotice] = useState('')
    const [resolving, setResolving] = useState(false)
    const [aiAssisted, setAiAssisted] = useState(false)
    const [commentsOpen, setCommentsOpen] = useState(false)
    const [commentFiltersOpen, setCommentFiltersOpen] = useState(false)
    const [commentSearch, setCommentSearch] = useState('')
    const [hideAutomatedComments, setHideAutomatedComments] = useState(false)
    const endpoint = caseEndpoint(caseId, organizationId)
    const comments = item?.comments || []

    useEffect(() => {
        setCommentsOpen(false)
        setCommentFiltersOpen(false)
        setCommentSearch('')
        setHideAutomatedComments(false)
    }, [endpoint])

    useEffect(() => {
        const controller = new AbortController()
        setItem(null)
        setTab('overview')
        setComment('')
        setError('')
        fetch(endpoint, { cache: 'no-store', signal: controller.signal }).then(async response => {
            const payload = await response.json()
            if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Case unavailable.')
            setItem(payload.case)
        }).catch(error => { if (!controller.signal.aborted) setError(error.message) })
        return () => controller.abort()
    }, [endpoint, revision])

    async function save(change: Record<string, unknown>) {
        if (item?.canManage === false) return
        setBusy(true)
        setError('')
        setNotice('')
        try {
            const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change) })
            if (!response.ok) {
                const payload = await response.json()
                throw new Error(payload.error || 'Could not save changes.')
            }
            const refreshed = await fetch(endpoint, { cache: 'no-store' })
            if (!refreshed.ok) throw new Error('Changes saved, but the case could not be refreshed. Retry to reload it.')
            setItem((await refreshed.json()).case)
            if ('comment' in change) setComment('')
            setResolving(false)
            setAiAssisted(false)
            setNotice('Changes saved.')
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Could not save changes.')
        } finally {
            setBusy(false)
        }
    }

    async function moreEvents() {
        if (!item || loadingEvents) return
        setLoadingEvents(true)
        try {
            const page = (item.eventPage || 0) + 1
            const snapshot = item.eventSnapshot || new Date().toISOString()
            const response = await fetch(`${endpoint}&eventsPage=${page}&eventsAt=${encodeURIComponent(snapshot)}`, { cache: 'no-store' })
            if (!response.ok) throw new Error('Could not load more events. Try again.')
            const next = (await response.json()).case as MonitoringCase
            setItem(current => current?.id === item.id ? mergeCaseEvents(current, next) : current)
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Could not load events.')
        } finally {
            setLoadingEvents(false)
        }
    }

    return <article className='min-w-0 overflow-hidden rounded-xl border border-ui-border bg-ui-panel text-ui-text'>
        <div aria-hidden='true' className='h-1.5' style={{ backgroundColor: severityColor[item?.severity ?? ''] ?? 'transparent' }} />
        <header className='grid gap-3 border-b border-ui-border px-5 py-4 sm:px-6'>
            <div className='grid gap-3 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center'>
                <div className='flex min-w-0 items-center gap-4'>
                    <h1 className='min-w-0 max-w-[20ch] flex-1 wrap-break-word text-xl font-semibold leading-tight'>{item?.title || caseId}</h1>
                    <Link className='inline-flex h-10 shrink-0 items-center whitespace-nowrap text-sm text-ui-primary' href={`/cases${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`}>← Cases</Link>
                </div>
                {item && <CaseControls item={item} busy={busy} save={save} setTab={setTab} setResolving={setResolving} />}
            </div>
            <p role='status' className='sr-only'>{busy ? 'Saving…' : notice}</p>
            {error && <div role='alert' className='text-sm text-ui-text'>{error} <button className='underline' disabled={busy} onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
        </header>
        {!item && !error && <p className='p-6'>Loading case…</p>}
        {item && <>
            <CaseTabs item={item} tab={tab} setTab={setTab} />
            <div id='case-panel-overview' role='tabpanel' aria-labelledby='case-tab-overview' hidden={tab !== 'overview'}>
                <MonitoringCaseOverview item={item} caseId={caseId} organizationId={organizationId} resolving={resolving} comment={comment} setComment={setComment} aiAssisted={aiAssisted} setAiAssisted={setAiAssisted} busy={busy} setResolving={setResolving} save={save} />
                <MonitoringCaseComments item={item} comments={comments} comment={comment} setComment={setComment} busy={busy} save={save} commentsOpen={commentsOpen} setCommentsOpen={setCommentsOpen} commentFiltersOpen={commentFiltersOpen} setCommentFiltersOpen={setCommentFiltersOpen} commentSearch={commentSearch} setCommentSearch={setCommentSearch} hideAutomatedComments={hideAutomatedComments} setHideAutomatedComments={setHideAutomatedComments} />
            </div>
            <MonitoringCaseSecondaryPanels item={item} tab={tab} busy={busy} loadingEvents={loadingEvents} save={save} moreEvents={() => void moreEvents()} />
        </>}
    </article>
}

function CaseControls({ item, busy, save, setTab, setResolving }: {
    item: MonitoringCase
    busy: boolean
    save: (change: Record<string, unknown>) => void
    setTab: (tab: CaseTab) => void
    setResolving: (resolving: boolean) => void
}) {
    return <div className='flex max-w-full flex-wrap items-center gap-2'>
        <span className={`inline-flex h-10 min-w-28 items-center justify-center rounded-lg border px-3 text-sm font-medium capitalize ${item.status === 'open' ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning' : 'border-ui-success/30 bg-ui-success/10 text-ui-success'}`}>{item.status.replaceAll('_', ' ')}</span>
        <select aria-label='Severity' className={headerControl} value={item.severity} disabled={busy || item.canManage === false} onChange={event => void save({ severity: event.target.value })}>{['low', 'medium', 'high', 'critical'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select>
        {['closed', 'resolved'].includes(item.status) ? <button className={headerControl} disabled={busy || item.canManage === false} onClick={() => void save({ status: 'open' })}>Reopen case</button> : <>
            <button className={headerControl} disabled={busy || item.canManage === false} onClick={() => void save({ status: item.status === 'in_progress' ? 'open' : 'in_progress' })}>{item.status === 'in_progress' ? 'Set as open' : 'Start progress'}</button>
            <button className={headerControl} disabled={busy || item.canManage === false} onClick={() => { setTab('overview'); setResolving(true) }}>Resolve case</button>
        </>}
        {item.resolution?.id && ['ai', 'automation'].includes(item.resolution.type) && !item.resolution.confirmedAt && ['resolved', 'closed'].includes(item.status) && <button className={headerControl} disabled={busy || item.canManage === false} onClick={() => void save({ confirmResolutionId: item.resolution!.id })}>Confirm resolution</button>}
    </div>
}

function CaseTabs({ item, tab, setTab }: { item: MonitoringCase, tab: CaseTab, setTab: (tab: CaseTab) => void }) {
    return <div role='tablist' aria-label='Case views' className='flex flex-wrap gap-2 border-b border-ui-border px-5 py-3'>
        {caseTabs.map(value => <button key={value} id={`case-tab-${value}`} role='tab' aria-selected={tab === value} aria-controls={`case-panel-${value}`} tabIndex={tab === value ? 0 : -1} onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const index = caseTabs.indexOf(value)
            const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? caseTabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + caseTabs.length) % caseTabs.length
            const next = caseTabs[nextIndex]
            setTab(next)
            document.getElementById(`case-tab-${next}`)?.focus()
        }} className={`${control} ${tab === value ? 'font-semibold text-ui-primary' : ''}`} onClick={() => setTab(value)}>
            {value === 'overview' ? 'Overview' : value === 'history' ? 'History' : value === 'settings' ? 'Settings' : `Events (${item.eventTotal ?? item.occurrences})`}
        </button>)}
    </div>
}
