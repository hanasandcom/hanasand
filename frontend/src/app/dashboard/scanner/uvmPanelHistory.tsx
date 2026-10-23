'use client'

import { useEffect, useState } from 'react'
import type { UvmAssessment, UvmAssessmentHistoryPage, UvmDashboard, UvmRun, UvmRunHistoryPage } from '@/utils/monitoring/types'
import { formatDate, RunCard } from './uvmPanelHelpers'

const assessmentPageSize = 8
const runPageSize = 10

function PageControls({ page, pageCount, onChange }: { page: number, pageCount: number, onChange: (page: number) => void }) {
    if (pageCount < 2) return null
    return <nav aria-label='History pages' className='mt-3 flex items-center justify-between gap-3 text-sm'>
        <button type='button' onClick={() => onChange(page - 1)} disabled={page === 0} className='rounded-md border border-ui-border px-3 py-2 disabled:opacity-50'>Previous</button>
        <span className='text-xs text-ui-muted'>Page {page + 1} of {pageCount}</span>
        <button type='button' onClick={() => onChange(page + 1)} disabled={page >= pageCount - 1} className='rounded-md border border-ui-border px-3 py-2 disabled:opacity-50'>Next</button>
    </nav>
}

function HistoryFilters({ query, setQuery, status, setStatus, statusOptions, queryLabel }: {
    query: string
    setQuery: (value: string) => void
    status: string
    setStatus: (value: string) => void
    statusOptions: string[]
    queryLabel: string
}) {
    return <div className='mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]'>
        <label className='grid gap-1 text-xs text-ui-muted'>{queryLabel}<input type='search' value={query} onChange={event => setQuery(event.target.value)} placeholder='Asset, engine, or status' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
        <label className='grid gap-1 text-xs text-ui-muted'>Status<select value={status} onChange={event => setStatus(event.target.value)} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text'><option value='all'>All statuses</option>{statusOptions.map(option => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select></label>
    </div>
}

