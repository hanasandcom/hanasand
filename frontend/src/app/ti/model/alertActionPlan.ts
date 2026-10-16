import { type TiSearchResponse } from '@/utils/ti/search'
import { type AnalystWorkItem, type LocalRelevanceMark, type SelectedAlertActionPlan, type SelectedCaseDraft, type WatchlistRelevance } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { unique } from './evidenceValues'
import { displayRequirementList } from './requirementCopy'

export function selectedAlertActionPlanFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    watchlist: WatchlistRelevance,
    caseDraft: SelectedCaseDraft | null,
    relevance: LocalRelevanceMark | undefined
): SelectedAlertActionPlan {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedAlertIds = selected.priority?.alertIds ?? []
    const selectedCaptureIds = selected.priority?.captureIds ?? []
    const selectedText = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const watchTerms = unique([
        ...watchlist.terms,
        ...actionability.watchlistRelevance.terms.map(term => `${term.kind}: ${term.value}`),
        ...(relevance?.watchTerms ?? []),
    ]).slice(0, 12)
    const captureIds = unique([
        ...actionability.readiness.backedIds.captureIds,
        ...(caseDraft?.sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)) ?? []),
    ])
    const sourceFamilies = unique([
        ...actionability.alertGenerationReadiness.generationEvidenceWindowSourceFamilies,
        ...actionability.sourceHealthQueue.rows.map(row => row.sourceFamily),
    ]).slice(0, 8)
    const evidenceRefs = unique([
        ...selectedSourceIds,
        ...selectedAlertIds,
        ...selectedCaptureIds,
        ...captureIds,
        selected.source,
        selected.provenance,
    ].filter(Boolean))
    const alertHandoffRows = actionability.orgRelevance.handoffRows.filter(row =>
        row.kind === 'alert_case'
        || row.kind === 'watchlist_match'
        || row.kind === 'source_evidence'
        || row.provenanceRefs.some(ref => evidenceRefs.includes(ref) || selectedText.includes(ref.toLowerCase()))
        || (row.alertId ? selectedAlertIds.includes(row.alertId) : false)
        || row.captureIds.some(captureId => selectedCaptureIds.includes(captureId) || captureIds.includes(captureId))
        || watchTerms.some(term => row.label.toLowerCase().includes(term.toLowerCase().replace(/^[^:]+:\s*/, '')))
    )
    const activeAlertHandoffRows = alertHandoffRows.length
        ? alertHandoffRows
        : actionability.orgRelevance.handoffRows.filter(row => row.kind === 'alert_case' || row.kind === 'source_evidence' || row.kind === 'watchlist_match').slice(0, 4)
    const replayRows = actionability.caseReplayReadiness.rows.filter(row =>
        row.alertIds.some(alertId => selectedAlertIds.includes(alertId) || actionability.readiness.backedIds.alertIds.includes(alertId))
        || row.captureIds.some(captureId => selectedCaptureIds.includes(captureId) || captureIds.includes(captureId))
        || row.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId))
    )
    const activeReplayRows = replayRows.length ? replayRows : actionability.caseReplayReadiness.rows.slice(0, 3)
    const missing = unique([
        ...actionability.createAlertHandoff.missing,
        ...actionability.alertGenerationReadiness.blockers.map(blocker => blocker.detail),
        ...activeAlertHandoffRows.flatMap(row => row.blockers.map(blocker => blocker.detail)),
    ]).slice(0, 8)
    return {
        schemaVersion: 'ti.public_actor.selected_alert_action_plan.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: selected.title,
        state: actionability.alertGenerationReadiness.state,
        ready: actionability.createAlertHandoff.ready && actionability.alertGenerationReadiness.readyForCustomerDelivery,
        route: actionability.alertGenerationReadiness.route,
        sourceRoute: actionability.alertGenerationReadiness.sourceRoute,
        nextAction: missing.length
            ? `Resolve ${displayRequirementList(missing.slice(0, 2))} before alert rebuild.`
            : 'Open the authenticated alert action with the selected evidence and watchlist context.',
        readiness: {
            schemaVersion: actionability.alertGenerationReadiness.schemaVersion,
            readyForCustomerDelivery: actionability.alertGenerationReadiness.readyForCustomerDelivery,
            candidateCount: actionability.alertGenerationReadiness.candidateCount,
            matchedCandidateCount: actionability.alertGenerationReadiness.matchedCandidateCount,
            captureRefCount: actionability.alertGenerationReadiness.captureRefCount,
            generationEvidenceWindowReady: actionability.alertGenerationReadiness.generationEvidenceWindowReady,
            latestEvidenceAt: actionability.alertGenerationReadiness.latestEvidenceAt,
            provenance: actionability.alertGenerationReadiness.provenance,
        },
        watchlist: {
            terms: watchTerms,
            matchedTerms: watchlist.matchedTerms,
            organizations: watchlist.organizations,
        },
        sourceRefs: {
            sourceIds: unique([...selectedSourceIds, ...actionability.sourceProvenance.map(row => row.sourceId).filter((value): value is string => Boolean(value))]),
            captureIds,
            alertIds: actionability.readiness.backedIds.alertIds,
            sourceFamilies,
        },
        evidenceRows: activeAlertHandoffRows.slice(0, 4).map(row => ({
            rowId: row.rowId,
            kind: row.kind,
            state: row.state,
            ownerLane: row.ownerLane,
            label: row.label,
            action: row.action,
            route: row.route,
            sourceFamily: row.sourceFamily,
            provenanceRefs: row.provenanceRefs,
            alertId: row.alertId,
            casePath: row.casePath,
            captureIds: row.captureIds,
            evidence: {
                summary: row.evidence.summary,
                sourceName: row.evidence.sourceName,
                provenance: row.evidence.provenance,
                reportDate: row.evidence.reportDate,
                captureId: row.evidence.captureId,
                parserStatus: row.evidence.parserStatus,
                confidence: row.evidence.confidence,
            },
            blockers: row.blockers.map(blocker => blocker.detail),
        })),
        replayRows: activeReplayRows.slice(0, 4).map(row => ({
            id: row.id,
            ready: row.ready,
            state: row.state,
            exportRoute: row.exportRoute,
            caseId: row.caseId,
            alertIds: row.alertIds,
            captureIds: row.captureIds,
            sourceIds: row.sourceIds,
            blockerCodes: row.blockerCodes,
        })),
        blockers: actionability.alertGenerationReadiness.blockers,
        handoff: {
            ready: actionability.createAlertHandoff.ready,
            endpoint: actionability.createAlertHandoff.endpoint,
            route: actionability.createAlertHandoff.backedRoute,
            missing,
        },
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}
