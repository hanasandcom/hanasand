import type { ReactNode } from 'react'
import Link from 'next/link'
import { Activity, Send, ShieldCheck, Webhook } from 'lucide-react'
import { DashboardPanel } from 'hanasand/dashboard'
import { formatTiDate, type TiAdminOverview } from '@/utils/tiAdmin/ops'
import { operationalStateLabel, PanelTitle, StatusPill, toneClass, type StatusTone } from './dashboardPresentation'
import { TiAdminDataTable } from './TiAdminDataTable'

type Source = TiAdminOverview['sources'][number]

export function SourcesPanel({ sources, runs, staleSources }: {
    sources: Source[]
    runs: TiAdminOverview['runs']
    staleSources: Source[]
}) {
    return (
        <TiAdminDataTable
            title='Sources being checked'
            actionHref='/ti/sources'
            actionLabel='Sources'
            columns={['Source', 'Status', 'Findings', 'Last seen', 'Due', 'Matches']}
        >
            {[...sources].sort((a, b) =>
                new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()
            ).map(source => {
                const stale = staleSources.includes(source)
                const sourceRuns = runs.filter(run => run.sourceId === source.id)
                const rowsPerRun = sourceRuns.length
                    ? Math.round(sourceRuns.reduce((sum, run) => sum + run.rows, 0) / sourceRuns.length)
                    : 0
                return (
                    <tr key={source.id} className='hover:bg-ui-panel'>
                        <td className='px-4 py-4'>
                            <Link href={`/ti/sources/${source.id}`} className='font-semibold text-ui-text hover:text-ui-primary'>
                                {source.name}
                            </Link>
                            <p className='mt-1 text-xs text-ui-muted'>{source.family}</p>
                        </td>
                        <td className='px-4 py-4'>
                            <StatusPill
                                label={stale ? 'stale' : operationalStateLabel(source.status)}
                                tone={stale ? 'bad' : source.status === 'active' ? 'ok' : 'watch'}
                            />
                        </td>
                        <td className='px-4 py-3 text-ui-muted'>
                            {rowsPerRun
                                ? `${rowsPerRun} rows/run`
                                : `${source.retainedEvidenceCount} retained captures`}
                        </td>
                        <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatTiDate(source.lastRunAt)}</td>
                        <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatTiDate(source.nextRunAt)}</td>
                        <td className='px-4 py-3 text-ui-muted'>
                            {source.domains.length} terms · {source.resultTypes.length} result types
                        </td>
                    </tr>
                )
            })}
        </TiAdminDataTable>
    )
}

export function DeliveryStatePanel({ reviewCount, domainCount, latestRun }: {
    reviewCount: number
    domainCount: number
    latestRun?: TiAdminOverview['runs'][number]
}) {
    return (
        <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
            <PanelTitle title='Delivery state' actionHref='/findings' actionLabel='Dark web cases' />
            <div className='grid gap-3 p-4'>
                <DeliveryRow
                    icon={<ShieldCheck className='h-4 w-4' />}
                    title='Matches detected'
                    value={`${reviewCount} entity matches`}
                    tone={reviewCount ? 'watch' : 'ok'}
                />
                <DeliveryRow
                    icon={<Webhook className='h-4 w-4' />}
                    title='Webhook delivery'
                    value='Delivery records are linked to dark web alerts'
                    tone='neutral'
                />
                <DeliveryRow
                    icon={<Send className='h-4 w-4' />}
                    title='Customer routing'
                    value={`${domainCount} monitored entities`}
                    tone='neutral'
                />
                <DeliveryRow
                    icon={<Activity className='h-4 w-4' />}
                    title='Latest collection'
                    value={latestRun
                        ? `${operationalStateLabel(latestRun.status)} · ${formatTiDate(latestRun.startedAt)}`
                        : 'Selecting source'}
                    tone={latestRun?.status === 'failed' ? 'bad' : latestRun ? 'ok' : 'neutral'}
                />
            </div>
        </DashboardPanel>
    )
}

function DeliveryRow({ icon, title, value, tone }: { icon: ReactNode, title: string, value: string, tone: StatusTone }) {
    return (
        <div className='flex items-start justify-between gap-3 rounded-md border border-ui-border bg-ui-canvas p-3'>
            <div className='flex min-w-0 gap-3'>
                <span className={toneClass(tone).text}>{icon}</span>
                <div className='min-w-0'>
                    <p className='font-semibold text-ui-text'>{title}</p>
                    <p className='mt-1 text-sm text-ui-muted'>{value}</p>
                </div>
            </div>
            <StatusPill
                label={tone === 'ok' ? 'ok' : tone === 'bad' ? 'attention' : tone === 'watch' ? 'watch' : 'tracked'}
                tone={tone}
            />
        </div>
    )
}
