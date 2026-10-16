import Link from 'next/link'
import { ArrowRight, Rows3 } from 'lucide-react'
import PageNavigation from '@/components/dashboard/page-navigation'
import { DashboardPanel } from '@/components/dashboard/ui'
import type { TiAdminOverview } from '@/utils/tiAdmin/ops'
import { durationLabel, shortDate, statusClass } from './runPresentation'
import type { CollectionRunSummary } from './runSummaryModel'

export function RunActivityPanel({ summary, sources, page, total }: {
    summary: CollectionRunSummary
    sources: TiAdminOverview['sources']
    page: number
    total: number
}) {
    const { orderedRuns: runs, captureTotal, screenshotTotal, rowTotal } = summary

    return <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
            <div>
                <h2 className='text-base font-semibold text-ui-text'>Collector activity</h2>
                <p className='mt-1 text-sm text-ui-muted'>Newest work first; failed and overdue sources stay visible.</p>
            </div>
            <div className='flex flex-wrap gap-2'>
                <QueuePill label='Captures' count={captureTotal} />
                <QueuePill label='Screenshots' count={screenshotTotal} />
                <QueuePill label='Rows' count={rowTotal} />
            </div>
        </div>

        <div className='overflow-x-auto'>
            <div className='min-w-[78rem]'>
                <RunTableHeader />
                {runs.map(run => {
                    const source = sources.find(item => item.id === run.sourceId)
                    const nextRunAt = run.nextRunAt || source?.nextRunAt
                    return <div key={run.id} className='grid grid-cols-[1.15fr_1.25fr_0.7fr_0.75fr_0.75fr_0.75fr_0.9fr_0.85fr] gap-3 border-b border-ui-border px-4 py-2.5 text-sm last:border-b-0 hover:bg-ui-panel'>
                        <div className='min-w-0'>
                            <p className='truncate font-mono text-xs font-semibold text-ui-text'>{run.id}</p>
                            {run.message ? <p className='mt-1 line-clamp-1 text-xs text-ui-muted'>{run.message}</p> : null}
                        </div>
                        <SourceCell run={run} />
                        <span className={statusClass(run.status)}>{run.status}</span>
                        <span className='text-ui-muted'>{shortDate(run.startedAt)}</span>
                        <span className='font-semibold text-ui-text'>{durationLabel(run.startedAt, run.finishedAt)}</span>
                        <span className='text-ui-primary'>{run.captures} cap · {run.screenshots} shots · {run.rows} rows</span>
                        <span className='text-ui-muted'>{nextRunAt ? shortDate(nextRunAt) : 'Schedule unavailable'}</span>
                        {run.sourceId ? <Link href={`/ti/sources/${run.sourceId}`} className='inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text hover:bg-ui-raised'>
                            Source<ArrowRight className='h-3.5 w-3.5' />
                        </Link> : <span className='text-xs text-ui-muted'>Fleet run</span>}
                    </div>
                })}
            </div>
        </div>
        <PageNavigation page={page} total={total} hasNext={page * 50 < total} href={next => `/ti/runs?page=${next}`} label='Collection run pages' />
    </DashboardPanel>
}

function RunTableHeader() {
    return <div className='grid grid-cols-[1.15fr_1.25fr_0.7fr_0.75fr_0.75fr_0.75fr_0.9fr_0.85fr] gap-3 border-b border-ui-border bg-ui-canvas px-4 py-2 text-xs font-semibold uppercase text-ui-muted'>
        <span>Run</span><span>Feed</span><span>Status</span><span>Started</span>
        <span>Duration</span><span>Evidence</span><span>Next check</span><span>Action</span>
    </div>
}

function SourceCell({ run }: { run: TiAdminOverview['runs'][number] }) {
    const content = <>
        <span className='block truncate'>{run.sourceName}</span>
        <span className='mt-1 block truncate text-xs font-normal text-ui-muted'>{run.sourceUrl || run.sourceFamily.replaceAll('_', ' ')}</span>
    </>
    return run.sourceId
        ? <Link href={`/ti/sources/${run.sourceId}`} className='min-w-0 font-semibold text-ui-text hover:text-ui-primary'>{content}</Link>
        : <div className='min-w-0 font-semibold text-ui-text'>{content}</div>
}

function QueuePill({ label, count }: { label: string, count: number }) {
    return <span className='inline-flex items-center gap-1 rounded-full border border-ui-border bg-ui-panel px-3 py-1 text-xs font-semibold text-ui-text'>
        <Rows3 className='h-3.5 w-3.5 text-ui-primary' />{label}: {count}
    </span>
}
