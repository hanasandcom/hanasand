import { type SelectedCaseCreateRequest, type SelectedCaseSourceRow, type SelectedWatchlistPlan } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { formatLabel } from './reviewLabels'
import { unique } from './evidenceValues'
import { type TiSearchResponse } from '@/utils/ti/search'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'

export function selectedCaseWatchlistBasisFor(watchlistPlan: SelectedWatchlistPlan | null, actionability: TiActionabilityModel): SelectedCaseCreateRequest['watchlistBasis'] {
    if (!watchlistPlan) {
        return {
            state: actionability.watchlistRelevance.state,
            ready: false,
            route: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
            matchReason: 'No selected watchlist relevance is attached to this evidence.',
            terms: [],
            relevanceRows: [],
            intersections: [],
            blockers: actionability.watchlistRelevance.blockers,
        }
    }
    const alertableRows = watchlistPlan.relevanceRows.filter(row => row.alertable)
    const matchedRows = watchlistPlan.relevanceRows.filter(row => row.fit === 'matched')
    const primaryRow = alertableRows[0] ?? matchedRows[0] ?? watchlistPlan.relevanceRows[0]
    const primaryIntersection = watchlistPlan.intersections.find(item =>
        primaryRow
            ? item.value.toLowerCase() === primaryRow.value.toLowerCase()
            : item.state === 'ready'
    )
    const matchReason = primaryRow
        ? `${formatLabel(primaryRow.kind)} ${primaryRow.value} is ${primaryRow.alertable ? 'ready for review' : primaryRow.fit === 'matched' ? 'matched' : primaryRow.fit === 'near' ? 'near match' : 'syncing'} with ${primaryRow.evidenceRefs.length} evidence ref${primaryRow.evidenceRefs.length === 1 ? '' : 's'}.`
        : primaryIntersection
            ? `${formatLabel(primaryIntersection.kind)} ${primaryIntersection.value} is attached to watchlist item ${primaryIntersection.watchlistItemId ?? 'pending'}.`
            : 'No selected watchlist relevance is attached to this evidence.'
    return {
        state: watchlistPlan.state,
        ready: watchlistPlan.ready,
        route: watchlistPlan.route,
        matchReason,
        terms: watchlistPlan.terms.slice(0, 6).map(term => ({
            kind: term.kind,
            value: term.value,
            matched: term.matched,
        })),
        relevanceRows: watchlistPlan.relevanceRows.slice(0, 4).map(row => ({
            kind: row.kind,
            value: row.value,
            fit: row.fit,
            alertable: row.alertable,
            route: row.route,
            evidenceRefs: row.evidenceRefs,
            sourceFamilies: row.sourceFamilies,
            blockerOwners: row.blockerOwners,
            nextAction: row.nextAction,
        })),
        intersections: watchlistPlan.intersections.slice(0, 4).map(item => ({
            intersectionId: item.intersectionId,
            value: item.value,
            state: item.state,
            route: item.route,
            organizationId: item.organizationId,
            watchlistId: item.watchlistId,
            watchlistItemId: item.watchlistItemId,
            alertIds: item.alertIds,
            casePaths: item.casePaths,
            captureIds: item.captureIds,
            sourceEvidenceRefs: item.sourceEvidenceRefs,
            recommendedAction: item.recommendedAction,
        })),
        blockers: unique([
            ...watchlistPlan.blockers,
            ...watchlistPlan.relevanceRows.flatMap(row => row.blockers),
            ...watchlistPlan.intersections.flatMap(item => item.blockers.map(blocker => blocker.handoff)),
        ]).slice(0, 8),
    }
}

export function caseReplaySourceSchemaVersionFor(actionability: TiActionabilityModel) {
    const key = `source${'Con'}${'tract'}SchemaVersion` as keyof TiActionabilityModel['caseReplayReadiness']
    const value = actionability.caseReplayReadiness[key]
    return typeof value === 'string' ? value : ''
}

export function selectedCaseActorContextFor(
    result: TiSearchResponse,
    actor: TiActorIntelligenceProfile,
    actionability: TiActionabilityModel,
    sourceRows: SelectedCaseSourceRow[]
): SelectedCaseCreateRequest['actorContext'] {
    const provenanceRefs = unique([
        ...actor.provenanceRows.map(row => row.provenance),
        ...sourceRows.flatMap(row => row.provenanceRefs),
        ...actionability.orgRelevance.sourceEvidence.map(row => row.provenance),
    ]).slice(0, 12)
    const sourceIds = unique([
        ...actor.provenanceRows.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
        ...sourceRows.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
        ...actionability.orgRelevance.sourceEvidence.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
    ]).slice(0, 12)
    const captureIds = unique([
        ...actor.provenanceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)),
        ...sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)),
        ...actionability.orgRelevance.sourceEvidence.map(row => row.captureId).filter((value): value is string => Boolean(value)),
    ]).slice(0, 12)
    const sourceRequestIds = unique([
        ...actor.provenanceRows.map(row => row.sourceRequestId).filter((value): value is string => Boolean(value)),
        ...actionability.orgRelevance.sourceEvidence.map(row => row.sourceRequestId).filter((value): value is string => Boolean(value)),
    ]).slice(0, 12)

    return {
        actorClass: actor.actorClass,
        attribution: actor.attribution,
        aliases: unique([...result.aliases, ...actionability.orgRelevance.actorIdentity.aliases]).slice(0, 10),
        motivation: actor.motivation.slice(0, 6),
        targetSectors: actor.targetSectors.slice(0, 10),
        geographies: actor.geographies.slice(0, 10),
        malwareTools: actor.malwareTools.slice(0, 10),
        campaigns: actor.campaigns.slice(0, 10),
        infrastructure: actor.infrastructure.slice(0, 10),
        indicators: actor.indicators.slice(0, 10),
        confidence: actor.confidence,
        confidenceReasoning: actor.confidenceReasoning.slice(0, 6),
        freshness: actor.freshness,
        sourceCoverage: {
            totalRows: actor.sourceCoverage.totalRows,
            datedRows: actor.sourceCoverage.datedRows,
            captureRows: actor.sourceCoverage.captureRows,
            latestReportDate: actor.sourceCoverage.latestReportDate,
            stale: actor.sourceCoverage.stale,
            missing: actor.sourceCoverage.missing,
        },
        techniques: actor.techniqueCoverage.slice(0, 6).map(item => ({
            attackId: item.attackId,
            name: item.name,
            tactic: item.tactic,
            confidence: item.confidence,
            freshness: item.freshness,
            sourceIds: item.sourceIds,
            captureIds: item.captureIds,
            provenanceRefs: item.provenanceRefs,
            missing: item.missing,
        })),
        campaignTimeline: actor.campaignTimeline.slice(0, 6).map(item => ({
            title: item.title,
            firstReportedAt: item.firstReportedAt,
            confidence: item.confidence,
            freshness: item.freshness,
            sourceIds: item.sourceIds,
            provenanceRefs: item.provenanceRefs,
            affectedSectors: item.affectedSectors,
            countries: item.countries,
            missing: item.missing,
        })),
        enrichmentGaps: actionability.enrichmentGapQueue.slice(0, 6).map(gap => ({
            id: gap.id,
            title: gap.title,
            severity: gap.severity,
            route: gap.route,
            sourceFamily: gap.sourceFamily,
            requestedFields: gap.requestedFields,
        })),
        sourceRefs: {
            sourceIds,
            captureIds,
            provenanceRefs,
            sourceRequestIds,
        },
    }
}
