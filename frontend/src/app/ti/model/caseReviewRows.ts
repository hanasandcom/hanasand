import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type SelectedCaseSourceRow } from './types'
import { unique } from './evidenceValues'
import { stableEvidenceFingerprint } from './reviewHandoff'

export function caseReviewRowsFor(input: {
    activeCaseItems: TiActionabilityModel['caseReviewIntake']['items']
    sourceRows: SelectedCaseSourceRow[]
    actionability: TiActionabilityModel
    caseAction: TiActionabilityModel['actionPayloads']['payloads']['caseHandoff']
    caseStage: TiActionabilityModel['consumerReadiness']['stages'][number] | undefined
}) {
    const { activeCaseItems, sourceRows, actionability, caseAction, caseStage } = input
    return activeCaseItems.slice(0, 4).map(item => {
        const itemSourceRows = sourceRows.filter(row =>
            (row.sourceId ? item.sourceIds.includes(row.sourceId) : false)
            || (row.captureId ? item.captureIds.includes(row.captureId) : false)
            || item.reasons.some(reason => reason.toLowerCase().includes(row.sourceName.toLowerCase()))
        )
        const provenanceRefs = unique([
            ...item.sourceIds,
            ...item.captureIds,
            ...item.alertIds,
            ...item.casePaths,
            ...itemSourceRows.flatMap(row => row.provenanceRefs),
        ])
        const replayRow = actionability.caseReplayReadiness.rows.find(row =>
            row.caseReviewIntakeItemId === item.id
            || row.evidenceRowId === item.evidenceRowId
            || row.alertIds.some(alertId => item.alertIds.includes(alertId))
            || row.captureIds.some(captureId => item.captureIds.includes(captureId))
        )
        const ownerLane = item.blockedBy[0]?.ownerLane
            ?? replayRow?.blockedBy[0]?.ownerLane
            ?? caseAction.blockedBy[0]?.ownerLane
            ?? (caseStage?.state === 'blocked' ? 'case' : 'case')
        return {
            id: item.id,
            evidenceRowId: item.evidenceRowId,
            title: item.title,
            priority: item.priority,
            state: item.state,
            route: item.route,
            ownerLane,
            nextAction: item.nextAction,
            recommendedAction: item.recommendedAction,
            reasons: item.reasons,
            alertIds: item.alertIds,
            captureIds: item.captureIds,
            casePaths: item.casePaths,
            sourceIds: item.sourceIds,
            provenanceRefs,
            provenanceFingerprints: unique([
                ...itemSourceRows.map(row => row.provenanceFingerprint),
                stableEvidenceFingerprint([item.id, item.evidenceRowId, ...provenanceRefs]),
            ]),
            blockers: unique([
                ...item.blockedBy.map(blocker => blocker.detail),
                ...(replayRow?.blockedBy.map(blocker => blocker.detail) ?? []),
            ]),
            replay: {
                ready: replayRow?.ready ?? false,
                state: replayRow?.state ?? 'blocked',
                exportRoute: replayRow?.exportRoute,
                caseId: replayRow?.caseId,
                blockerCodes: replayRow?.blockerCodes ?? ['missing_case_route'],
            },
        }
    })
}
