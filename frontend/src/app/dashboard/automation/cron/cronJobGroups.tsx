import { AlertTriangle, CalendarClock, ChevronDown, Clock3, Cpu, FileText, PauseCircle, PlayCircle, Save, ServerCog, TerminalSquare, Zap } from 'lucide-react'
import type { ManagedCronJob } from '@/utils/systemCron/client'
import { DashboardPanel } from 'hanasand/dashboard'
import AutomationField from '../automationField'
import { cadenceLabel, controlLabel, CostPill, duration, Info, money, reliabilityLabel, resourceLabel, StatusPill, timeLabel } from './cronJobPresentation'

const categories: ManagedCronJob['category'][] = ['TI / Exposure', 'Alerts', 'Mail', 'Backup/Database', 'Forgejo', 'Other/System']
type JobPatch = { enabled?: boolean, action?: 'run_now' }

type Props = {
    jobs: ManagedCronJob[]
    compact: boolean
    drafts: Record<string, string>
    busy: string
    onDraftChange: (jobId: string, value: string) => void
    onSave: (job: ManagedCronJob, patch?: JobPatch) => void
}

export default function CronJobGroups({ jobs, compact, drafts, busy, onDraftChange, onSave }: Props) {
    return <>
        {categories.map(category => {
            const rows = jobs.filter(job => job.category === category)
            if (!rows.length) return null
            return <section key={category} className='grid gap-2'>
                <div className='flex items-center justify-between gap-3 px-1'>
                    <h2 className='text-sm font-semibold uppercase tracking-normal text-ui-muted'>{category}</h2>
                    <span className='text-xs text-ui-muted'>{rows.length} job{rows.length === 1 ? '' : 's'}</span>
                </div>
                <div className='grid gap-2'>
                    {rows.map(job => <CronJobCard key={job.id} job={job} compact={compact} draft={drafts[job.id] ?? job.schedule} busy={busy === job.id} onDraftChange={value => onDraftChange(job.id, value)} onSave={patch => onSave(job, patch)} />)}
                </div>
            </section>
        })}
    </>
}

function CronJobCard({ job, compact, draft, busy, onDraftChange, onSave }: {
    job: ManagedCronJob
    compact: boolean
    draft: string
    busy: boolean
    onDraftChange: (value: string) => void
    onSave: (patch?: JobPatch) => void
}) {
    return <DashboardPanel id={`job-${job.id}`} className={`grid ${compact ? 'gap-2 p-3' : 'gap-3 p-4'}`}>
        <div className={`grid ${compact ? 'gap-2' : 'gap-3'} lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start`}>
            <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                    <ServerCog className='h-4 w-4 text-ui-muted' />
                    <h3 className='text-base font-semibold text-ui-text'>{job.name}</h3>
                    <StatusPill job={job} />
                    <CostPill job={job} />
                    <span className='inline-flex max-w-full items-center gap-1 rounded-full border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted'>
                        <CalendarClock className='h-3.5 w-3.5' /><span className='truncate'>{cadenceLabel(job)}</span>
                    </span>
                    <span title={job.assumptions.join(' ')} className='inline-flex max-w-full items-center gap-1 rounded-full border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted'>
                        <FileText className='h-3.5 w-3.5' /><span className='truncate'>{controlLabel(job)}</span>
                    </span>
                </div>
                <p className={`${compact ? 'mt-0.5 line-clamp-1' : 'mt-1'} text-sm leading-5 text-ui-muted`}>{job.description}</p>
                <div className={`${compact ? 'hidden' : 'mt-3 grid'} gap-2 sm:grid-cols-3`}>
                    <Info icon={<CalendarClock className='h-4 w-4' />} label='Schedule' value={job.schedule} />
                    <Info icon={<Clock3 className='h-4 w-4' />} label='Next run' value={timeLabel(job.nextRunAt)} />
                    <Info icon={<AlertTriangle className='h-4 w-4' />} label='Reliability' value={reliabilityLabel(job)} />
                </div>
            </div>
            <div className='flex flex-wrap gap-2 lg:justify-end'>
                {(job.controls.includes('pause') || job.controls.includes('resume')) && <button onClick={() => onSave({ enabled: !job.enabled })} disabled={busy} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:border-ui-primary hover:bg-ui-panel disabled:cursor-not-allowed disabled:opacity-50'>
                    {job.enabled ? <PauseCircle className='h-4 w-4' /> : <PlayCircle className='h-4 w-4' />}{busy ? 'Saving' : job.enabled ? 'Pause' : 'Resume'}
                </button>}
                {job.controls.includes('run_now') && <button onClick={() => onSave({ action: 'run_now' })} disabled={busy} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:border-ui-primary hover:bg-ui-panel disabled:cursor-not-allowed disabled:opacity-50'>
                    <PlayCircle className='h-4 w-4' />{busy ? 'Starting' : 'Run now'}
                </button>}
                {!job.controls.length && <span className='inline-flex h-9 items-center rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted' title={job.assumptions.join(' ')}>Audit only</span>}
            </div>
        </div>
        {job.controls.includes('edit_schedule') && <ScheduleControls job={job} draft={draft} onDraftChange={onDraftChange} onSave={() => onSave()} />}
        <RuntimeDetails job={job} />
    </DashboardPanel>
}

