import { type TiSearchResponse } from '@/utils/ti/search'
import { type AlertPacket, type AnalystWorkItem, type LocalRelevanceMark, type SelectedCaseDraft, type SelectedSourceDrilldown, type WatchlistRelevance } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { caseSourceRowFor } from './reviewHandoff'
import { unique } from './evidenceValues'
import { displayRequirementText } from './requirementCopy'

export function selectedCaseDraftFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    watchlist: WatchlistRelevance,
    alertPacket: AlertPacket,
    actionability: TiActionabilityModel,
    drilldown: SelectedSourceDrilldown,
    relevance: LocalRelevanceMark | undefined,
    note: string
): SelectedCaseDraft {
    const sourceRows = drilldown.rows.map(caseSourceRowFor)
    const sourceMissing = unique(drilldown.rows.flatMap(row => row.missing))
    const watchTerms = unique([
        ...(relevance?.watchTerms ?? []),
        ...alertPacket.watchTerms,
        ...watchlist.matchedTerms,
    ]).slice(0, 10)
    const missing = unique([
        ...actionability.caseHandoff.missing,
        ...sourceMissing,
        ...(watchTerms.length ? [] : ['Watchlist term or customer relevance mark is required before case review.']),
        ...(relevance?.state === 'not_relevant' ? ['Selected evidence is marked not relevant for current case work.'] : []),
    ]).slice(0, 8)
    const caseIntent = relevance?.caseIntent ?? (selected.kind === 'exposure' ? 'case_candidate' : 'watchlist_context')
    const titlePrefix = caseIntent === 'case_candidate' ? 'Case review' : caseIntent === 'source_review' ? 'Source review' : 'Actor context'
    const body = {
        title: `${titlePrefix}: ${displayRequirementText(selected.title)}`.slice(0, 180),
        query: result.query,
        selectedItemId: selected.id,
        priority: selected.severity,
        rationale: note.trim() || relevance?.rationale || alertPacket.customerValue,
        caseIntent,
        watchTerms,
        evidence: selected.evidence.map(displayRequirementText),
        sourceRows,
        alertId: actionability.readiness.backedIds.alertIds[0],
        captureIds: unique(sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value))),
        provenance: sourceRows.map(row => ({
            sourceName: row.sourceName,
            sourceId: row.sourceId,
            provenance: row.provenance,
            provenanceRefs: row.provenanceRefs,
            provenanceFingerprint: row.provenanceFingerprint,
            captureId: row.captureId,
            reportDate: row.reportDate,
            confidence: row.confidence,
        })),
        provenanceRefs: unique(sourceRows.flatMap(row => row.provenanceRefs)),
        provenanceFingerprints: unique(sourceRows.map(row => row.provenanceFingerprint)),
        requiredBeforePost: missing,
    }

    return {
        schemaVersion: 'ti.public_actor.selected_case_draft.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: result.generatedAt,
        selectedItemId: selected.id,
        title: body.title,
        priority: selected.severity,
        caseIntent,
        ready: actionability.caseHandoff.ready && missing.length === 0,
        endpoint: actionability.caseHandoff.endpoint,
        route: actionability.caseHandoff.backedRoute,
        missing,
        watchTerms,
        sourceRows,
        body,
    }
}
