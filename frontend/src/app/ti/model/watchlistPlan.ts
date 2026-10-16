import { type TiSearchResponse } from '@/utils/ti/search'
import { type AnalystWorkItem, type LocalRelevanceMark, type SelectedWatchlistPlan, type WatchlistRelevance } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { unique, uniqueBy } from './evidenceValues'
import { watchlistTermParts } from './watchlistPayloads'
import { displayRequirementList } from './requirementCopy'

export function selectedWatchlistPlanFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    watchlist: WatchlistRelevance,
    relevance: LocalRelevanceMark | undefined
): SelectedWatchlistPlan {
    const selectedText = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const candidateTerms = uniqueBy([
        ...actionability.watchlistRelevance.terms,
        ...watchlist.terms.map(term => {
            const parsed = watchlistTermParts(term)
            return { kind: parsed.kind, value: parsed.value, notes: watchlist.rationale, matched: watchlist.matchedTerms.some(match => match.toLowerCase() === term.toLowerCase()) }
        }),
        ...(relevance?.watchTerms ?? []).map(term => {
            const parsed = watchlistTermParts(term)
            return { kind: parsed.kind, value: parsed.value, notes: relevance?.rationale ?? 'Session relevance mark.', matched: false }
        }),
    ], term => `${term.kind}:${term.value.toLowerCase()}`).filter(term =>
        selectedText.includes(term.value.toLowerCase())
        || actionability.orgRelevance.candidateTerms.some(candidate => candidate.kind === term.kind && candidate.value.toLowerCase() === term.value.toLowerCase())
    )
    const selectedTerms = candidateTerms.length ? candidateTerms : actionability.watchlistRelevance.terms.slice(0, 4)
    const selectedValues = new Set(selectedTerms.map(term => `${term.kind}:${term.value.toLowerCase()}`))
    const intersections = actionability.orgRelevance.watchlistIntersections.filter(item =>
        selectedValues.has(`${item.kind}:${item.value.toLowerCase()}`)
        || item.sourceEvidenceRefs.some(ref => selectedSourceIds.includes(ref) || selectedText.includes(ref.toLowerCase()))
    )
    const relevantIntersections = intersections.length ? intersections : actionability.orgRelevance.watchlistIntersections.slice(0, 3)
    const selectedTermKeys = new Set(selectedTerms.map(term => `${term.kind}:${term.value.toLowerCase()}`))
    const selectedEvidenceRefs = unique([
        ...selectedSourceIds,
        ...(selected.priority?.captureIds ?? []),
        selected.source,
        selected.provenance,
    ].filter(Boolean))
    const relevanceCandidates = uniqueBy([
        ...actionability.orgRelevance.candidateTerms.filter(term =>
            selectedTermKeys.has(`${term.kind}:${term.value.toLowerCase()}`)
            || term.sourceEvidenceRefs.some(ref => selectedEvidenceRefs.some(selectedRef => selectedRef.toLowerCase() === ref.toLowerCase() || selectedText.includes(ref.toLowerCase())))
            || selectedText.includes(term.value.toLowerCase())
        ),
        ...selectedTerms.map(term => ({
            kind: term.kind,
            value: term.value,
            notes: term.notes,
            matched: term.matched,
            sourceEvidenceRefs: actionability.orgRelevance.sourceEvidence
                .filter(source => source.supportsTerms.some(value => value.toLowerCase() === term.value.toLowerCase()))
                .flatMap(source => [source.sourceId, source.captureId, source.provenance].filter((value): value is string => Boolean(value))),
        })),
    ], term => `${term.kind}:${term.value.toLowerCase()}`).slice(0, 6)
    const relevanceRows = relevanceCandidates.map(term => {
        const matchingIntersection = relevantIntersections.find(item => item.kind === term.kind && item.value.toLowerCase() === term.value.toLowerCase())
            ?? actionability.orgRelevance.watchlistIntersections.find(item => item.kind === term.kind && item.value.toLowerCase() === term.value.toLowerCase())
        const sourceEvidence = actionability.orgRelevance.sourceEvidence.filter(source =>
            term.sourceEvidenceRefs.some(ref => ref === source.sourceId || ref === source.captureId || ref === source.provenance)
            || source.supportsTerms.some(value => value.toLowerCase() === term.value.toLowerCase())
        )
        const evidenceRefs = unique([
            ...term.sourceEvidenceRefs,
            ...(matchingIntersection?.sourceEvidenceRefs ?? []),
            ...sourceEvidence.flatMap(source => [source.sourceId, source.captureId, source.provenance].filter((value): value is string => Boolean(value))),
        ]).slice(0, 8)
        const handoffRows = actionability.orgRelevance.handoffRows.filter(row =>
            row.label.toLowerCase().includes(term.value.toLowerCase())
            || row.provenanceRefs.some(ref => evidenceRefs.includes(ref))
            || (matchingIntersection?.watchlistItemId ? row.watchlistItemId === matchingIntersection.watchlistItemId : false)
            || (matchingIntersection?.alertIds ?? []).some(alertId => row.alertId === alertId)
            || (matchingIntersection?.casePaths ?? []).some(casePath => row.casePath === casePath)
        )
        const blockersForTerm = unique([
            ...(matchingIntersection?.blockers.map(blocker => blocker.handoff) ?? []),
            ...handoffRows.flatMap(row => row.blockers.map(blocker => blocker.handoff)),
            ...(!term.matched ? actionability.watchlistRelevance.blockers : []),
            ...(sourceEvidence.some(source => source.captureId) ? [] : ['Capture evidence is required before alert rebuild.']),
        ]).slice(0, 6)
        const blockerOwners = unique([
            ...(matchingIntersection?.blockers.map(blocker => blocker.ownerLane) ?? []),
            ...handoffRows.flatMap(row => row.blockers.map(blocker => blocker.ownerLane)),
        ]).slice(0, 4) as SelectedWatchlistPlan['relevanceRows'][number]['blockerOwners']
        const alertable = Boolean(matchingIntersection?.alertIds.length && matchingIntersection.captureIds.length && !blockersForTerm.length)
        return {
            kind: term.kind,
            value: term.value,
            fit: term.matched ? 'matched' as const : blockersForTerm.length ? 'blocked' as const : 'near' as const,
            alertable,
            route: matchingIntersection?.route ?? actionability.exportPayloads.watchlist.backedRoute ?? actionability.exportPayloads.watchlist.route,
            evidenceRefs,
            sourceFamilies: unique(sourceEvidence.flatMap(source => source.sourceFamily ? [source.sourceFamily] : [])).slice(0, 4),
            evidenceRows: sourceEvidence.slice(0, 4).map(source => ({
                sourceName: source.sourceName,
                sourceId: source.sourceId,
                provenance: source.provenance,
                reportDate: source.reportDate,
                captureId: source.captureId,
                sourceRequestId: source.sourceRequestId,
                sourceFamily: source.sourceFamily,
                parserStatus: source.parserStatus,
                lastCollectedAt: source.lastCollectedAt,
                confidence: source.confidence,
                shownBecause: source.shownBecause,
            })),
            handoffRows: handoffRows.slice(0, 4).map(row => ({
                rowId: row.rowId,
                kind: row.kind,
                state: row.state,
                ownerLane: row.ownerLane,
                label: row.label,
                action: row.action,
                route: row.route,
                sourceFamily: row.sourceFamily,
                blockerCount: row.blockers.length,
            })),
            blockers: blockersForTerm,
            blockerOwners,
            nextAction: alertable
                ? 'Rebuild alert review from the persisted watchlist item and selected source evidence.'
                : blockersForTerm.length ? `Resolve ${displayRequirementList(blockersForTerm.slice(0, 2))} before alert rebuild.` : 'Review this candidate against the organization watchlist before alert rebuild.',
        }
    })
    const blockers = unique([
        ...actionability.watchlistRelevance.blockers,
        ...actionability.exportPayloads.watchlist.missing,
        ...relevantIntersections.flatMap(item => item.blockers.map(blocker => blocker.handoff)),
    ]).slice(0, 8)
    const ready = actionability.actionPayloads.payloads.watchlistAdd.ready && relevantIntersections.some(item => item.state === 'ready')
    return {
        schemaVersion: 'ti.public_actor.selected_watchlist_plan.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: result.generatedAt,
        selectedItemId: selected.id,
        title: selected.title,
        state: actionability.watchlistRelevance.state,
        ready,
        route: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
        nextAction: ready
            ? 'Open the authenticated watchlist action with the selected evidence and persisted item refs.'
            : blockers.length ? `Resolve ${displayRequirementList(blockers.slice(0, 2))} before monitoring this evidence.` : 'Review the candidate term and persist it to an organization watchlist.',
        terms: selectedTerms.map(term => ({
            kind: term.kind,
            value: term.value,
            matched: term.matched || relevantIntersections.some(item => item.kind === term.kind && item.value.toLowerCase() === term.value.toLowerCase()),
            notes: term.notes,
        })),
        relevanceRows,
        intersections: relevantIntersections.map(item => ({
            intersectionId: item.intersectionId,
            kind: item.kind,
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
            blockers: item.blockers,
        })),
        sourceRefs: {
            sourceIds: unique([...selectedSourceIds, ...actionability.sourceProvenance.map(row => row.sourceId).filter((value): value is string => Boolean(value))]),
            captureIds: unique(relevantIntersections.flatMap(item => item.captureIds)),
            alertIds: unique(relevantIntersections.flatMap(item => item.alertIds)),
            casePaths: unique(relevantIntersections.flatMap(item => item.casePaths)),
        },
        blockers,
        handoff: {
            ready,
            route: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
            blocked: actionability.exportPayloads.watchlist.blocked,
            missing: actionability.exportPayloads.watchlist.missing,
        },
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}
