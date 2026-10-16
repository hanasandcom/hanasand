import { unique } from './pageModel'
import type { DecisionStep } from './pageModel'
import type { TiActionabilityModel } from '@/utils/ti/actionability'
import type { TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { classifyPublicTiQuery } from './queryPresentation'

export function freshnessReviewPayloadFor(
    actor: TiActorIntelligenceProfile,
    actionability: TiActionabilityModel,
    query: string,
    state: { sourceState: DecisionStep['status']; handoffState: DecisionStep['status'] },
) {
    const sourceBlockers = actionability.readiness.blockers.filter(blocker => blocker.ownerLane === 'source' || blocker.ownerLane === 'public-ti')
    const workflowBlockers = actionability.readiness.blockers.filter(blocker => blocker.ownerLane === 'org' || blocker.ownerLane === 'alert' || blocker.ownerLane === 'case' || blocker.ownerLane === 'webhook' || blocker.ownerLane === 'entitlement')
    const requestedFields = unique([
        ...actor.sourceCoverage.missing,
        ...actionability.sourceHealthQueue.rows.flatMap(row => row.requestedFields),
        ...actionability.sourceEnrichmentIntake.items.flatMap(item => item.requestedFields),
    ])
    return {
        schemaVersion: 'ti.public_actor.freshness_review.v1',
        source: 'public-ti',
        sessionLocal: true,
        query,
        queryKind: classifyPublicTiQuery(query),
        generatedAt: actor.freshness.generatedAt,
        actor: {
            actorClass: actor.actorClass,
            confidence: actor.confidence,
            firstSeen: actor.firstSeen,
            lastSeen: actor.lastSeen,
        },
        freshness: actor.freshness,
        state,
        sourceCoverage: actor.sourceCoverage,
        provenanceRows: actor.provenanceRows,
        sourceHealthQueue: {
            schemaVersion: actionability.sourceHealthQueue.schemaVersion,
            rows: actionability.sourceHealthQueue.rows,
        },
        sourceEnrichmentIntake: {
            schemaVersion: actionability.sourceEnrichmentIntake.schemaVersion,
            route: actionability.sourceEnrichmentIntake.route,
            summary: actionability.sourceEnrichmentIntake.summary,
            items: actionability.sourceEnrichmentIntake.items,
        },
        requestedFields,
        relatedWorkflow: {
            watchlist: {
                state: actionability.watchlistRelevance.state,
                terms: actionability.watchlistRelevance.terms,
                matches: actionability.watchlistRelevance.matches,
                blockers: actionability.watchlistRelevance.blockers,
            },
            alerts: actionability.relatedAlerts,
            cases: actionability.relatedCases,
            caseReviewIntake: actionability.caseReviewIntake,
        },
        blockers: {
            source: sourceBlockers,
            workflow: workflowBlockers,
        },
        handoffRoutes: {
            sourceEnrichment: actionability.sourceEnrichmentIntake.route,
            watchlist: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
            alertRebuild: actionability.createAlertHandoff.backedRoute || actionability.createAlertHandoff.endpoint,
            caseReview: actionability.caseHandoff.backedRoute || actionability.caseHandoff.endpoint,
        },
    }
}
