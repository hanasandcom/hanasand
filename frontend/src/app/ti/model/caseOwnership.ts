import { type TiSearchResponse } from '@/utils/ti/search'
import { type AnalystWorkItem, type CaseActionTrailPayload, type SelectedCaseDraft, type SelectedCaseOwnershipPlan } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { unique } from './evidenceValues'
import { displayRequirementList } from './requirementCopy'
import { actionOwnerLabel, consumerRequestActionLabel } from './sourceLinks'

export function selectedCaseOwnershipFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    caseDraft: SelectedCaseDraft | null,
    caseActionTrail: CaseActionTrailPayload | null
): SelectedCaseOwnershipPlan {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedAlertIds = selected.priority?.alertIds ?? []
    const selectedCasePaths = selected.priority?.casePaths ?? []
    const selectedCaptureIds = selected.priority?.captureIds ?? []
    const selectedRowId = selected.priority?.rowId
    const text = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const caseItems = actionability.caseReviewIntake.items.filter(item =>
        item.evidenceRowId === selectedRowId
        || item.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId) || text.includes(sourceId.toLowerCase()))
        || item.alertIds.some(alertId => selectedAlertIds.includes(alertId) || text.includes(alertId.toLowerCase()))
        || item.casePaths.some(path => selectedCasePaths.includes(path) || text.includes(path.toLowerCase()))
        || item.captureIds.some(captureId => selectedCaptureIds.includes(captureId) || text.includes(captureId.toLowerCase()))
    )
    const activeCaseItems = caseItems.length ? caseItems : actionability.caseReviewIntake.items.slice(0, 3)
    const activeItemIds = new Set(activeCaseItems.map(item => item.id))
    const activeEvidenceIds = new Set(activeCaseItems.map(item => item.evidenceRowId))
    const replayRows = actionability.caseReplayReadiness.rows.filter(row =>
        activeItemIds.has(row.caseReviewIntakeItemId)
        || activeEvidenceIds.has(row.evidenceRowId)
        || row.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId))
        || row.alertIds.some(alertId => selectedAlertIds.includes(alertId))
        || row.captureIds.some(captureId => selectedCaptureIds.includes(captureId))
    )
    const activeReplayRows = replayRows.length ? replayRows : actionability.caseReplayReadiness.rows.slice(0, 3)
    const itemAlertIds = unique(activeCaseItems.flatMap(item => item.alertIds))
    const itemCasePaths = unique(activeCaseItems.flatMap(item => item.casePaths))
    const relatedAlerts = actionability.relatedAlerts.filter(alert =>
        itemAlertIds.includes(alert.id)
        || Boolean(alert.casePath && itemCasePaths.includes(alert.casePath))
        || (alert.captureIds ?? []).some(captureId => selectedCaptureIds.includes(captureId))
    )
    const relatedCases = actionability.relatedCases.filter(item =>
        itemCasePaths.includes(item.path ?? '')
        || activeReplayRows.some(row => row.caseId === item.id)
    )
    const caseStage = actionability.consumerReadiness.stages.find(stage => stage.id === 'caseHandoff')
    const blockerDetails = unique([
        ...(caseDraft?.missing ?? []),
        ...activeCaseItems.flatMap(item => item.blockedBy.map(blocker => blocker.detail)),
        ...activeReplayRows.flatMap(row => row.blockedBy.map(blocker => blocker.detail)),
        ...(caseActionTrail?.events.flatMap(event => event.blockers) ?? []),
        ...(caseStage?.missing ?? []),
        ...(caseStage && caseStage.state === 'blocked' ? [caseStage.detail] : []),
    ]).slice(0, 10)
    const firstOwnerLane = activeCaseItems.flatMap(item => item.blockedBy.map(blocker => blocker.ownerLane))[0]
        ?? activeReplayRows.flatMap(row => row.blockedBy.map(blocker => blocker.ownerLane))[0]
        ?? actionability.actionPayloads.payloads.caseHandoff.blockedBy[0]?.ownerLane
        ?? (caseStage?.state === 'blocked' ? 'case' : 'case')
    const ready = Boolean(caseDraft?.ready)
        && activeReplayRows.some(row => row.ready)
        && (caseStage?.state === 'ready' || actionability.actionPayloads.payloads.caseHandoff.ready)
        && blockerDetails.length === 0
    const state: SelectedCaseOwnershipPlan['state'] = ready ? 'ready' : blockerDetails.length || activeCaseItems.some(item => item.state === 'blocked') ? 'blocked' : 'review'
    const route = caseDraft?.route
        || caseStage?.request?.path
        || actionability.actionPayloads.payloads.caseHandoff.backedRoute
        || actionability.actionPayloads.payloads.caseHandoff.route
        || actionability.caseHandoff.backedRoute
        || actionability.caseHandoff.endpoint

    return {
        schemaVersion: 'ti.public_actor.selected_case_ownership.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: selected.title,
        state,
        route,
        nextAction: ready
            ? 'Open the authenticated case action with this selected evidence and replayable references.'
            : blockerDetails.length ? `Resolve ${displayRequirementList(blockerDetails.slice(0, 2))} before assigning this evidence to a case.` : 'Review the selected case candidate and choose the authenticated owner.',
        owner: {
            lane: firstOwnerLane,
            label: actionOwnerLabel(firstOwnerLane),
        },
        summary: {
            caseCandidates: activeCaseItems.length,
            replayReady: activeReplayRows.filter(row => row.ready).length,
            relatedAlerts: relatedAlerts.length,
            relatedCases: relatedCases.length,
            captures: unique([...activeCaseItems.flatMap(item => item.captureIds), ...activeReplayRows.flatMap(row => row.captureIds)]).length,
            blockers: blockerDetails.length,
        },
        caseReviewItems: activeCaseItems.slice(0, 4).map(item => ({
            id: item.id,
            evidenceRowId: item.evidenceRowId,
            title: item.title,
            priority: item.priority,
            state: item.state,
            route: item.route,
            alertIds: item.alertIds,
            casePaths: item.casePaths,
            captureIds: item.captureIds,
            sourceIds: item.sourceIds,
            watchlistTerms: item.watchlistTerms,
            reasons: item.reasons,
            recommendedAction: item.recommendedAction,
            nextAction: item.nextAction,
            blockers: item.blockedBy.map(blocker => blocker.detail),
        })),
        replayRows: activeReplayRows.slice(0, 4).map(row => ({
            id: row.id,
            evidenceRowId: row.evidenceRowId,
            ready: row.ready,
            state: row.state,
            exportRoute: row.exportRoute,
            caseId: row.caseId,
            alertIds: row.alertIds,
            captureIds: row.captureIds,
            sourceIds: row.sourceIds,
            blockerCodes: row.blockerCodes,
        })),
        related: {
            alerts: relatedAlerts.slice(0, 4).map(alert => ({
                id: alert.id,
                status: alert.status,
                casePath: alert.casePath,
                captureIds: alert.captureIds ?? [],
                recommendedRoute: alert.recommendedRoute,
            })),
            cases: relatedCases.slice(0, 4).map(item => ({
                id: item.id,
                path: item.path,
                status: item.status,
                title: item.title,
            })),
        },
        sourceRefs: {
            alertIds: unique([...itemAlertIds, ...activeReplayRows.flatMap(row => row.alertIds)]),
            captureIds: unique([...activeCaseItems.flatMap(item => item.captureIds), ...activeReplayRows.flatMap(row => row.captureIds)]),
            casePaths: unique([...itemCasePaths, ...relatedCases.map(item => item.path).filter((value): value is string => Boolean(value))]),
            sourceIds: unique([...selectedSourceIds, ...activeCaseItems.flatMap(item => item.sourceIds), ...activeReplayRows.flatMap(row => row.sourceIds)]),
        },
        consumerStage: caseStage ? {
            id: caseStage.id,
            state: caseStage.state,
            request: caseStage.request ? consumerRequestActionLabel(caseStage.request.method, caseStage.request.path) : undefined,
            blockers: caseStage.missing,
        } : undefined,
        blockers: blockerDetails,
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}
