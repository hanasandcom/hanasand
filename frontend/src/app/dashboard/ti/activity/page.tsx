import Link from 'next/link'
import { Activity, AlertTriangle, CheckCircle2, Clock3, Radio } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { pageNumber } from '@/utils/pagination'
import { actorProfileHref } from '@/utils/ti/actorProfileRoute'
import { getTiEnrichmentOverview, type TiActivityEvent } from '@/utils/tiAdmin/enrichment'
import { formatTiDate } from '@/utils/tiAdmin/ops'
import { Metric, operationalStateLabel, shortTime, StatusPill } from '../dashboardPresentation'
import { ActivityEvents } from './activityEvents'
import { relativeAge } from './activityPresentation'

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string, page?: string }

export default async function TiActivityPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
    const params = await searchParams
    const query = params?.q?.trim() || ''
    const requestedPage = pageNumber(params?.page)
    const { activity, updatedActors, worker, stats, dataAvailable } = await getTiEnrichmentOverview(query)

    if (!dataAvailable || (!activity.length && !updatedActors.length && !query)) {
        return <ActivityEmptyState unavailable={!dataAvailable} failed={Boolean(worker.lastError)} />
    }

    const sortedActivity = [...activity].sort(
        (first, second) => new Date(second.happenedAt).getTime() - new Date(first.happenedAt).getTime(),
    )
    const page = Math.min(requestedPage, Math.max(1, Math.ceil(sortedActivity.length / 25)))
    const visibleActivity = sortedActivity.slice((page - 1) * 25, page * 25)
    const badEvents = sortedActivity.filter(event => event.tone === 'bad')
    const watchEvents = sortedActivity.filter(event => event.tone === 'watch')

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Latest activity'
                description='Automated collection and profile updates observed by Hanasand.'
            />
            <form method='get' action='/ti/activity' className='flex gap-2'>
                <input
                    name='q'
                    defaultValue={query}
                    aria-label='Search activity'
                    placeholder='Search actors or feeds'
                    maxLength={100}
                    className='min-w-0 flex-1 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text'
                />
                <button className='rounded-md bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-on-primary'>Search</button>
                {query ? <Link href='/ti/activity' className='px-3 py-2 text-sm text-ui-primary'>Clear</Link> : null}
            </form>
            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                <Metric title='Events' value={`${sortedActivity.length}`} icon={<Activity className='h-4 w-4' />} valueSize='large' />
                <Metric
                    title='Monitoring signals'
                    value={`${badEvents.length + watchEvents.length}`}
                    tone={badEvents.length ? 'bad' : watchEvents.length ? 'watch' : 'ok'}
                    icon={<AlertTriangle className='h-4 w-4' />}
                    valueSize='large'
                />
                <Metric title='Actors updated' value={`${updatedActors.length}`} icon={<CheckCircle2 className='h-4 w-4' />} valueSize='large' />
                <Metric title='Updated last hour' value={`${stats.updatedLastHour}`} icon={<Radio className='h-4 w-4' />} valueSize='large' />
                <Metric
                    title='Last event'
                    value={sortedActivity[0] ? shortTime(sortedActivity[0].happenedAt) : 'No events yet'}
                    icon={<Clock3 className='h-4 w-4' />}
                    valueSize='large'
                />
            </div>
            <ActivityEvents
                events={visibleActivity}
                total={sortedActivity.length}
                page={page}
                query={query}
                worker={worker}
                updatedActorCount={updatedActors.length}
            />
            <div className='grid gap-3 xl:grid-cols-[0.9fr_1.1fr]'>
                <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                    <h2 className='text-base font-semibold text-ui-text'>Monitoring status</h2>
                    <div className='mt-3 grid gap-2'>
                        {[...badEvents, ...watchEvents].slice(0, 6).map(event => <AttentionRow key={event.id} event={event} />)}
                        {worker.lastError && <p role='alert' className='text-sm text-ui-text'>The latest profile update failed. Check again for recovery.</p>}
                        {!worker.lastError && !badEvents.length && !watchEvents.length && (
                            <p className='rounded-md border border-dashed border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>
                                No monitoring issues in the latest observations.
                            </p>
                        )}
                    </div>
                </DashboardPanel>
                <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                    <h2 className='text-base font-semibold text-ui-text'>Recently observed actors</h2>
                    <div className='mt-3 grid gap-2 md:grid-cols-2'>
                        {updatedActors.slice(0, 8).map(actor => (
                            <Link key={actor.id} href={actorProfileHref(actor.name)} className='rounded-md border border-ui-border bg-ui-raised p-3 hover:border-ui-primary'>
                                <div className='flex items-start justify-between gap-3'>
                                    <div>
                                        <p className='font-semibold text-ui-text'>{actor.name}</p>
                                        <p className='mt-1 text-xs text-ui-muted'>{actor.sourceLinks.length} sources · {actor.refreshCount ?? 0} refreshes</p>
                                    </div>
                                    <StatusPill variant='activity'
                                        label={operationalStateLabel(actor.status)}
                                        tone={actor.status === 'review' ? 'watch' : 'ok'}
                                    />
                                </div>
                                <p className='mt-2 text-xs text-ui-muted'>Updated {formatTiDate(actor.lastUpdatedAt)}</p>
                                <p className='mt-1 truncate text-sm text-ui-muted'>
                                    {actor.changedFields.length ? actor.changedFields.join(', ') : 'No field changes in the latest refresh'}
                                </p>
                            </Link>
                        ))}
                        {!updatedActors.length && <p className='text-sm text-ui-muted'>No actor profiles recorded yet.</p>}
                    </div>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function AttentionRow({ event }: { event: TiActivityEvent }) {
    return (
        <Link href={actorProfileHref(event.actorName)} className='rounded-md border border-ui-border bg-ui-raised p-3 hover:border-ui-primary'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>{event.actorName}</p>
                    <p className='mt-1 font-semibold text-ui-text'>{event.title}</p>
                </div>
                <StatusPill variant='activity' label={event.tone === 'bad' ? 'attention' : 'watching'} tone={event.tone} />
            </div>
            <p className='mt-2 text-sm text-ui-muted'>{event.detail}</p>
            <div className='mt-2 grid gap-1.5 text-xs text-ui-muted sm:grid-cols-2'>
                <span>Feed: {event.source}</span>
                <span>Age: {relativeAge(event.happenedAt)}</span>
            </div>
        </Link>
    )
}

