import PageNavigation from '@/components/dashboard/page-navigation'
import { DashboardPanel, DashboardTable } from '@/components/dashboard/ui'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { actorProfileHref } from '@/utils/ti/actorProfileRoute'
import { formatTiDate } from '@/utils/tiAdmin/ops'
import { operationalStateLabel, shortTime, StatusPill } from '../dashboardPresentation'
import type { TiActivityEvent, TiEnrichmentOverview } from '@/utils/tiAdmin/enrichment'
import { relativeAge } from './activityPresentation'

type EventsProps = {
    events: TiActivityEvent[]
    total: number
    page: number
    query: string
    worker: TiEnrichmentOverview['worker']
    updatedActorCount: number
}

export function ActivityEvents({ events, total, page, query, worker, updatedActorCount }: EventsProps) {
    return (
        <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
            <div className='border-b border-ui-border bg-ui-raised px-4 py-3'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>Latest observations</h2>
                        <p className='mt-1 text-sm text-ui-muted'>Newest automated observations with linked sources first.</p>
                    </div>
                    <div className='flex flex-wrap gap-2 text-xs font-semibold'>
                        <StatusPill variant='activity'
                            label={operationalStateLabel(worker.state)}
                            tone={worker.state === 'unavailable' ? 'bad' : worker.state === 'active' ? 'ok' : 'watch'}
                        />
                        <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-1 text-ui-muted'>
                            last sweep {worker.lastSweepFinishedAt ? shortTime(worker.lastSweepFinishedAt) : 'not recorded'}
                        </span>
                        <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-1 text-ui-muted'>
                            {updatedActorCount} actors loaded
                        </span>
                    </div>
                </div>
            </div>
            <div className='overflow-x-auto'>
                <DashboardTable
                    headClassName='bg-ui-raised text-left text-[11px] font-semibold uppercase text-ui-muted'
                    columnHeaders={<>
                        <th className='px-4 py-2'>Time</th>
                        <th className='px-4 py-2'>Actor</th>
                        <th className='px-4 py-2'>Change</th>
                        <th className='px-4 py-2'>Age</th>
                        <th className='px-4 py-2'>Feed</th>
                        <th className='px-4 py-2'>State</th>
                        <th className='px-4 py-2 text-right'>Action</th>
                    </>}
                >
                    {events.map(event => <ActivityRow key={event.id} event={event} />)}
                    {!total && (
                        <tr>
                            <td colSpan={7} className='px-4 py-8 text-center text-sm text-ui-muted'>
                                No observations recorded yet for these actor profiles.
                            </td>
                        </tr>
                    )}
                </DashboardTable>
            </div>
            <PageNavigation
                page={page}
                total={total}
                limit={25}
                hasNext={page * 25 < total}
                label='Activity pages'
                href={next => `/ti/activity?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(next) })}`}
            />
        </DashboardPanel>
    )
}

function ActivityRow({ event }: { event: TiActivityEvent }) {
    const stateLabel = event.tone === 'bad' ? 'attention' : event.tone === 'watch' ? 'watching' : 'observed'
    return (
        <tr className='align-top hover:bg-ui-raised'>
            <td className='whitespace-nowrap px-4 py-2.5 text-ui-muted'>{formatTiDate(event.happenedAt)}</td>
            <td className='px-4 py-2.5'>
                <Link href={actorProfileHref(event.actorName)} className='font-semibold text-ui-text hover:text-ui-primary'>
                    {event.actorName}
                </Link>
            </td>
            <td className='px-4 py-2.5'><p className='font-semibold text-ui-text'>{event.title}</p></td>
            <td className='whitespace-nowrap px-4 py-2.5 text-ui-muted'>{relativeAge(event.happenedAt)}</td>
            <td className='px-4 py-2.5 text-ui-muted'>{event.source}</td>
            <td className='px-4 py-2.5'>
                <StatusPill variant='activity' label={stateLabel} tone={event.tone} />
            </td>
            <td className='px-4 py-2.5 text-right'>
                <Link
                    href={actorProfileHref(event.actorName)}
                    className='inline-flex h-8 items-center gap-1 rounded-md border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text hover:border-ui-primary'
                >
                    Open
                    <ExternalLink className='h-3 w-3' />
                </Link>
            </td>
        </tr>
    )
}
