import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import type { TiAdminOverview } from '@/utils/tiAdmin/ops'
import { relativeUntil } from './runPresentation'
import type { CollectionRunSummary } from './runSummaryModel'

export function RunAttentionPanel({ summary, runs, sources }: {
    summary: CollectionRunSummary
    runs: TiAdminOverview['runs']
    sources: TiAdminOverview['sources']
}) {
    const { attentionRuns, captureTotal, screenshotTotal } = summary

    return <div className='grid gap-4 xl:grid-cols-[1fr_0.9fr]'>
        <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <h2 className='text-base font-semibold text-ui-text'>{attentionRuns.length ? 'Runs needing attention' : runs.length ? 'No runs need attention' : 'No run history to assess'}</h2>
                    <p className='mt-1 text-sm text-ui-muted'>{attentionRuns.length ? 'Failures, long-running jobs, and overdue next checks stay in the live attention stream.' : runs.length ? 'Recorded runs are completing without a failure or overdue check.' : 'A missing run record is not evidence that all systems are operational.'}</p>
                </div>
                {attentionRuns.length ? <AlertTriangle className='h-4 w-4 text-ui-warning' /> : <span className='grid h-7 w-7 place-items-center rounded-full bg-ui-success/15 text-ui-success'><CheckCircle2 className='h-4 w-4' /></span>}
            </div>
            {attentionRuns.length ? <div className='mt-4 grid gap-2'>
                {attentionRuns.map(run => <Link key={run.id} href={run.sourceId ? `/ti/sources/${run.sourceId}` : '/ti/sources'} className='grid gap-3 rounded-md border border-ui-border bg-ui-canvas p-3 md:grid-cols-[1fr_auto] md:items-center hover:border-ui-primary/35'>
                    <div>
                        <p className='font-mono text-xs font-semibold text-ui-text'>{run.id}</p>
                        <p className='mt-1 text-sm text-ui-muted'>{run.sourceName} · {run.status}{run.nextRunAt ? ` · next ${relativeUntil(run.nextRunAt)}` : ''}</p>
                    </div>
                    <span className='inline-flex items-center gap-1 text-sm font-semibold text-ui-primary'>Open source <ArrowRight className='h-3.5 w-3.5' /></span>
                </Link>)}
            </div> : null}
        </DashboardPanel>

        <details data-ti-runs-evidence-disclosure className='group overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
            <summary className='flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/25 [&::-webkit-details-marker]:hidden'>
                <span>
                    <span className='block text-base font-semibold text-ui-text'>Evidence by source</span>
                    <span className='mt-1 block text-sm text-ui-muted'>Collectors producing usable captures.</span>
                </span>
                <span className='inline-flex items-center gap-2 text-xs font-semibold text-ui-muted'>
                    {captureTotal} captures · {screenshotTotal} screenshots
                    <ChevronDown className='h-4 w-4 transition-transform group-open:rotate-180' />
                </span>
            </summary>
            <div className='grid gap-3 border-t border-ui-border p-4'>
                {sources.map(source => <SourceEvidence key={source.id} source={source} runs={runs} totalCaptures={captureTotal} />)}
            </div>
        </details>
    </div>
}

function SourceEvidence({ source, runs, totalCaptures }: {
    source: TiAdminOverview['sources'][number]
    runs: TiAdminOverview['runs']
    totalCaptures: number
}) {
    const sourceRuns = runs.filter(run => run.sourceId === source.id)
    const sourceScreenshots = sourceRuns.reduce((sum, run) => sum + run.screenshots, 0)
    const sourceCaptures = source.retainedEvidenceCount
    const captureShare = sourceCaptures / Math.max(totalCaptures, 1) * 100
    const width = Math.min(100, Math.max(sourceCaptures ? 8 : 0, captureShare))

    return <div className='rounded-md border border-ui-border bg-ui-canvas p-3'>
        <div className='flex items-center justify-between gap-3'>
            <p className='truncate text-sm font-semibold text-ui-text'>{source.name}</p>
            <span className='text-sm font-semibold text-ui-primary'>{sourceCaptures}</span>
        </div>
        <p className='mt-1 text-xs text-ui-muted'>{sourceScreenshots} screenshots in bounded sample · {sourceRuns.length} sampled runs</p>
        <div className='mt-3 h-2 overflow-hidden rounded-full bg-ui-raised'>
            <div className='h-full rounded-full bg-ui-primary' style={{ width: `${width}%` }} />
        </div>
    </div>
}