function ActivityEmptyState({ unavailable, failed }: { unavailable: boolean, failed: boolean }) {
    const alert = unavailable || failed
    const title = unavailable
        ? 'Activity is temporarily unavailable.'
        : failed
            ? 'The latest profile update failed.'
            : 'Welcome to activity'
    const description = unavailable
        ? 'We could not load the latest observations. Try again to check for updates.'
        : failed
            ? 'No observations are available yet. Try again to check whether profile updates have recovered.'
            : 'No observations yet. This page shows recorded actor profile changes and their linked evidence.'

    return (
        <DashboardPage>
            <DashboardPanel className='overflow-hidden p-0'>
                <h1 className='border-b border-ui-border px-4 py-3 text-lg font-semibold text-ui-text'>Latest activity</h1>
                <div className='flex min-h-56 flex-col items-center justify-center gap-2 px-4 py-16 text-center text-ui-muted' data-ti-activity-state={unavailable ? 'error' : failed ? 'attention' : 'empty'}>
                    <Activity className='mb-2 h-6 w-6' aria-hidden='true' />
                    <p className='font-semibold text-ui-text' role={alert ? 'alert' : undefined}>{title}</p>
                    <p className='max-w-md text-sm leading-6'>{description}</p>
                    <form action='/ti/activity' method='get'>
                        <button type='submit' className='mt-3 rounded-md border border-ui-border px-3 py-2 text-sm font-semibold text-ui-text hover:border-ui-primary'>
                            {alert ? 'Try again' : 'Check for updates'}
                        </button>
                    </form>
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}
