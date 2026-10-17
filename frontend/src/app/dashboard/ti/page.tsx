import { DashboardPage } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview } from '@/utils/tiAdmin/enrichment'
import { getTiAdminOverview } from '@/utils/tiAdmin/ops'
import TiDataAvailability from './ti-data-availability'
import { ActionItemsPanel, buildActionItems } from './actionItemsPanel'
import { ActorEnrichmentPanel, RecentEvidencePanel } from './evidenceEnrichmentPanels'
import { DeliveryStatePanel, SourcesPanel } from './sourceDeliveryPanels'
import { sameKey } from './dashboardPresentation'
import { LiveOperations, OverviewMetrics } from './overviewSections'

export const dynamic = 'force-dynamic'

export default async function TiAdminPage() {
    const [overview, enrichment] = await Promise.all([
        getTiAdminOverview(),
        getTiEnrichmentOverview(),
    ])
    const { sources, domains, captures, runs } = overview
    const now = Date.now()
    const candidateSources = sources.filter(source =>
        source.status === 'candidate' || source.status === 'review'
    )
    const staleSources = sources.filter(source =>
        now - new Date(source.lastRunAt).getTime() > 12 * 60 * 60 * 1000
    )
    const reviewDomains = domains.filter(domain => domain.status === 'review')
    const queuedRuns = runs.filter(run => run.status === 'queued' || run.status === 'running')
    const failedRuns = runs.filter(run => run.status === 'failed')
    const nextRun = [...sources].sort((a, b) =>
        new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()
    )[0]
    const latestRun = [...runs].sort((a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )[0]
    const latestCapture = [...captures].sort((a, b) =>
        new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
    )[0]
    const actorRows = [...enrichment.updatedActors, ...enrichment.queuedActors]
    const activeActorRun = enrichment.pipeline?.latestRuns.find(run => run.status === 'running')
        || enrichment.pipeline?.latestRuns[0]
    const currentActor = actorRows.find(actor => activeActorRun && (
        sameKey(actor.name) === sameKey(activeActorRun.actor_name)
        || sameKey(actor.id) === sameKey(activeActorRun.actor_key)
    )) || actorRows[0]
    const latestDiscovery = enrichment.pipeline?.latestDiscoveries[0]
    const actionItems = buildActionItems({
        candidateSources,
        staleSources,
        failedRuns,
        latestCapture,
    })

    return (
        <DashboardPage>
            <TiDataAvailability availability={overview.availability} />
            <LiveOperations
                overview={overview}
                enrichment={enrichment}
                latestRun={latestRun}
                nextRun={nextRun}
                latestCapture={latestCapture}
                currentActor={currentActor}
                activeActorRun={activeActorRun}
                latestDiscovery={latestDiscovery}
            />
            <OverviewMetrics
                overview={overview}
                enrichment={enrichment}
                candidateCount={candidateSources.length}
                staleCount={staleSources.length}
                reviewCount={reviewDomains.length}
                failedCount={failedRuns.length}
                nextRun={nextRun}
            />
            <ActionItemsPanel
                items={actionItems}
                queuedCount={queuedRuns.length}
                latestRunStatus={latestRun?.status || 'scheduled'}
                latestRunTone={latestRun?.status === 'failed' ? 'bad' : latestRun ? 'ok' : 'neutral'}
                actorUpdates={enrichment.stats.updatedLastHour}
            />
            <div className='grid gap-4 xl:grid-cols-[1.15fr_0.85fr]'>
                <SourcesPanel
                    sources={sources}
                    runs={runs}
                    staleSources={staleSources}
                />
                <DeliveryStatePanel
                    reviewCount={reviewDomains.length}
                    domainCount={domains.length}
                    latestRun={latestRun}
                />
            </div>
            <div>
                <RecentEvidencePanel captures={captures} />
            </div>
            <ActorEnrichmentPanel enrichment={enrichment} />
        </DashboardPage>
    )
}
