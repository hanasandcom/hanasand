import type { TiActionabilityModel } from '@/utils/ti/actionability'
import type { TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'

export function provenanceArtifactPayloadFor(row: TiActorIntelligenceProfile['provenanceRows'][number], actor: TiActorIntelligenceProfile, actionability: TiActionabilityModel, query: string) {
    const sourceHealthRows = actionability.sourceHealthQueue.rows.filter(item =>
        (row.sourceId ? item.sourceId === row.sourceId : false)
        || (row.captureId ? item.captureId === row.captureId : false)
        || (row.sourceRequestId ? item.sourceRequestId === row.sourceRequestId : false)
        || item.provenance === row.provenance
        || item.sourceName === row.sourceName
    )
    const sourceHealthRowIds = new Set(sourceHealthRows.map(item => item.id))
    const sourceEnrichmentItems = actionability.sourceEnrichmentIntake.items.filter(item =>
        sourceHealthRowIds.has(item.sourceHealthRowId)
        || (row.sourceId ? item.sourceId === row.sourceId : false)
        || (row.captureId ? item.captureId === row.captureId : false)
        || (row.sourceRequestId ? item.sourceRequestId === row.sourceRequestId : false)
        || item.evidence.provenance === row.provenance
    )
    const evidencePriority = actionability.evidencePriority.filter(item =>
        (row.sourceId ? item.sourceIds.includes(row.sourceId) : false)
        || (row.captureId ? item.captureIds.includes(row.captureId) : false)
        || item.reasons.some(reason => reason.includes(row.sourceName) || reason.includes(row.provenance))
    )
    const watchlistIntersections = actionability.orgRelevance.watchlistIntersections.filter(item =>
        item.sourceEvidenceRefs.some(ref => ref === row.sourceId || ref === row.captureId || row.provenance.includes(ref) || row.sourceName.includes(ref))
    )
    return {
        schemaVersion: 'ti.public_actor.provenance_artifact.v1',
        source: 'public-ti',
        sessionLocal: true,
        query,
        generatedAt: actionability.sourceHealthQueue.generatedAt,
        actor: {
            actorClass: actor.actorClass,
            confidence: actor.confidence,
            freshness: actor.freshness,
        },
        provenance: row,
        sourceHealthRows,
        sourceEnrichmentIntake: {
            schemaVersion: actionability.sourceEnrichmentIntake.schemaVersion,
            route: actionability.sourceEnrichmentIntake.route,
            matchingItems: sourceEnrichmentItems,
        },
        evidencePriority,
        watchlistIntersections,
        relatedWorkflow: {
            alerts: actionability.relatedAlerts.filter(item => evidencePriority.some(priority => priority.alertIds.includes(item.id))),
            cases: actionability.relatedCases.filter(item => {
                const path = item.path
                return Boolean(path && evidencePriority.some(priority => priority.casePaths.includes(path)))
            }),
            caseReviewIntake: actionability.caseReviewIntake.items.filter(item =>
                evidencePriority.some(priority => item.evidenceRowId === priority.rowId)
                || (row.sourceId ? item.sourceIds.includes(row.sourceId) : false)
                || (row.captureId ? item.captureIds.includes(row.captureId) : false)
            ),
        },
        handoffRoutes: {
            sourceEnrichment: actionability.sourceEnrichmentIntake.route,
            watchlist: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
            alertRebuild: actionability.createAlertHandoff.backedRoute || actionability.createAlertHandoff.endpoint,
            caseReview: actionability.caseHandoff.backedRoute || actionability.caseHandoff.endpoint,
        },
    }
}
