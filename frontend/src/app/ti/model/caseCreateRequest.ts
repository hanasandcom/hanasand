import { type TiSearchResponse } from '@/utils/ti/search'
import { type AnalystWorkItem, type SelectedCaseCreateRequest, type SelectedCaseDraft, type SelectedCaseOwnershipPlan, type SelectedSourceDrilldown, type SelectedWatchlistPlan } from './types'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { caseSourceRowFor } from './reviewHandoff'
import { caseReviewRowsFor } from './caseReviewRows'
import { readStringArray, unique } from './evidenceValues'
import { caseReplaySourceSchemaVersionFor, selectedCaseActorContextFor, selectedCaseWatchlistBasisFor } from './caseContext'
import { displayRequirementList, displayRequirementText } from './requirementCopy'
import { consumerRequestActionLabel } from './sourceLinks'
import { createTiSafeOutputMetadata } from './safeOutput'

export function selectedCaseCreateRequestFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actor: TiActorIntelligenceProfile,
    actionability: TiActionabilityModel,
    caseDraft: SelectedCaseDraft | null,
    caseOwnership: SelectedCaseOwnershipPlan | null,
    drilldown: SelectedSourceDrilldown | null,
    watchlistPlan: SelectedWatchlistPlan | null
): SelectedCaseCreateRequest {
    const caseStage = actionability.consumerReadiness.stages.find(stage => stage.id === 'caseHandoff')
    const caseAction = actionability.actionPayloads.payloads.caseHandoff
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedAlertIds = selected.priority?.alertIds ?? []
    const selectedCaptureIds = selected.priority?.captureIds ?? []
    const selectedCasePaths = selected.priority?.casePaths ?? []
    const selectedEvidenceRowId = selected.priority?.rowId
    const selectedText = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const sourceRows = (caseDraft?.sourceRows.length ? caseDraft.sourceRows : drilldown?.rows ?? []).map(caseSourceRowFor)
    const alertIds = unique([
        ...actionability.readiness.backedIds.alertIds,
        ...(caseOwnership?.sourceRefs.alertIds ?? []),
        ...readStringArray(caseAction.body.alertId),
    ])
    const captureIds = unique([
        ...actionability.readiness.backedIds.captureIds,
        ...(caseOwnership?.sourceRefs.captureIds ?? []),
        ...sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)),
        ...readStringArray(caseAction.body.captureIds),
    ])
    const casePaths = unique([
        ...actionability.readiness.backedIds.casePaths,
        ...(caseOwnership?.sourceRefs.casePaths ?? []),
        ...(caseDraft?.route ? [caseDraft.route] : []),
    ])
    const sourceIds = unique([
        ...(caseOwnership?.sourceRefs.sourceIds ?? []),
        ...sourceRows.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
    ])
    const watchTerms = unique([
        ...(caseDraft?.watchTerms ?? []),
        ...readStringArray(caseAction.body.watchTerms),
        ...readStringArray(caseAction.body.terms),
    ])
    const matchedCaseItems = actionability.caseReviewIntake.items.filter(item =>
        item.evidenceRowId === selectedEvidenceRowId
        || item.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId) || selectedText.includes(sourceId.toLowerCase()))
        || item.alertIds.some(alertId => selectedAlertIds.includes(alertId) || selectedText.includes(alertId.toLowerCase()))
        || item.casePaths.some(path => selectedCasePaths.includes(path) || selectedText.includes(path.toLowerCase()))
        || item.captureIds.some(captureId => selectedCaptureIds.includes(captureId) || selectedText.includes(captureId.toLowerCase()))
    )
    const activeCaseItems = matchedCaseItems.length ? matchedCaseItems : actionability.caseReviewIntake.items.slice(0, 3)
    const caseReviewRows = caseReviewRowsFor({ activeCaseItems, sourceRows, actionability, caseAction, caseStage })
    const watchlistBasis = selectedCaseWatchlistBasisFor(watchlistPlan, actionability)
    const actionReplay: SelectedCaseCreateRequest['actionReplay'] = {
        schemaVersion: actionability.caseReplayReadiness.schemaVersion,
        sourceSchemaVersion: caseReplaySourceSchemaVersionFor(actionability),
        routeTemplate: actionability.caseReplayReadiness.routeTemplate,
        ready: caseReviewRows.some(row => row.replay.ready),
        rows: caseReviewRows.map(row => ({
            caseReviewIntakeItemId: row.id,
            evidenceRowId: row.evidenceRowId,
            ready: row.replay.ready,
            exportRoute: row.replay.exportRoute,
            caseId: row.replay.caseId,
            alertIds: row.alertIds,
            captureIds: row.captureIds,
            sourceIds: row.sourceIds,
            blockerCodes: row.replay.blockerCodes,
            provenanceFingerprints: row.provenanceFingerprints,
        })),
    }
    const actorContext = selectedCaseActorContextFor(result, actor, actionability, sourceRows)
    const blockers = unique([
        ...(caseDraft?.missing ?? []),
        ...caseAction.blockedBy.map(blocker => blocker.detail),
        ...(caseStage?.missing ?? []),
        ...(caseStage && caseStage.state === 'blocked' ? [caseStage.detail] : []),
        ...(sourceRows.length ? [] : ['Source details are required before case creation review.']),
        ...(alertIds.length ? [] : ['Alert ID is required before case creation review.']),
        ...(captureIds.length ? [] : ['Capture evidence is required before case creation review.']),
        ...watchlistBasis.blockers,
        ...caseReviewRows.flatMap(row => row.blockers),
    ]).slice(0, 10)
    const requestBody = {
        ...caseAction.body,
        ...(caseDraft?.body ?? {}),
        query: result.query,
        selectedItemId: selected.id,
        selectedItemTitle: displayRequirementText(selected.title),
        sourceRows,
        alertIds,
        captureIds,
        casePaths,
        sourceIds,
        watchTerms,
        actorContext,
        watchlistBasis,
        caseReviewRows,
        actionReplay,
        provenanceRefs: unique([
            ...sourceRows.flatMap(row => row.provenanceRefs),
            ...caseReviewRows.flatMap(row => row.provenanceRefs),
        ]),
        provenanceFingerprints: unique([
            ...sourceRows.map(row => row.provenanceFingerprint),
            ...caseReviewRows.flatMap(row => row.provenanceFingerprints),
        ]),
        noMutation: true,
    }
    const ready = Boolean(caseDraft?.ready)
        && caseAction.ready
        && caseStage?.state === 'ready'
        && sourceRows.length > 0
        && alertIds.length > 0
        && captureIds.length > 0
        && blockers.length === 0
    const state: SelectedCaseCreateRequest['state'] = ready ? 'ready' : blockers.length ? 'blocked' : 'review'
    const route = caseDraft?.route || caseAction.backedRoute || caseAction.route || actionability.caseHandoff.endpoint
    return {
        schemaVersion: 'ti.public_actor.selected_case_create_request.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: displayRequirementText(selected.title),
        ready,
        state,
        route,
        nextAction: ready
            ? 'Open the authenticated case action with the selected evidence and source details attached.'
            : blockers.length ? `Resolve ${displayRequirementList(blockers.slice(0, 2))} before case creation review.` : 'Review the selected evidence before opening the authenticated case action.',
        request: {
            method: 'POST',
            path: caseStage?.request?.path ?? actionability.caseHandoff.endpoint,
            body: requestBody,
        },
        sourceRows,
        refs: {
            alertIds,
            captureIds,
            casePaths,
            sourceIds,
            watchTerms,
        },
        actorContext,
        watchlistBasis,
        actionReplay,
        caseReviewRows,
        blockers,
        consumerStage: caseStage ? {
            state: caseStage.state,
            request: caseStage.request ? consumerRequestActionLabel(caseStage.request.method, caseStage.request.path) : undefined,
            missing: caseStage.missing,
        } : undefined,
        safeOutput: createTiSafeOutputMetadata(),
    }
}
