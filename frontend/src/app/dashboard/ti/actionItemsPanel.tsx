import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { DashboardTablePanel } from '@/components/dashboard/ui'
import { formatTiDate, type TiAdminOverview } from '@/utils/tiAdmin/ops'
import { operationalStateLabel, StatusPill, type StatusTone } from './dashboardPresentation'

type ActionItem = {
    kind: string
    priority: string
    tone: StatusTone
    title: string
    reason: string
    state: string
    href: string
}

export function buildActionItems({ candidateSources, staleSources, failedRuns, latestCapture }: {
    candidateSources: TiAdminOverview['sources']
    staleSources: TiAdminOverview['sources']
    failedRuns: TiAdminOverview['runs']
    latestCapture?: TiAdminOverview['captures'][number]
}): ActionItem[] {
    return [
        ...failedRuns.map(run => ({
            kind: 'run', priority: 'failed', tone: 'bad' as const, title: run.id,
            reason: run.message, state: `Started ${formatTiDate(run.startedAt)}`, href: '/ti/runs',
        })),
        ...staleSources.map(source => ({
            kind: 'source', priority: 'stale', tone: 'bad' as const, title: source.name,
            reason: `Last collected ${formatTiDate(source.lastRunAt)}`,
            state: `${source.cadenceMinutes}m cadence`, href: `/ti/sources/${source.id}`,
        })),
        ...candidateSources.map(source => ({
            kind: 'source', priority: source.status, tone: 'watch' as const, title: source.name,
            reason: `Approve ${source.accessMethod}; risk ${source.risk}; ${source.resultTypes.length} result types.`,
            state: `Last ${formatTiDate(source.lastRunAt)} · next ${formatTiDate(source.nextRunAt)} · ${source.cadenceMinutes}m cadence`,
            href: `/ti/sources/${source.id}`,
        })),
        ...(latestCapture ? [{
            kind: 'capture', priority: 'evidence', tone: 'neutral' as const, title: latestCapture.title,
            reason: latestCapture.resultSummary, state: `Captured ${formatTiDate(latestCapture.capturedAt)}`,
            href: `/ti/sources/${latestCapture.sourceId}#${latestCapture.id}`,
        }] : []),
    ].slice(0, 10)
}

export function ActionItemsPanel({ items, queuedCount, latestRunStatus, latestRunTone, actorUpdates }: {
    items: ActionItem[]
    queuedCount: number
    latestRunStatus: string
    latestRunTone: StatusTone
    actorUpdates: number
}) {
    return (
        <DashboardTablePanel
            header={
                <div className='border-b border-ui-border bg-ui-raised p-4 text-ui-text'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold'>Next actions</h2>
                            <p className='mt-1 text-sm text-ui-muted'>{items.length} signals from automated monitoring.</p>
                        </div>
                        <div className='flex flex-wrap gap-2 text-xs font-semibold'>
                            <StatusPill label={`${queuedCount} running/queued`} tone={queuedCount ? 'watch' : 'neutral'} />
                            <StatusPill label={`latest ${operationalStateLabel(latestRunStatus)}`} tone={latestRunTone} />
                            <StatusPill label={`${actorUpdates} actor updates 1h`} tone='neutral' />
                        </div>
                    </div>
                </div>
            }
            columnHeaders={<>
                <th className='px-4 py-3'>Signal</th>
                <th className='px-4 py-3'>Item</th>
                <th className='px-4 py-3'>Details</th>
                <th className='px-4 py-3'>State</th>
                <th className='px-4 py-3 text-right'>Open</th>
            </>}
        >
            {items.map(item => (
                <tr key={`${item.kind}-${item.title}`} className='hover:bg-ui-panel'>
                    <td className='px-4 py-4'>
                        <StatusPill label={item.priority} tone={item.tone} />
                    </td>
                    <td className='px-4 py-3 font-semibold text-ui-text'>{item.title}</td>
                    <td className='px-4 py-3 text-ui-muted'>{item.reason}</td>
                    <td className='px-4 py-3 text-ui-muted'>{operationalStateLabel(item.state)}</td>
                    <td className='px-4 py-4 text-right'>
                        <Link
                            href={item.href}
                            className='inline-flex h-8 items-center gap-1 rounded-md border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text hover:bg-ui-raised'
                        >
                            Open
                            <ArrowRight className='h-3.5 w-3.5' />
                        </Link>
                    </td>
                </tr>
            ))}
            {!items.length ? (
                <tr>
                    <td colSpan={5} className='px-4 py-8 text-center text-sm text-ui-muted'>
                        Automated monitoring is clear; new signals are recorded automatically.
                    </td>
                </tr>
            ) : null}
        </DashboardTablePanel>
    )
}
