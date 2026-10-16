import type { CaseReviewIntakeItem } from './pageModel'
import type { TiActionabilityModel } from '@/utils/ti/actionability'

export function countLinkedLabel(count: number, label: string) {
    if (!count) return ''
    return `${count} ${label}${count === 1 ? '' : 's'} linked`
}
export type RelatedRecordRow = {
    id: string
    label: string
    meta: string
    route?: string
    kind: 'Alert' | 'Case'
    recordId: string
}
export function relatedRecordHandoffPayloadFor(record: RelatedRecordRow, actionability: TiActionabilityModel, query: string) {
    const alert = record.kind === 'Alert' ? actionability.relatedAlerts.find(item => item.id === record.recordId) : undefined
    const relatedCase = record.kind === 'Case' ? actionability.relatedCases.find(item => item.id === record.recordId) : undefined
    const matchingCaseItems = actionability.caseReviewIntake.items.filter(item =>
        item.alertIds.includes(record.recordId)
        || item.casePaths.includes(record.route ?? '')
        || (alert?.casePath ? item.casePaths.includes(alert.casePath) : false)
        || (relatedCase?.path ? item.casePaths.includes(relatedCase.path) : false)
    )
    const deliveryBlockers = alert?.deliveryReadinessContext?.blockerCodes ?? []
    const replayRows = actionability.caseReplayReadiness.rows.filter(row =>
        row.alertIds.includes(record.recordId)
        || row.caseId === record.recordId
        || row.provenance.casePaths.includes(record.route ?? '')
    )
    return {
        schemaVersion: 'ti.public_actor.related_record_handoff.v1',
        source: 'public-ti',
        sessionLocal: true,
        query,
        record: {
            id: record.recordId,
            kind: record.kind.toLowerCase(),
            label: record.label,
            meta: record.meta,
            route: record.route,
        },
        alert,
        case: relatedCase,
        caseReviewIntake: matchingCaseItems,
        caseReplayReadiness: {
            schemaVersion: actionability.caseReplayReadiness.schemaVersion,
            routeTemplate: actionability.caseReplayReadiness.routeTemplate,
            rows: replayRows,
            safeOutput: actionability.caseReplayReadiness.safeOutput,
        },
        sourceProvenance: actionability.sourceProvenance,
        readiness: {
            publicTi: actionability.readiness,
            consumer: actionability.consumerReadiness,
            delivery: alert?.deliveryReadinessContext,
            blockers: [
                ...actionability.readiness.blockers,
                ...deliveryBlockers.map(code => ({
                    schemaVersion: 'ti.public_actor.readiness_blocker.v1' as const,
                    code,
                    category: 'webhook' as const,
                    ownerLane: 'webhook' as const,
                    field: `relatedAlerts.${record.recordId}.deliveryReadinessContext`,
                    detail: `Delivery status blocker: ${code}.`,
                    route: '/findings',
                    handoff: 'Resolve delivery status before sending or replaying this alert.',
                    source: 'delivery_readiness' as const,
                })),
            ],
        },
        handoffRoutes: {
            alertRebuild: actionability.createAlertHandoff.backedRoute,
            case: record.route || actionability.caseHandoff.backedRoute,
            sourceEnrichment: actionability.exportPayloads.enrichment.backedRoute,
            webhookDelivery: actionability.webhookDeliveryHandoff.backedRoute,
        },
    }
}
export function caseReplayCandidatePayloadFor(item: CaseReviewIntakeItem, actionability: TiActionabilityModel) {
    const replayRow = actionability.caseReplayReadiness.rows.find(row => row.caseReviewIntakeItemId === item.id)
    return {
        schemaVersion: 'ti.public_actor.case_replay_candidate_export.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: actionability.caseReplayReadiness.query,
        generatedAt: actionability.caseReplayReadiness.generatedAt,
        routeTemplate: actionability.caseReplayReadiness.routeTemplate,
        candidate: item,
        replayReadiness: replayRow,
        safeOutput: actionability.caseReplayReadiness.safeOutput,
    }
}