export function UvmAssessmentHistory({ assessments, runs, unavailable, busy, nextCursor, loadOlder, onOpenReport, onCancel, onViewRun }: {
    assessments: UvmAssessment[]
    runs: UvmRun[]
    unavailable: boolean
    busy: string
    nextCursor: string | null
    loadOlder: (cursor: string | null) => Promise<UvmAssessmentHistoryPage>
    onOpenReport: (assessment: UvmAssessment) => void
    onCancel: (assessment: UvmAssessment) => void
    onViewRun: (runId: string) => void
}) {
    const [query, setQuery] = useState('')
    const [status, setStatus] = useState('all')
    const [page, setPage] = useState(0)
    const [olderAssessments, setOlderAssessments] = useState<UvmAssessment[]>([])
    const [cursor, setCursor] = useState(nextCursor)
    const [loadingOlder, setLoadingOlder] = useState(false)
    const [loadError, setLoadError] = useState('')
    useEffect(() => { if (!olderAssessments.length) setCursor(nextCursor) }, [nextCursor, olderAssessments.length])
    const needle = query.trim().toLowerCase()
    const allAssessments = [...assessments, ...olderAssessments.filter(assessment => !assessments.some(current => current.id === assessment.id))]
    const filtered = allAssessments.filter(assessment => {
        if (status !== 'all' && assessment.status !== status) return false
        return !needle || [assessment.status, assessment.source, ...assessment.jobs.flatMap(job => [job.asset, job.engine, job.profile, job.stage, job.status])].join(' ').toLowerCase().includes(needle)
    })
    const pageCount = Math.max(1, Math.ceil(filtered.length / assessmentPageSize))
    const currentPage = Math.min(page, pageCount - 1)
    const pageItems = filtered.slice(currentPage * assessmentPageSize, (currentPage + 1) * assessmentPageSize)

    function updateQuery(value: string) { setQuery(value); setPage(0) }
    function updateStatus(value: string) { setStatus(value); setPage(0) }

    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex items-center justify-between gap-3'><h2 className='text-lg font-semibold'>Assessment history</h2><span className='text-xs text-ui-muted'>{filtered.length} loaded{cursor ? ' · older assessments available' : ''}</span></div>
        <HistoryFilters query={query} setQuery={updateQuery} status={status} setStatus={updateStatus} statusOptions={['queued', 'running', 'cancelling', 'succeeded', 'partial', 'failed', 'cancelled']} queryLabel='Search assessments' />
        <div className='mt-3 grid gap-3'>
            {pageItems.map(assessment => <article key={assessment.id} className='rounded-md border border-ui-border bg-ui-raised p-3'>
                <div className='flex flex-wrap items-start justify-between gap-2'>
                    <div><strong>{assessment.jobs.length} scanner jobs</strong><span className='ml-2 rounded-full bg-ui-canvas px-2 py-1 text-xs'>{assessment.source} · {assessment.status}</span><p className='mt-1 text-xs text-ui-muted'>Started {formatDate(assessment.startedAt || assessment.createdAt)}{assessment.finishedAt ? ` · Finished ${formatDate(assessment.finishedAt)}` : ''}</p></div>
                    <div className='flex gap-2'>
                        <button type='button' onClick={() => onOpenReport(assessment)} disabled={busy === `report:${assessment.id}`} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{busy === `report:${assessment.id}` ? 'Loading…' : 'View report'}</button>
                        {['queued', 'running'].includes(assessment.status) && <button type='button' onClick={() => onCancel(assessment)} disabled={busy === `assessment:${assessment.id}`} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{busy === `assessment:${assessment.id}` ? 'Cancelling…' : 'Cancel'}</button>}
                    </div>
                </div>
                <details className='mt-3 rounded border border-ui-border px-3 py-2'>
                    <summary className='cursor-pointer text-sm font-medium'>Stages · {assessment.jobs.length}</summary>
                    <div className='mt-2 grid gap-2'>
                        {assessment.jobs.map(job => <div key={job.id} className='flex flex-wrap items-center justify-between gap-2 border-t border-ui-border pt-2 text-sm'>
                            <span>Stage {job.stageIndex + 1} · {job.asset} · {job.engine} · {job.profile}</span>
                            <span className='flex items-center gap-2 text-xs text-ui-muted'>{job.status}{job.attemptCount > 1 ? ` · ${job.attemptCount} attempts` : ''}{job.error ? ` · ${job.error}` : ''}{job.runId && runs.some(run => run.id === job.runId) && <button type='button' onClick={() => onViewRun(job.runId!)} className='rounded border border-ui-border px-2 py-1 font-semibold text-ui-text'>View run</button>}</span>
                        </div>)}
                    </div>
                </details>
            </article>)}
            {!filtered.length && <p className='text-sm text-ui-muted'>{unavailable ? 'Scanner data is unavailable.' : allAssessments.length ? 'No assessments match these filters.' : 'No assessments yet.'}</p>}
        </div>
        <PageControls page={currentPage} pageCount={pageCount} onChange={setPage} />
        {loadError && <p role='status' className='mt-3 text-sm text-ui-warning'>{loadError}</p>}
        {cursor && <button type='button' disabled={loadingOlder} onClick={() => {
            setLoadingOlder(true); setLoadError('')
            void loadOlder(cursor).then(result => {
                setOlderAssessments(current => [...current, ...result.assessments.filter(assessment => !current.some(existing => existing.id === assessment.id))])
                setCursor(result.nextCursor)
            }).catch(error => setLoadError(error instanceof Error ? error.message : 'Older assessments could not be loaded.'))
                .finally(() => setLoadingOlder(false))
        }} className='mt-3 rounded-md border border-ui-border px-3 py-2 text-sm font-semibold disabled:opacity-50'>{loadingOlder ? 'Loading…' : 'Load older assessments'}</button>}
    </section>
}

