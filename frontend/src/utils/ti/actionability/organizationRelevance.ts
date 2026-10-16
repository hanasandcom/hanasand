import type { TiSearchResponse, TiActionabilityContract } from '../search'
import type { TiActorIntelligenceProfile } from '../actorIntelligence'
import type { TiActionabilityModel, PublicTiReadinessContract } from './types/actionability'
import type { PublicTiOrgRelevanceProof } from './types/organizationRelevance'
import { actorIdForQuery } from './actionPayloads'
import { readTermArray } from './normalization'
import { sourceSupportsTerm, actorEvidenceForSource, buildWatchlistIntersections } from './watchlistIntersections'
import { uniqueStrings, normalizeKind } from './geography'
import { actorIdentityForOrgRelevance, sourceCoverageForOrgRelevance, orgRelevanceEnrichmentGaps } from './organizationEvidence'
import { buildAffectedEntities } from './organizationEntities'
import { buildOrgRelevanceRows } from './organizationRows'

export function buildOrgRelevanceProof(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    enrichmentGaps: NonNullable<TiActionabilityContract['enrichmentGaps']>
    exportPayloads: TiActionabilityModel['exportPayloads']
    readiness: PublicTiReadinessContract
}): PublicTiOrgRelevanceProof {
    const actorId = actorIdForQuery(input.result.query)
    const sourceEvidence = input.sourceProvenance.map(source => {
        const terms = readTermArray(input.exportPayloads.watchlist.body.terms)
            .filter(term => sourceSupportsTerm(source, term))
            .map(term => String(term.value))
        const actorEvidence = actorEvidenceForSource(input.actor, source)
        return {
            sourceId: source.sourceId,
            sourceName: source.sourceName,
            provenance: source.provenance,
            reportDate: actorEvidence?.reportDate,
            captureId: source.captureId,
            sourceRequestId: source.sourceRequestId,
            sourceFamily: source.sourceFamily,
            parserStatus: source.parserStatus,
            lastCollectedAt: source.lastCollectedAt,
            confidence: source.confidence,
            supportsTerms: uniqueStrings(terms.length ? terms : readTermArray(input.exportPayloads.watchlist.body.terms).map(term => String(term.value))),
            shownBecause: actorEvidence?.shownBecause ?? 'Evidence used for watchlist, alert, or case delivery.',
        }
    })
    const evidenceRefs = sourceEvidence.flatMap(source => [
        source.sourceId,
        source.captureId,
        source.provenance,
    ]).filter((value): value is string => Boolean(value))
    const candidateTerms = readTermArray(input.exportPayloads.watchlist.body.terms).map(term => {
        const value = String(term.value)
        return {
            kind: normalizeKind(String(term.kind)),
            value,
            notes: typeof term.notes === 'string' ? term.notes : '',
            matched: input.matches.some(match => match.kind === normalizeKind(String(term.kind)) && match.value.toLowerCase() === value.toLowerCase()),
            sourceEvidenceRefs: uniqueStrings(evidenceRefs),
        }
    })
    const alertCaseRefs = input.relatedAlerts.map(alert => ({
        alertId: alert.id,
        casePath: alert.casePath ?? alert.deliveryReadinessContext?.casePath,
        caseIdCandidate: alert.caseIdCandidate,
        organizationId: alert.organizationId,
        tenantId: alert.tenantId,
        captureIds: uniqueStrings([...(alert.captureIds ?? []), ...(alert.deliveryReadinessContext?.selectedCaptureIds ?? [])]),
        webhookDestinationIds: uniqueStrings([...(alert.webhookDestinationIds ?? []), ...(alert.deliveryReadinessContext?.webhookDestinationIds ?? [])]),
    }))
    const actorIdentity = actorIdentityForOrgRelevance(input.result, input.actor)
    const sourceCoverage = sourceCoverageForOrgRelevance(sourceEvidence, input.readiness.blockers)
    const orgEnrichmentGaps = orgRelevanceEnrichmentGaps({
        actorIdentity,
        sourceCoverage,
        sourceEvidence,
        freshness: input.actor.freshness,
    })
    const affectedEntities = buildAffectedEntities({
        result: input.result,
        actor: input.actor,
        matches: input.matches,
        candidateTerms,
        sourceEvidence,
        alertCaseRefs,
    })
    const blockers = input.readiness.blockers.filter(blocker => [
        'missing_org',
        'missing_org_watchlist',
        'missing_source_provenance',
        'missing_alert',
        'missing_capture',
        'missing_case_route',
        'missing_webhook_destination',
        'stale_provenance',
    ].includes(blocker.code))
    const watchlistIntersections = buildWatchlistIntersections({
        matches: input.matches,
        candidateTerms,
        sourceEvidence,
        alertCaseRefs,
        blockers,
    })
    const handoffRows = buildOrgRelevanceRows({
        actorId,
        matches: input.matches,
        candidateTerms,
        sourceEvidence,
        alertCaseRefs,
        enrichmentGaps: input.enrichmentGaps,
        orgEnrichmentGaps,
        blockers,
    })
    const state: PublicTiOrgRelevanceProof['state'] = blockers.length === 0
        ? 'ready'
        : sourceEvidence.length || candidateTerms.length || input.matches.length || alertCaseRefs.length ? 'review' : 'blocked'

    return {
        schemaVersion: 'ti.public_actor.org_relevance.v1',
        state,
        actorId,
        query: input.result.query,
        generatedAt: input.result.generatedAt,
        freshness: input.actor.freshness,
        actorIdentity,
        sourceCoverage,
        enrichmentGaps: orgEnrichmentGaps,
        watchlistIntersections,
        organizationRefs: input.matches.map(match => ({
            tenantId: match.tenantId,
            organizationId: match.organizationId,
            watchlistId: match.watchlistId,
            watchlistItemId: match.watchlistItemId,
            kind: match.kind,
            value: match.value,
            route: match.route,
            casePath: match.casePath,
        })),
        candidateTerms,
        sourceEvidence,
        alertCaseRefs,
        affectedEntities,
        handoffRows,
        handoffRoutes: {
            watchlist: '/v1/dwm/watchlists',
            alertRebuild: '/v1/dwm/alerts/rebuild',
            case: '/v1/cases',
            webhookDelivery: '/v1/dwm/webhooks/deliver',
        },
        blockers,
    }
}
