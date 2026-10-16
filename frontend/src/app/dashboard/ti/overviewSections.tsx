import { AlertTriangle, Camera, Clock3, DatabaseZap, PlayCircle, Radar } from 'lucide-react'
import { LiveLane, Metric, operationalStateLabel, shortTime } from './dashboardPresentation'
import type { TiAdminOverview } from '@/utils/tiAdmin/ops'
import type { TiEnrichmentOverview } from '@/utils/tiAdmin/enrichment'

type Run = TiAdminOverview['runs'][number]
type Source = TiAdminOverview['sources'][number]
type Capture = TiAdminOverview['captures'][number]
type Actor = TiEnrichmentOverview['updatedActors'][number] | TiEnrichmentOverview['queuedActors'][number]
type PipelineRun = NonNullable<TiEnrichmentOverview['pipeline']>['latestRuns'][number]
type Discovery = NonNullable<TiEnrichmentOverview['pipeline']>['latestDiscoveries'][number]

export function LiveOperations({ overview, enrichment, latestRun, nextRun, latestCapture, currentActor, activeActorRun, latestDiscovery }: {
    overview: TiAdminOverview
    enrichment: TiEnrichmentOverview
    latestRun?: Run
    nextRun?: Source
    latestCapture?: Capture
    currentActor?: Actor
    activeActorRun?: PipelineRun
    latestDiscovery?: Discovery
}) {
    const collectionTone = latestRun?.status === 'failed'
        ? 'bad'
        : latestRun?.status === 'running' || latestRun?.status === 'queued' ? 'watch' : 'ok'
    const actorTone = enrichment.worker.state === 'active'
        ? 'ok'
        : enrichment.worker.state === 'unavailable' ? 'bad' : 'watch'
    const actorSummary = latestDiscovery
        ? latestDiscovery.title
        : `${enrichment.stats.updatedLastHour} profile updates in the last hour`
    const actorFooter = activeActorRun
        ? `Run ${operationalStateLabel(activeActorRun.status)}`
        : `${enrichment.stats.queued} actors queued`

    return (
        <section className='grid gap-3 xl:grid-cols-[1.1fr_1fr_1fr]'>
            <LiveLane
                title='Collection'
                href='/ti/runs'
                icon={<DatabaseZap className='h-4 w-4' />}
                state={operationalStateLabel(latestRun?.status || 'scheduled')}
                stateTone={collectionTone}
                primary={latestRun?.sourceName || nextRun?.name || 'Selecting source'}
                secondary={latestRun
                    ? `${latestRun.rows} rows, ${latestRun.captures} captures, ${latestRun.screenshots} screenshots`
                    : `Next due ${nextRun ? shortTime(nextRun.nextRunAt) : 'as soon as a source is due'}`}
                footer={latestRun ? `Started ${shortTime(latestRun.startedAt)}` : 'Scheduler is selecting the next source'}
            />
            <LiveLane
                title='Actor profiles'
                href='/ti/profiles'
                icon={<Radar className='h-4 w-4' />}
                state={operationalStateLabel(enrichment.worker.state)}
                stateTone={actorTone}
                primary={currentActor?.name || activeActorRun?.actor_name || 'Selecting actor'}
                secondary={actorSummary}
                footer={actorFooter}
            />
            <LiveLane
                title='Recent evidence'
                href='/ti/activity'
                icon={<Camera className='h-4 w-4' />}
                state={latestCapture ? 'captured' : 'watching'}
                stateTone={latestCapture ? 'ok' : 'neutral'}
                primary={latestCapture?.title || 'Checking evidence sources'}
                secondary={latestCapture?.resultSummary || `${overview.captures.length} stored captures from automated monitoring`}
                footer={latestCapture ? `${latestCapture.actor} · ${shortTime(latestCapture.capturedAt)}` : 'Collectors are checking sources'}
            />
        </section>
    )
}

export function OverviewMetrics({ overview, enrichment, candidateCount, staleCount, reviewCount, failedCount, nextRun }: {
    overview: TiAdminOverview
    enrichment: TiEnrichmentOverview
    candidateCount: number
    staleCount: number
    reviewCount: number
    failedCount: number
    nextRun?: Source
}) {
    const signals = reviewCount + candidateCount + failedCount
    const workerState = enrichment.worker.state
    const workerTone = workerState === 'active' ? 'ok' : workerState === 'unavailable' ? 'bad' : 'watch'

    return (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-6'>
            <Metric
                title='Executable sources'
                value={`${overview.sourceTotals.executable}/${overview.sourcePage.total}`}
                icon={<DatabaseZap className='h-4 w-4' />}
            />
            <Metric
                title='Monitoring signals'
                value={`${signals}`}
                tone={signals ? 'watch' : 'ok'}
                icon={<AlertTriangle className='h-4 w-4' />}
            />
            <Metric
                title='Stale sources'
                value={`${staleCount}`}
                tone={staleCount ? 'bad' : 'ok'}
                icon={<Clock3 className='h-4 w-4' />}
            />
            <Metric
                title='Recent capture sample'
                value={`${overview.captures.length}`}
                icon={<Camera className='h-4 w-4' />}
            />
            <Metric
                title='Actor worker'
                value={operationalStateLabel(workerState)}
                tone={workerTone}
                icon={<Radar className='h-4 w-4' />}
            />
            <Metric
                title='Next run'
                value={nextRun ? shortTime(nextRun.nextRunAt) : 'Selecting'}
                icon={<PlayCircle className='h-4 w-4' />}
            />
        </div>
    )
}
