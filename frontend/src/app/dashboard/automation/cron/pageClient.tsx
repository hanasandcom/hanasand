'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Maximize2, Minimize2, PlayCircle, RefreshCcw } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { fetchManagedCronJobs, updateManagedCronJob, type ManagedCronJob } from '@/utils/systemCron/client'
import CronJobGroups from './cronJobGroups'
import { money, needsAttention, operationalStateLabel, primaryHeadline, summarizeCronJobs } from './cronJobPresentation'

const densityStorageKey = 'dashboard-cron-density'

export default function CronJobsClient() {
    const [jobs, setJobs] = useState<ManagedCronJob[] | null>(null)
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState('')
    const [compact, setCompact] = useState(false)
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const loadedJobs = jobs || []
    const summary = useMemo(() => summarizeCronJobs(loadedJobs), [loadedJobs])
    const attentionJobs = useMemo(() => loadedJobs.filter(needsAttention), [loadedJobs])
    const runnableJob = loadedJobs.find(job => job.controls.includes('run_now') && !needsAttention(job))

    useEffect(() => {
        void load()
        setCompact(localStorage.getItem(densityStorageKey) === 'compact')
        return () => {
            if (retryTimer.current) clearTimeout(retryTimer.current)
        }
    }, [])

    async function load() {
        setBusy('load')
        try {
            const payload = await fetchManagedCronJobs()
            if (payload.jobs.length || payload.ready) {
                setJobs(payload.jobs)
                setDrafts(Object.fromEntries(payload.jobs.map(job => [job.id, job.schedule])))
                setMessage(payload.jobs.length
                    ? payload.ready ? 'Background jobs streaming.' : 'Showing the job registry while live state refreshes.'
                    : '')
            }
            if (!payload.ready) retryTimer.current = setTimeout(() => void load(), 1000)
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to load background jobs.')
        } finally {
            setBusy('')
        }
    }

    async function save(job: ManagedCronJob, patch: { enabled?: boolean, action?: 'run_now' } = {}) {
        setBusy(job.id)
        try {
            const payload = await updateManagedCronJob(job.id, {
                ...(job.controls.includes('edit_schedule') ? { schedule: drafts[job.id] || job.schedule } : {}),
                ...patch,
            })
            setJobs(payload.jobs)
            setDrafts(Object.fromEntries(payload.jobs.map(item => [item.id, item.schedule])))
            setMessage(patch.action === 'run_now' ? `${job.name} started.` : `${job.name} saved.`)
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to update background job.')
        } finally {
            setBusy('')
        }
    }

    function setDensity(nextCompact: boolean) {
        setCompact(nextCompact)
        localStorage.setItem(densityStorageKey, nextCompact ? 'compact' : 'spacious')
    }

    if (!jobs) return <LoadingState message={message} onRetry={() => void load()} />

    return <div className='grid gap-3'>
        <DashboardPanel className='grid gap-4 p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase tracking-normal text-ui-muted'>Scheduled operations</p>
                    <h2 className='mt-1 text-lg font-semibold text-ui-text'>{primaryHeadline(summary)}</h2>
                    <p role={jobs.length === 0 ? 'status' : undefined} className='mt-1 text-sm text-ui-muted'>
                        {summary.total ? `${summary.enabled}/${summary.total} enabled · ${summary.running} running · ${money(summary.daily)}/day estimate` : 'No scheduled jobs are currently available.'}
                    </p>
                </div>
                <div className='flex items-center gap-2'>
                    <DensityToggle compact={compact} onChange={setDensity} />
                    <button onClick={() => void load()} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:border-ui-primary hover:bg-ui-panel'>
                        <RefreshCcw className='h-4 w-4' />
                        {busy === 'load' ? 'Refreshing' : 'Refresh'}
                    </button>
                </div>
            </div>
            <div className='grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]'>
                <AttentionSummary jobs={attentionJobs} />
                <NextAction job={runnableJob} busy={busy} onRun={job => void save(job, { action: 'run_now' })} />
            </div>
            {message ? <p className='text-sm text-ui-muted'>{message}</p> : null}
        </DashboardPanel>
        <CronJobGroups
            jobs={jobs}
            compact={compact}
            drafts={drafts}
            busy={busy}
            onDraftChange={(jobId, value) => setDrafts(current => ({ ...current, [jobId]: value }))}
            onSave={(job, patch) => void save(job, patch)}
        />
    </div>
}

