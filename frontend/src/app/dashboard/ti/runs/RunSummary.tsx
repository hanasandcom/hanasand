import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, PlayCircle, Rows3 } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import type { TiAdminOverview } from '@/utils/tiAdmin/ops'
import { StatusPill } from '../dashboardPresentation'
import { durationLabel, isOverdue, relativeUntil, runStatusTone } from './runPresentation'
import type { CollectionRunSummary } from './runSummaryModel'

export function RunSummary({ summary }: {
    summary: CollectionRunSummary
}) {
    const currentRun = summary.orderedRuns.find(run => run.status === 'running' || run.status === 'queued') || summary.orderedRuns[0]
    const nextRun = summary.nextRun
    const nextSource = summary.nextSource
    const nextRunAt = nextRun?.nextRunAt || nextSource?.nextRunAt

    return <>
        <section className='grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr]'>
            <LiveRunCard run={currentRun} sourceName={summary.orderedRuns[0]?.sourceName} />
            <LiveFact title='Evidence produced' value={`${summary.captureTotal} captures`} detail={`${summary.screenshotTotal} screenshots, ${summary.rowTotal} parsed rows`} tone={summary.captureTotal ? 'ok' : 'neutral'} />
            <LiveFact
                title='Next feed due'
                value={nextRunAt ? relativeUntil(nextRunAt) : 'No upcoming source'}
                detail={nextRun?.sourceName || nextSource?.name || 'No active feed is queued'}
                url={nextRun?.sourceUrl || nextSource?.url}
                tone={nextRunAt && isOverdue(nextRunAt) ? 'watch' : 'neutral'}
            />
        </section>

        {summary.orderedRuns.length ? <details data-ti-runs-summary-disclosure className='group overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
            <summary className='flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/25 [&::-webkit-details-marker]:hidden'>
                <span className='inline-flex items-center gap-2'><Rows3 className='h-4 w-4 text-ui-primary' />Run totals</span>
                <span className='inline-flex items-center gap-2 text-xs font-semibold text-ui-muted'>
                    {summary.running} active · {summary.completed} complete · {summary.failed} failed
                    <ChevronDown className='h-4 w-4 transition-transform group-open:rotate-180' />
                </span>
            </summary>
            <div className='grid gap-3 border-t border-ui-border p-3 sm:grid-cols-2 xl:grid-cols-5'>
                <Metric title='Running' value={String(summary.running)} detail='queued or active' tone={summary.running ? 'hold' : 'ok'} />
                <Metric title='Completed' value={String(summary.completed)} detail='successful jobs' tone='ok' />
                <Metric title='Failed' value={String(summary.failed)} detail='needs retry' tone={summary.failed ? 'warn' : 'ok'} />
                <Metric title='Evidence' value={`${summary.captureTotal} captures`} detail={`${summary.screenshotTotal} screenshots · ${summary.rowTotal} parsed rows`} tone='hold' />
                <Metric title='Next run' value={nextRunAt ? relativeUntil(nextRunAt) : 'No upcoming source'} detail={[nextRun?.sourceName || nextSource?.name, nextRun?.sourceUrl || nextSource?.url].filter(Boolean).join(' · ') || 'No active feed is queued'} tone='hold' />
            </div>
        </details> : null}
    </>
}

function LiveRunCard({ run, sourceName }: { run?: TiAdminOverview['runs'][number], sourceName?: string }) {
    return <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
        <div className='flex items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
            <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'><PlayCircle className='h-4 w-4 text-ui-primary' />Collector now</div>
            {run ? <StatusPill compact label={run.status} tone={runStatusTone(run.status)} className='inline-flex w-fit self-start whitespace-nowrap capitalize leading-5' /> : null}
        </div>
        <div className='p-4'>
            <p className='line-clamp-1 text-lg font-semibold text-ui-text'>{sourceName || (run ? 'Unknown source' : 'No active collection')}</p>
            {run?.sourceUrl ? <p className='mt-1 break-all text-sm text-ui-muted'>{run.sourceUrl}</p> : null}
            {run?.message ? <p className='mt-1 text-sm text-ui-muted'>{run.message}</p> : null}
            <div className='mt-3 grid grid-cols-3 gap-2'>
                <Mini label='Rows' value={String(run?.rows ?? 0)} />
                <Mini label='Captures' value={String(run?.captures ?? 0)} />
                <Mini label='Runtime' value={run ? durationLabel(run.startedAt, run.finishedAt) : '-'} />
            </div>
        </div>
    </DashboardPanel>
}

function LiveFact({ title, value, detail, url, tone }: { title: string, value: string, detail: string, url?: string, tone: 'neutral' | 'ok' | 'watch' }) {
    const toneClass = tone === 'ok' ? 'text-ui-success' : tone === 'watch' ? 'text-ui-warning' : 'text-ui-primary'
    return <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
        <div className='flex items-center justify-between gap-3'>
            <p className='text-xs font-semibold uppercase text-ui-muted'>{title}</p>
            <span className={toneClass}><Rows3 className='h-4 w-4' /></span>
        </div>
        <p className='mt-3 text-xl font-semibold text-ui-text'>{value}</p>
        <p className='mt-1 text-sm leading-5 text-ui-muted'>{detail}</p>
        {url ? <p className='mt-1 break-all text-xs text-ui-muted'>{url}</p> : null}
    </DashboardPanel>
}

function Metric({ title, value, detail, tone }: { title: string, value: string, detail: string, tone: 'ok' | 'warn' | 'hold' }) {
    const icon = tone === 'ok' ? <CheckCircle2 className='h-4 w-4' /> : tone === 'warn' ? <AlertTriangle className='h-4 w-4' /> : <Clock3 className='h-4 w-4' />
    return <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
        <div className='flex items-center justify-between text-ui-muted'><p className='text-xs font-semibold uppercase'>{title}</p>{icon}</div>
        <p className='mt-3 text-xl font-semibold text-ui-text'>{value}</p>
        <p className='mt-1 text-sm text-ui-muted'>{detail}</p>
    </DashboardPanel>
}

function Mini({ label, value }: { label: string, value: string }) {
    return <div className='rounded-md border border-ui-border bg-ui-canvas px-2.5 py-2'>
        <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
        <p className='mt-0.5 truncate text-xs font-semibold text-ui-text'>{value}</p>
    </div>
}
