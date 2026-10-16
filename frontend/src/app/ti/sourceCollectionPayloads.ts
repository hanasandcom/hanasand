import { sourceHealthFieldLabel, unique, type DecisionStep, type EnrichmentTask, type SourceHealthRow, type WatchlistIntersectionRow } from './pageModel'
import type { TiActionabilityModel } from '@/utils/ti/actionability'

export function decisionStepsFor(actionability: TiActionabilityModel): DecisionStep[] {
    const sourceGap = actionability.enrichmentGapQueue.find(gap => gap.sourceFamily === 'source_capture')
    const sourceMissing = sourceGap ? sourceGap.requestedFields : []
    const hasSourceProvenance = actionability.sourceProvenance.length > 0
    const sourceStatus: DecisionStep['status'] = !hasSourceProvenance ? 'blocked' : sourceMissing.length ? 'review' : 'ready'
    const enrichmentWorkCount = actionability.enrichmentGapQueue.length + actionability.sourceClusters.length
    return [
        {
            id: 'source-review',
            label: 'Review sources',
            status: sourceStatus,
            detail: hasSourceProvenance
                ? `${actionability.sourceProvenance.length} source reference${actionability.sourceProvenance.length === 1 ? '' : 's'} found; ${sourceMissing.length ? 'capture details still needed' : 'evidence is attached'}.`
                : 'No source result is attached to this actor result.',
            payload: actionability.exportPayloads.enrichment,
            route: sourceGap?.route ?? actionability.exportPayloads.enrichment.backedRoute,
            missing: sourceMissing,
        },
        {
            id: 'watchlist',
            label: 'Prepare watchlist',
            status: actionability.watchlistRelevance.blockers.length ? 'blocked' : actionability.watchlistRelevance.matches.length ? 'ready' : 'review',
            detail: actionability.watchlistRelevance.terms.length
                ? `${actionability.watchlistRelevance.terms.length} candidate term${actionability.watchlistRelevance.terms.length === 1 ? '' : 's'}; ${actionability.watchlistRelevance.matches.length} org match${actionability.watchlistRelevance.matches.length === 1 ? '' : 'es'} linked.`
                : 'No watchlist term is attached to this result.',
            payload: actionability.exportPayloads.watchlist,
            route: actionability.exportPayloads.watchlist.backedRoute,
            missing: actionability.watchlistRelevance.blockers,
        },
        {
            id: 'alert-rebuild',
            label: 'Rebuild alerts',
            status: actionability.createAlertHandoff.blocked ? 'blocked' : 'ready',
            detail: actionability.createAlertHandoff.blocked ? 'Alert rebuild needs watchlist or org context.' : 'Ready to rebuild from matched watchlist terms.',
            payload: actionability.createAlertHandoff,
            route: actionability.createAlertHandoff.backedRoute,
            missing: actionability.createAlertHandoff.missing,
        },
        {
            id: 'case',
            label: 'Open case',
            status: actionability.caseHandoff.blocked ? 'blocked' : 'ready',
            detail: actionability.caseHandoff.blocked ? 'Case creation needs alert review and org-scoped context.' : 'Ready to open from related alert context.',
            payload: actionability.caseHandoff,
            route: actionability.caseHandoff.backedRoute,
            missing: actionability.caseHandoff.missing,
        },
        {
            id: 'webhook-delivery',
            label: 'Deliver webhook',
            status: actionability.webhookDeliveryHandoff.blocked ? 'blocked' : 'ready',
            detail: actionability.webhookDeliveryHandoff.blocked ? 'Delivery needs alert, capture, and destination context.' : 'Dry-run delivery can be prepared from alert and destination context.',
            payload: actionability.webhookDeliveryHandoff,
            route: actionability.webhookDeliveryHandoff.backedRoute,
            missing: actionability.webhookDeliveryHandoff.missing,
        },
        {
            id: 'enrichment',
            label: 'Review profile updates',
            status: actionability.exportPayloads.enrichment.blocked ? 'blocked' : enrichmentWorkCount ? 'review' : 'ready',
            detail: `${enrichmentWorkCount} source or profile update${enrichmentWorkCount === 1 ? '' : 's'} available.`,
            payload: actionability.exportPayloads.enrichment,
            route: actionability.exportPayloads.enrichment.backedRoute,
            missing: actionability.exportPayloads.enrichment.missing,
        },
    ]
}
export function collectionGapTaskPayloadFor(task: EnrichmentTask, intake: TiActionabilityModel['sourceEnrichmentIntake']) {
    const requestedFields = task.requestedFields ?? []
    const matchingItems = intake.items.filter(item =>
        item.route === task.route
        || item.ownerLane === task.ownerLane
        || item.sourceFamily === task.sourceFamily
        || item.requestedFields.some(field => requestedFields.includes(field))
    )
    return {
        schemaVersion: 'ti.public_actor.collection_gap_task.v1',
        source: 'public-ti',
        sessionLocal: true,
        title: task.title,
        status: task.status,
        detail: task.detail,
        sourceFamily: task.sourceFamily,
        route: task.route,
        ownerLane: task.ownerLane,
        requestedFields,
        intakeRoute: intake.route,
        intakeItems: matchingItems,
        summary: {
            matchingItems: matchingItems.length,
            sourceRequests: matchingItems.filter(item => Boolean(item.sourceRequestId)).length,
            captures: matchingItems.filter(item => Boolean(item.captureId)).length,
            blockers: matchingItems.reduce((count, item) => count + item.blockedBy.length, 0),
        },
    }
}
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
export function sourceRefreshPayloadFor(
    row: SourceHealthRow,
    queue: TiActionabilityModel['sourceHealthQueue'],
    intake: TiActionabilityModel['sourceEnrichmentIntake'],
    payload: TiActionabilityModel['exportPayloads']['enrichment'],
) {
    const matchingIntakeItems = intake.items.filter(item =>
        item.sourceHealthRowId === row.id
        || item.sourceRequestId === row.sourceRequestId
        || item.sourceId === row.sourceId
        || item.captureId === row.captureId
        || item.requestedFields.some(field => row.requestedFields.includes(field))
    )
    return {
        schemaVersion: 'ti.public_actor.source_refresh_request.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: queue.query,
        generatedAt: queue.generatedAt,
        rowId: row.id,
        sourceName: row.sourceName,
        sourceFamily: row.sourceFamily,
        state: row.state,
        route: row.route,
        ownerLane: row.ownerLane,
        sourceId: row.sourceId,
        sourceRequestId: row.sourceRequestId,
        captureId: row.captureId,
        requestedFields: row.requestedFields,
        evidence: {
            provenance: row.provenance,
            timestamp: row.timestamp,
            confidence: row.confidence,
            parserStatus: row.parserStatus,
        },
        blockers: row.requestedFields.map(field => ({
            code: 'missing_field',
            field,
            label: sourceHealthFieldLabel(field),
        })),
        queueSummary: queue.summary,
        sourceEnrichmentIntake: {
            schemaVersion: intake.schemaVersion,
            route: intake.route,
            summary: intake.summary,
            matchingItems: matchingIntakeItems,
        },
        enrichmentPayload: payload,
        handoff: {
            route: row.route || intake.route,
            ready: row.state === 'ready',
            blocked: row.state === 'blocked' || row.requestedFields.length > 0,
            matchingIntakeItems: matchingIntakeItems.length,
            sourceRequests: matchingIntakeItems.filter(item => Boolean(item.sourceRequestId)).length,
            captures: matchingIntakeItems.filter(item => Boolean(item.captureId)).length,
        },
        recommendedAction: row.captureId ? 'inspect_capture' : row.sourceRequestId ? 'track_source_request' : 'queue_enrichment',
        nextAction: row.nextAction,
    }
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