function ScheduleControls({ job, draft, onDraftChange, onSave }: {
    job: ManagedCronJob
    draft: string
    onDraftChange: (value: string) => void
    onSave: () => void
}) {
    return <details data-testid='cron-schedule-controls' className='group rounded-lg border border-ui-border bg-ui-raised'>
        <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary'>
            <span>Schedule controls</span>
            <span className='flex min-w-0 items-center gap-2 text-xs font-medium text-ui-muted'>
                <span className='truncate font-mono'>{draft}</span><ChevronDown className='h-4 w-4 shrink-0 transition group-open:rotate-180' />
            </span>
        </summary>
        <AutomationField label='Cron expression' fieldClassName='grid gap-1 border-t border-ui-border p-3' labelClassName='text-xs font-semibold uppercase text-ui-muted'>
            <div className='flex gap-2'>
                <input value={draft} onChange={event => onDraftChange(event.target.value)} className='min-h-10 flex-1 rounded-lg border border-ui-border bg-ui-raised px-3 font-mono text-sm text-ui-text outline-none focus:border-ui-primary' />
                <button onClick={onSave} className='grid h-10 w-10 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-text hover:border-ui-primary hover:bg-ui-panel' title='Save schedule' aria-label={`Save ${job.name} schedule`}>
                    <Save className='h-4 w-4' />
                </button>
            </div>
        </AutomationField>
    </details>
}

function RuntimeDetails({ job }: { job: ManagedCronJob }) {
    return <details className='group rounded-lg border border-ui-border bg-ui-raised'>
        <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary'>
            <span>Runtime, audit, and log details</span><ChevronDown className='h-4 w-4 text-ui-muted transition group-open:rotate-180' />
        </summary>
        <div className='grid gap-2 border-t border-ui-border p-3 md:grid-cols-2'>
            <Info icon={<Clock3 className='h-4 w-4' />} label='Last run' value={timeLabel(job.lastRunAt)} />
            <Info icon={<Clock3 className='h-4 w-4' />} label='Runtime' value={`${duration(job.currentRunDurationMs) || 'not running'} current; ${duration(job.averageRuntimeMs) || 'measuring'} avg`} />
            <Info icon={<Cpu className='h-4 w-4' />} label='Resources' value={resourceLabel(job)} />
            <Info icon={<Zap className='h-4 w-4' />} label='Cost' value={`${money(job.costEstimate.hourlyUsd)}/hr · ${money(job.costEstimate.dailyUsd)}/day`} />
            <Info icon={<FileText className='h-4 w-4' />} label='Control' value={controlLabel(job)} />
            <Info icon={<FileText className='h-4 w-4' />} label='Definition' value={`${job.source} · ${job.service}`} mono />
            <Info icon={<FileText className='h-4 w-4' />} label='Fallback' value={job.assumptions.join(' ')} />
            <Info icon={<TerminalSquare className='h-4 w-4' />} label='Log' value={job.logExcerpt || 'Log stream live; no recent line.'} mono />
        </div>
    </details>
}