function DensityToggle({ compact, onChange }: { compact: boolean, onChange: (value: boolean) => void }) {
    return <div className='flex rounded-lg border border-ui-border bg-ui-raised p-1'>
        <button onClick={() => onChange(true)} aria-label='Compact density' title='Compact density' aria-pressed={compact} className={`grid h-8 w-8 place-items-center rounded-md transition ${compact ? 'bg-ui-primary text-ui-on-primary' : 'text-ui-muted hover:bg-ui-panel hover:text-ui-text'}`}>
            <Minimize2 className='h-4 w-4' />
        </button>
        <button onClick={() => onChange(false)} aria-label='Spacious density' title='Spacious density' aria-pressed={!compact} className={`grid h-8 w-8 place-items-center rounded-md transition ${!compact ? 'bg-ui-primary text-ui-on-primary' : 'text-ui-muted hover:bg-ui-panel hover:text-ui-text'}`}>
            <Maximize2 className='h-4 w-4' />
        </button>
    </div>
}

function AttentionSummary({ jobs }: { jobs: ManagedCronJob[] }) {
    return <section className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3' aria-labelledby='cron-attention-heading'>
        <div className='flex items-center gap-2'>
            <AlertTriangle className={`h-4 w-4 ${jobs.length ? 'text-ui-text' : 'text-ui-success'}`} />
            <h3 id='cron-attention-heading' className='text-sm font-semibold text-ui-text'>Needs attention</h3>
            <span className='ml-auto text-xs font-semibold text-ui-muted'>{jobs.length}</span>
        </div>
        {jobs.length ? <div className='grid gap-2'>
            {jobs.slice(0, 3).map(job => <a key={job.id} href={`#job-${job.id}`} className='rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text transition hover:border-ui-primary'>
                <span className='font-semibold'>{job.name}</span>
                <span className='mt-1 block text-xs text-ui-muted'>{job.lastError || `${operationalStateLabel(job.status)} · ${job.category}`}</span>
            </a>)}
        </div> : <p className='text-sm text-ui-muted'>No blocked or failing jobs in the current inventory.</p>}
    </section>
}

function NextAction({ job, busy, onRun }: { job?: ManagedCronJob, busy: string, onRun: (job: ManagedCronJob) => void }) {
    return <section className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3' aria-labelledby='cron-next-action-heading'>
        <div className='flex items-center gap-2'>
            <PlayCircle className='h-4 w-4 text-ui-primary' />
            <h3 id='cron-next-action-heading' className='text-sm font-semibold text-ui-text'>Next safe action</h3>
        </div>
        {job ? <div className='grid gap-2'>
            <p className='text-sm text-ui-muted'>{job.name} can be run manually without changing the schedule.</p>
            <button onClick={() => onRun(job)} disabled={busy === job.id} className='inline-flex h-9 w-fit items-center gap-2 rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'>
                <PlayCircle className='h-4 w-4' />
                {busy === job.id ? 'Starting' : 'Run selected job'}
            </button>
        </div> : <p className='text-sm text-ui-muted'>No manual run action is available from this snapshot.</p>}
    </section>
}

function LoadingState({ message, onRetry }: { message: string, onRetry: () => void }) {
    return <div className='grid min-h-80 place-items-center rounded-xl border border-ui-border bg-ui-panel p-8 text-center'>
        <div role='status' aria-live='polite'>
            {message ? <AlertTriangle className='mx-auto h-8 w-8 text-ui-text' /> : <RefreshCcw className='mx-auto h-8 w-8 animate-spin text-ui-loader' />}
            <p className='mt-3 text-sm font-semibold text-ui-text'>{message ? 'Unable to load scheduled work' : 'Loading scheduled work'}</p>
            <p className='mt-1 text-sm text-ui-muted'>{message || 'Collecting the latest job inventory.'}</p>
            {message ? <button type='button' onClick={onRetry} className='mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:border-ui-primary'><RefreshCcw className='h-4 w-4' />Try again</button> : null}
        </div>
    </div>
}
