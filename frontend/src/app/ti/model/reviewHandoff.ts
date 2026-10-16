import { type TiSearchResponse } from '@/utils/ti/search'
import { type AlertPacket, type AnalystWorkItem, type LocalDecision, type LocalRelevanceMark, type SelectedCaseSourceRow, type SelectedReviewHandoff, type SelectedSourceDrilldownRow, type WatchlistRelevance } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { displayRequirementText } from './requirementCopy'
import { unique } from './evidenceValues'

export function selectedReviewHandoffFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    watchlist: WatchlistRelevance,
    alertPacket: AlertPacket,
    actionability: TiActionabilityModel,
    decision: LocalDecision | undefined,
    relevance: LocalRelevanceMark | undefined,
    note: string
): SelectedReviewHandoff {
    const rationale = note.trim() || decision?.reason || 'No session rationale recorded.'
    return {
        schemaVersion: 'ti.public_actor.selected_review_handoff.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: result.generatedAt,
        selectedItem: {
            id: selected.id,
            kind: selected.kind,
            severity: selected.severity,
            title: displayRequirementText(selected.title),
            timestamp: selected.timestamp,
            source: selected.source,
            provenance: selected.provenance,
            confidence: selected.confidence,
            href: selected.href,
            evidence: selected.evidence.map(displayRequirementText),
            nextActions: selected.nextActions,
        },
        localReview: {
            status: decision?.status ?? 'not_recorded',
            rationale,
            decidedAt: decision?.decidedAt,
        },
        localRelevance: {
            state: relevance?.state ?? 'not_marked',
            rationale: relevance?.rationale ?? 'No session relevance mark recorded.',
            watchTerms: relevance?.watchTerms ?? [],
            caseIntent: relevance?.caseIntent ?? 'not_set',
            markedAt: relevance?.markedAt,
        },
        watchlist: {
            terms: alertPacket.watchTerms,
            matchedTerms: watchlist.matchedTerms,
            organizations: watchlist.organizations,
        },
        caseHandoff: {
            ready: actionability.caseHandoff.ready,
            endpoint: actionability.caseHandoff.endpoint,
            backedRoute: actionability.caseHandoff.backedRoute,
            missing: actionability.caseHandoff.missing,
        },
        alertHandoff: {
            ready: actionability.createAlertHandoff.ready,
            endpoint: actionability.createAlertHandoff.endpoint,
            backedRoute: actionability.createAlertHandoff.backedRoute,
            missing: actionability.createAlertHandoff.missing,
        },
        evidenceBasis: alertPacket.evidenceBasis,
        blockers: alertPacket.blockedUntil,
    }
}

export function caseSourceRowFor(row: SelectedSourceDrilldownRow | SelectedCaseSourceRow): SelectedCaseSourceRow {
    const provenanceRefs = caseSourceProvenanceRefs(row)
    return {
        sourceName: row.sourceName,
        sourceId: row.sourceId,
        provenance: row.provenance,
        captureId: row.captureId,
        reportDate: row.reportDate,
        confidence: row.confidence,
        state: row.state,
        missing: row.missing,
        provenanceRefs,
        provenanceFingerprint: stableEvidenceFingerprint(provenanceRefs),
    }
}

export function caseSourceProvenanceRefs(row: Pick<SelectedSourceDrilldownRow, 'sourceName' | 'sourceId' | 'provenance' | 'captureId' | 'reportDate'>) {
    return unique([
        row.sourceId,
        row.captureId,
        row.provenance,
        row.reportDate ? `${row.sourceName}:${row.reportDate}` : undefined,
    ].filter((value): value is string => Boolean(value)))
}

export function stableEvidenceFingerprint(values: Array<string | undefined>) {
    const input = values.filter((value): value is string => Boolean(value)).join('|').toLowerCase()
    let hash = 2166136261
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return `evidence:${(hash >>> 0).toString(16).padStart(8, '0')}`
}
