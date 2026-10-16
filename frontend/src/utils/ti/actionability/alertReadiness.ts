import type { TiSearchResponse, TiActionabilityContract } from '../search'
import type { WatchlistCandidate, PublicTiReadinessContract } from './types/actionability'
import type { PublicTiActorEnrichmentCoverageExport, PublicTiAlertGenerationReadinessExport } from './types/actorReadiness'
import type { PublicTiSourceHealthQueue, PublicTiSourceEnrichmentIntake } from './types/sourceEnrichment'
import { uniqueBy, newestTimestamp } from './geography'

export function buildPublicTiAlertGenerationReadiness(input: {
    result: TiSearchResponse
    watchlistTerms: Array<{ kind: WatchlistCandidate['kind']; value: string; notes: string }>
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    readiness: PublicTiReadinessContract
    actorEnrichmentCoverage: PublicTiActorEnrichmentCoverageExport
    sourceHealthQueue: PublicTiSourceHealthQueue
    sourceEnrichmentIntake: PublicTiSourceEnrichmentIntake
}): PublicTiAlertGenerationReadinessExport {
    const candidateCount = input.watchlistTerms.length
    const captureRefCount = input.readiness.backedIds.captureIds.length
    const matchedCandidateCount = input.matches.length
    const generationEvidenceWindowReady = captureRefCount > 0 && input.actorEnrichmentCoverage.summary.alertableFamilyCount > 0
    const blockers = uniqueBy([
        ...input.readiness.blockers
            .filter(blocker => blocker.code === 'missing_org' || blocker.code === 'missing_org_watchlist' || blocker.code === 'missing_capture' || blocker.code === 'missing_source_provenance' || blocker.code === 'stale_provenance')
            .map(blocker => ({ code: blocker.code, ownerLane: blocker.ownerLane, detail: blocker.detail })),
        ...input.actorEnrichmentCoverage.blockers.map(blocker => ({ code: blocker.code, ownerLane: blocker.ownerLane, detail: blocker.nextAction })),
        ...(candidateCount ? [] : [{ code: 'missing_watchlist_terms', ownerLane: 'org' as const, detail: 'Persist watchlist terms before alert generation.' }]),
        ...(generationEvidenceWindowReady ? [] : [{ code: 'missing_generation_evidence_window', ownerLane: 'source' as const, detail: 'Attach capture IDs and fresh source coverage before alert generation.' }]),
    ], blocker => `${blocker.code}:${blocker.ownerLane}:${blocker.detail}`)
    const readyForCustomerDelivery = blockers.length === 0

    return {
        schemaVersion: 'ti.public_actor.alert_generation_readiness_export.v1',
        sourceSchemaVersion: 'dwm.alert_generation_readiness.v1',
        query: input.result.query,
        generatedAt: input.result.generatedAt,
        route: '/api/findings/alerts/generation-readiness',
        sourceRoute: '/v1/dwm/alerts/generation-readiness',
        state: readyForCustomerDelivery ? 'ready' : candidateCount && input.actorEnrichmentCoverage.coverageRows.length ? 'review' : 'blocked',
        readyForCustomerDelivery,
        candidateCount,
        captureRefCount,
        matchedCandidateCount,
        missingRouteCandidateCount: blockers.length,
        generationEvidenceWindowReady,
        generationEvidenceWindowCaptureCount: captureRefCount,
        generationEvidenceWindowSourceFamilies: input.actorEnrichmentCoverage.summary.sourceFamilies,
        latestEvidenceAt: newestTimestamp(input.sourceHealthQueue.rows.map(row => row.timestamp)),
        blockers,
        provenance: {
            watchlistTermCount: candidateCount,
            watchlistMatchCount: matchedCandidateCount,
            coverageExportSchemaVersion: input.actorEnrichmentCoverage.schemaVersion,
            coverageRows: input.actorEnrichmentCoverage.coverageRows.length,
            sourceHealthRows: input.sourceHealthQueue.rows.length,
            sourceRequestCount: input.sourceEnrichmentIntake.summary.sourceRequests,
        },
        safeOutput: {
            metadataOnly: true,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
            liveNetworkFetch: false,
        },
    }
}
