import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'
import { enrichmentOverviewFromSnapshot, parsePersistedProfile, parseProfileUpdate } from './enrichmentSnapshot'
import type { TiEnrichedActor, TiEnrichmentOverview } from './enrichmentTypes'

export type {
    TiActivityEvent,
    TiEnrichedActor,
    TiEnrichmentOverview,
    TiEnrichmentStatus,
    TiManagementAuditEvent,
    TiPipelineOverview,
    TiProfileUpdate,
    TiWorkerState,
} from './enrichmentTypes'

// Next's fetch cache handles reuse; await the first snapshot before rendering.
export async function getTiEnrichmentOverview(query = ''): Promise<TiEnrichmentOverview> {
    try {
        const target = new URL('/v1/intel/actor-enrichment/overview', tiScraperApiBase())
        target.searchParams.set('tenantId', 'default')
        if (query) target.searchParams.set('q', query.slice(0, 100))
        const serviceToken = process.env.TI_SCRAPER_SERVICE_TOKEN?.trim()
        const response = await fetch(target, {
            next: { revalidate: 5 },
            headers: serviceToken ? { 'x-hanasand-service-token': serviceToken } : undefined,
            signal: AbortSignal.timeout(2_000),
        })
        if (!response.ok) throw new Error('Enrichment overview unavailable')
        const data = await response.json() as {
            profiles: unknown[]
            updates: unknown[]
            status: Parameters<typeof enrichmentOverviewFromSnapshot>[2]
        }
        const profiles = data.profiles.map(parsePersistedProfile).filter(profile => profile !== undefined)
        const updates = data.updates.map(parseProfileUpdate).filter(update => update !== undefined)
        return enrichmentOverviewFromSnapshot(profiles, updates, data.status, true)
    } catch {
        return enrichmentOverviewFromSnapshot([], [], undefined, false)
    }
}

export async function getTiActorById(id: string) {
    const overview = await getTiEnrichmentOverview()
    const actors: TiEnrichedActor[] = [...overview.updatedActors, ...overview.queuedActors]
    return actors.find(actor => actor.id === id) || null
}
