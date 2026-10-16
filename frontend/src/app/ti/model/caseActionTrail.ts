import { type TiSearchResponse } from '@/utils/ti/search'
import { type AnalystWorkItem, type CaseActionTrailEvent, type CaseActionTrailPayload, type LocalDecision, type LocalRelevanceMark, type SelectedCaseDraft, type SelectedReviewHandoff } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { unique } from './evidenceValues'
import { decisionLabel, relevanceLabel } from './reviewLabels'
import { displayRequirementList } from './requirementCopy'
import { createTiSafeOutputMetadata } from './safeOutput'

export function selectedCaseActionTrailFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    reviewHandoff: SelectedReviewHandoff | null,
    caseDraft: SelectedCaseDraft | null,
    decision: LocalDecision | undefined,
    relevance: LocalRelevanceMark | undefined,
    note: string
): CaseActionTrailPayload {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const replayRows = actionability.caseReplayReadiness.rows.filter(row =>
        row.evidenceRowId === selected.priority?.rowId
        || row.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId))
        || row.alertIds.some(alertId => actionability.readiness.backedIds.alertIds.includes(alertId))
    )
    const activeReplayRows = replayRows.length ? replayRows : actionability.caseReplayReadiness.rows.slice(0, 2)
    const caseRoute = caseDraft?.route || reviewHandoff?.caseHandoff.backedRoute
    const now = new Date().toISOString()
    const baseProvenance = {
        sourceIds: selectedSourceIds,
        captureIds: unique(caseDraft?.sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)) ?? []),
        alertIds: actionability.readiness.backedIds.alertIds,
        confidence: selected.confidence,
        reportDate: selected.timestamp,
        source: selected.source,
    }
    const events: CaseActionTrailEvent[] = [
        {
            id: `selected:${selected.id}`,
            at: selected.timestamp,
            label: 'Selected evidence',
            detail: selected.subtitle,
            state: 'review',
            route: selected.href,
            blockers: [],
            evidenceRowId: selected.priority?.rowId,
            provenance: baseProvenance,
        },
        {
            id: `case-handoff:${selected.id}`,
            at: result.generatedAt,
            label: caseDraft?.ready ? 'case delivery ready' : 'case delivery syncing',
            detail: caseDraft?.ready
                ? 'Selected evidence has the required case link, sources, and watch terms for authenticated review.'
                : 'Case review needs the missing identifiers or sources listed below before persistence.',
            state: caseDraft?.ready ? 'ready' : 'blocked',
            route: caseRoute,
            blockers: unique([...(caseDraft?.missing ?? []), ...(reviewHandoff?.blockers ?? [])]).slice(0, 8),
            evidenceRowId: selected.priority?.rowId,
            provenance: {
                ...baseProvenance,
                caseId: caseRoute ? publicTiCaseIdFromPath(caseRoute) : undefined,
            },
        },
        ...(decision ? [{
            id: `decision:${selected.id}:${decision.decidedAt}`,
            at: decision.decidedAt,
            label: decisionLabel(decision.status),
            detail: `${decision.reason}${note.trim() && note.trim() !== decision.reason ? ` Note: ${note.trim()}` : ''}`,
            state: 'local' as const,
            route: caseRoute,
            blockers: caseDraft?.missing ?? [],
            evidenceRowId: selected.priority?.rowId,
            provenance: baseProvenance,
        }] : []),
        ...(relevance ? [{
            id: `relevance:${selected.id}:${relevance.markedAt}`,
            at: relevance.markedAt,
            label: relevanceLabel(relevance.state),
            detail: relevance.rationale,
            state: relevance.state === 'not_relevant' ? 'blocked' as const : relevance.state === 'needs_source' ? 'review' as const : 'ready' as const,
            route: caseRoute,
            blockers: relevance.state === 'needs_source' ? ['Source review required before case delivery.'] : relevance.state === 'not_relevant' ? ['Selected evidence marked not relevant for current customer work.'] : [],
            evidenceRowId: selected.priority?.rowId,
            provenance: {
                ...baseProvenance,
                caseId: caseRoute ? publicTiCaseIdFromPath(caseRoute) : undefined,
            },
        }] : []),
        ...activeReplayRows.slice(0, 3).map(row => ({
            id: `replay:${row.id}`,
            at: result.generatedAt,
            label: row.ready ? 'Replay export ready' : 'Replay export syncing',
            detail: row.ready
                ? 'Replay request has case, alert, capture, and source references.'
                : `Replay request needs ${displayRequirementList(row.blockerCodes)}.`,
            state: row.ready ? 'ready' as const : 'blocked' as const,
            route: row.exportRoute,
            blockers: row.blockedBy.map(blocker => blocker.detail),
            replayExportRoute: row.exportRoute,
            evidenceRowId: row.evidenceRowId,
            provenance: {
                sourceIds: row.sourceIds,
                captureIds: row.captureIds,
                alertIds: row.alertIds,
                caseId: row.caseId,
            },
        })),
    ]
    const ready = events.filter(event => event.state === 'ready').length
    const blocked = events.filter(event => event.state === 'blocked').length
    return {
        schemaVersion: 'ti.public_actor.case_action_trail.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: now,
        selectedItemId: selected.id,
        title: selected.title,
        events,
        summary: {
            total: events.length,
            ready,
            blocked,
            sessionLocal: true,
            replayable: activeReplayRows.some(row => row.ready),
        },
        safeOutput: createTiSafeOutputMetadata(),
    }
}

export function publicTiCaseIdFromPath(path?: string) {
    if (!path) return undefined
    const match = path.match(/\/cases\/([^/?#]+)/)
    return match?.[1]
}
