import type { WatchlistIntersectionRow } from './pageModel'
import type { TiActionabilityModel } from '@/utils/ti/actionability'

export function actorEnrichmentConsumerLabel(consumer: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['consumer']) {
    if (consumer === 'publicTI') return 'Threat profile'
    if (consumer === 'alertGeneration') return 'Alert generation'
    return 'Collection'
}
export function actorEnrichmentConsumerState(state: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['state']) {
    if (state === 'ready') return 'ready'
    if (state === 'action_required') return 'review'
    return 'review'
}
export function watchlistIntersectionPayloadFor(row: WatchlistIntersectionRow) {
    return {
        schemaVersion: 'ti.public_actor.watchlist_intersection_request.v1',
        intersectionId: row.intersectionId,
        kind: row.kind,
        value: row.value,
        state: row.state,
        route: row.route,
        tenantId: row.tenantId,
        organizationId: row.organizationId,
        watchlistId: row.watchlistId,
        watchlistItemId: row.watchlistItemId,
        alertIds: row.alertIds,
        caseIds: row.caseIds,
        casePaths: row.casePaths,
        captureIds: row.captureIds,
        webhookDestinationIds: row.webhookDestinationIds,
        sourceEvidenceRefs: row.sourceEvidenceRefs,
        sourceFamilies: row.sourceFamilies,
        recommendedAction: row.recommendedAction,
        blockers: row.blockers,
    }
}
