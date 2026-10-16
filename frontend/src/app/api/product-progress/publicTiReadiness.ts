import type { FetchResult } from './routeHelpers'
import { rows, latestTimestamp, stringsFrom, stringOrUndefined } from './routeHelpers'

export function publicTiProvenanceReadiness(input: {
    generatedAt: string
    query: string
    route: string
    fetch: FetchResult
}) {
    const payload = input.fetch.json as {
        query?: string
        rows?: Array<{ id?: string, sourceId?: string, updatedAt?: string, collectedAt?: string, firstSeenAt?: string, lastSeenAt?: string }>
        results?: Array<{ id?: string, sourceId?: string, updatedAt?: string, collectedAt?: string, firstSeenAt?: string, lastSeenAt?: string }>
        publicTiAnswer?: {
            status?: string
            evidenceLedgerReferences?: Array<{ evidenceId?: string, sourceId?: string }>
            route?: { canonicalPath?: string }
        }
        actorProfile?: {
            datasets?: { sourceCount?: number }
            provenance?: Array<{ evidenceId?: string, sourceId?: string }>
        }
        quality?: { canPromoteToReady?: boolean, publicWarningCodes?: string[] }
        actionability?: {
            schemaVersion?: string
            watchlistCandidates?: Array<{ value?: string }>
            watchlistMatches?: Array<{ value?: string }>
            relatedAlerts?: Array<{ id?: string }>
            relatedCases?: Array<{ id?: string }>
            sourceProvenance?: Array<{ sourceId?: string, provenance?: string, captureId?: string }>
            enrichmentGaps?: Array<{ id?: string }>
            handoffs?: {
                watchlist?: { method?: string, endpoint?: string, missing?: string[] }
                alertRebuild?: { method?: string, endpoint?: string, missing?: string[] }
                caseCreate?: { method?: string, endpoint?: string, missing?: string[] }
            }
            sourceFamilyCoverageMatrix?: SourceFamilyCoverageMatrix
        }
        proofArtifacts?: {
            publicTiQueryAdapter?: {
                sourceFamilyCoverageMatrix?: SourceFamilyCoverageMatrix
            }
        }
    } | undefined
    const evidenceRows = rows(payload?.rows || payload?.results)
    const ledgerRefs = rows(payload?.publicTiAnswer?.evidenceLedgerReferences || payload?.actorProfile?.provenance)
    const actionability = payload?.actionability
    const actionabilityLoaded = actionability?.schemaVersion === 'ti.query.actionability.v1'
    const sourceProvenance = Array.isArray(actionability?.sourceProvenance) ? actionability.sourceProvenance : []
    const watchlistCandidates = Array.isArray(actionability?.watchlistCandidates) ? actionability.watchlistCandidates : []
    const watchlistMatches = Array.isArray(actionability?.watchlistMatches) ? actionability.watchlistMatches : []
    const relatedAlerts = Array.isArray(actionability?.relatedAlerts) ? actionability.relatedAlerts : []
    const relatedCases = Array.isArray(actionability?.relatedCases) ? actionability.relatedCases : []
    const enrichmentGaps = Array.isArray(actionability?.enrichmentGaps) ? actionability.enrichmentGaps : []
    const handoffRoutes = [
        actionability?.handoffs?.watchlist?.endpoint,
        actionability?.handoffs?.alertRebuild?.endpoint,
        actionability?.handoffs?.caseCreate?.endpoint,
    ].filter(Boolean).map(String)
    const sourceFamilyMatrix = sourceFamilyCoverageMatrix(payload)
    const sourceFamilySummary = sourceFamilyMatrix?.summary
    const sourceFamilyRows = rows(sourceFamilyMatrix?.rows)
    const publicTiReadyFamilies = stringsFrom(sourceFamilySummary?.publicTiReadyFamilies)
    const alertReadyFamilies = stringsFrom(sourceFamilySummary?.alertReadyFamilies)
    const gapFamilies = stringsFrom(sourceFamilySummary?.gapFamilies)
    const retryFamilies = stringsFrom(sourceFamilySummary?.retryFamilies)
    const operationTypes = stringsFrom(sourceFamilySummary?.operationTypes)
    const sourceFamilyMatrixReady = sourceFamilyMatrix?.schemaVersion === 'ti.public_actor.source_family_coverage_matrix.v1'
        && sourceFamilyRows.length > 0
        && publicTiReadyFamilies.length > 0
        && stringOrUndefined(sourceFamilySummary?.latestCaptureAt)
    const sourceIds = new Set([
        ...evidenceRows.map(row => String(row.sourceId || '')).filter(Boolean),
        ...ledgerRefs.map(row => String(row.sourceId || '')).filter(Boolean),
        ...sourceProvenance.map(row => String(row.sourceId || '')).filter(Boolean),
    ])
    const latestArtifactAt = latestTimestamp(evidenceRows.map(row => String(row.lastSeenAt || row.updatedAt || row.collectedAt || row.firstSeenAt || '')))
    const warningCodes = Array.isArray(payload?.quality?.publicWarningCodes) ? payload.quality.publicWarningCodes.filter(Boolean).map(String) : []
    const baseEvidenceReady = input.fetch.ok
        && payload?.publicTiAnswer?.status === 'ready'
        && evidenceRows.length > 0
        && ledgerRefs.length > 0
        && sourceIds.size > 0
        && Boolean(latestArtifactAt)
        && warningCodes.length === 0
    const actionabilityReady = Boolean(actionabilityLoaded && sourceProvenance.length > 0 && handoffRoutes.length >= 3 && sourceFamilyMatrixReady)
    const actionabilityBlockers = [
        actionabilityLoaded ? '' : 'Public TI search route did not return actionability.schemaVersion=ti.query.actionability.v1.',
        sourceProvenance.length > 0 ? '' : 'Public TI actionability returned no source lineage.',
        handoffRoutes.length >= 3 ? '' : 'Public TI actionability returned fewer than three backed workflow routes.',
        sourceFamilyMatrixReady ? '' : 'Public TI actionability did not return ti.public_actor.source_family_coverage_matrix.v1.',
    ].filter(Boolean)
    const statusReady = baseEvidenceReady && actionabilityReady
    const blockers = [
        input.fetch.ok ? '' : input.fetch.error || `Public TI search route returned HTTP ${input.fetch.status}.`,
        payload?.publicTiAnswer ? '' : 'Public TI search route did not return publicTiAnswer.',
        evidenceRows.length > 0 ? '' : 'Public TI search route returned no evidence rows.',
        ledgerRefs.length > 0 ? '' : 'Public TI search route returned no evidence ledger references.',
        sourceIds.size > 0 ? '' : 'Public TI search route returned no source references.',
        latestArtifactAt ? '' : 'Public TI search route returned no freshness timestamp.',
        ...actionabilityBlockers,
        ...warningCodes.map(code => `Public TI quality warning: ${code}.`),
    ].filter(Boolean)

    return {
        schemaVersion: 'ti.public_provenance.readiness.v1',
        status: statusReady ? 'ready' as const : 'needs_action' as const,
        checkedAt: input.generatedAt,
        source: input.route,
        href: '/ti',
        query: payload?.query || input.query,
        actionabilityReady,
        artifactCount: evidenceRows.length,
        sourceCount: sourceIds.size || payload?.actorProfile?.datasets?.sourceCount,
        evidenceCount: ledgerRefs.length,
        dashboardHandoffCount: watchlistMatches.length + relatedAlerts.length + relatedCases.length,
        watchlistCandidateCount: watchlistCandidates.length,
        sourceProvenanceCount: sourceProvenance.length,
        relatedAlertCount: relatedAlerts.length,
        relatedCaseCount: relatedCases.length,
        enrichmentGapCount: enrichmentGaps.length,
        handoffRouteCount: handoffRoutes.length,
        sourceFamilyCoverageCount: sourceFamilyRows.length,
        publicTiReadyFamilyCount: publicTiReadyFamilies.length,
        alertReadyFamilyCount: alertReadyFamilies.length,
        gapFamilyCount: gapFamilies.length,
        retryFamilyCount: retryFamilies.length,
        sourceFamilyOperationTypeCount: operationTypes.length,
        latestArtifactAt,
        blockers,
        ownerLane: 'public-ti' as const,
        unavailableReason: blockers.length ? 'missing_public_ti_provenance_readiness_api' : undefined,
        staleAfterSeconds: 3600,
        proofTimestamp: latestArtifactAt || input.generatedAt,
        expectedDashboardRowId: 'public_ti_provenance',
        integrationProbeHint: 'GET /api/ti/search?q=<query>&limit=10 must return publicTiAnswer.status=ready, rows, source references, evidenceLedgerReferences, actionability.schemaVersion=ti.query.actionability.v1, and ti.public_actor.source_family_coverage_matrix.v1.',
        backendProofContractVersion: sourceFamilyMatrixReady ? 'ti.search.public_answer.v1 + ti.query.actionability.v1 + ti.public_actor.source_family_coverage_matrix.v1' : actionabilityLoaded ? 'ti.search.public_answer.v1 + ti.query.actionability.v1' : 'ti.search.public_answer.v1',
        detail: blockers.length
            ? blockers.join('; ')
            : `${evidenceRows.length} public TI row${evidenceRows.length === 1 ? '' : 's'} from ${sourceIds.size} source${sourceIds.size === 1 ? '' : 's'} with ${ledgerRefs.length} evidence reference${ledgerRefs.length === 1 ? '' : 's'}, ${sourceFamilyRows.length} source famil${sourceFamilyRows.length === 1 ? 'y' : 'ies'}, and ${handoffRoutes.length} backed workflow route${handoffRoutes.length === 1 ? '' : 's'}.`,
    }
}

type SourceFamilyCoverageMatrix = {
    schemaVersion?: string
    rows?: unknown[]
    summary?: {
        totalFamilies?: number
        publicTiReadyFamilies?: unknown[]
        alertReadyFamilies?: unknown[]
        gapFamilies?: unknown[]
        retryFamilies?: unknown[]
        operationTypes?: unknown[]
        latestCaptureAt?: string
        latestEnrichmentAt?: string
    }
}

function sourceFamilyCoverageMatrix(payload: {
    actionability?: { sourceFamilyCoverageMatrix?: SourceFamilyCoverageMatrix }
    proofArtifacts?: { publicTiQueryAdapter?: { sourceFamilyCoverageMatrix?: SourceFamilyCoverageMatrix } }
} | undefined) {
    return payload?.actionability?.sourceFamilyCoverageMatrix
        || payload?.proofArtifacts?.publicTiQueryAdapter?.sourceFamilyCoverageMatrix
}