export function UvmRunHistory({ data, unavailable, selectedRunId, busy, nextCursor, loadOlder, onCancel }: {
    data: UvmDashboard
    unavailable: boolean
    selectedRunId: string | null
    busy: string
    nextCursor: string | null
    loadOlder: (cursor: string | null) => Promise<UvmRunHistoryPage>
    onCancel: (run: UvmRun) => void
}) {
    const [query, setQuery] = useState('')
    const [engine, setEngine] = useState('all')
    const [status, setStatus] = useState('all')
    const [page, setPage] = useState(0)
    const [olderRuns, setOlderRuns] = useState<UvmRun[]>([])
    const [cursor, setCursor] = useState(nextCursor)
    const [loadingOlder, setLoadingOlder] = useState(false)
    const [loadError, setLoadError] = useState('')
    useEffect(() => { if (!olderRuns.length) setCursor(nextCursor) }, [nextCursor, olderRuns.length])
    const needle = query.trim().toLowerCase()
    const allRuns = [...data.runs, ...olderRuns.filter(run => !data.runs.some(current => current.id === run.id))]
    const filtered = allRuns.filter(run => {
        if (engine !== 'all' && run.engine !== engine) return false
        if (status !== 'all' && run.status !== status) return false
        return !needle || [run.target, run.engine, run.profile, run.status, run.source || '', run.id].join(' ').toLowerCase().includes(needle)
    })
    const pageCount = Math.max(1, Math.ceil(filtered.length / runPageSize))
    const currentPage = Math.min(page, pageCount - 1)
    const pageItems = filtered.slice(currentPage * runPageSize, (currentPage + 1) * runPageSize)

    function updateQuery(value: string) { setQuery(value); setPage(0) }
    function updateEngine(value: string) { setEngine(value); setPage(0) }
    function updateStatus(value: string) { setStatus(value); setPage(0) }

    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex items-center justify-between gap-3'><h2 className='text-lg font-semibold'>Scanner runs</h2><span className='text-xs text-ui-muted'>{filtered.length} loaded{cursor ? ' · older runs available' : ''}</span></div>
        <div className='mt-3 grid gap-2 sm:grid-cols-3'>
            <label className='grid gap-1 text-xs text-ui-muted'>Search runs<input type='search' value={query} onChange={event => updateQuery(event.target.value)} placeholder='Asset, engine, profile, or run ID' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Engine<select value={engine} onChange={event => updateEngine(event.target.value)} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text'><option value='all'>All engines</option><option value='nmap'>Nmap</option><option value='tenable-vm'>Tenable VM</option><option value='gvm'>Greenbone</option><option value='zap'>OWASP ZAP</option></select></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Status<select value={status} onChange={event => updateStatus(event.target.value)} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text'><option value='all'>All statuses</option>{['queued', 'launching', 'running', 'exporting', 'succeeded', 'partial', 'failed', 'cancelling', 'cancelled'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        <div className='mt-3 grid gap-3'>
            {pageItems.map((run, index) => <RunCard key={run.id} run={run} defaultOpen={run.id === selectedRunId || (selectedRunId === null && currentPage === 0 && index === 0)} cancelBusy={busy === `run:${run.id}`} onCancel={() => onCancel(run)} />)}
            {!filtered.length && <p className='text-sm text-ui-muted'>{unavailable ? 'Scanner data is unavailable.' : allRuns.length ? 'No runs match these filters.' : 'No scanner runs yet.'}</p>}
        </div>
        <PageControls page={currentPage} pageCount={pageCount} onChange={setPage} />
        {loadError && <p role='status' className='mt-3 text-sm text-ui-warning'>{loadError}</p>}
        {cursor && <button type='button' disabled={loadingOlder} onClick={() => {
            setLoadingOlder(true); setLoadError('')
            void loadOlder(cursor).then(result => {
                setOlderRuns(current => [...current, ...result.runs.filter(run => !current.some(existing => existing.id === run.id))])
                setCursor(result.nextCursor)
            }).catch(error => setLoadError(error instanceof Error ? error.message : 'Older scanner runs could not be loaded.'))
                .finally(() => setLoadingOlder(false))
        }} className='mt-3 rounded-md border border-ui-border px-3 py-2 text-sm font-semibold disabled:opacity-50'>{loadingOlder ? 'Loading…' : 'Load older runs'}</button>}
    </section>
}
