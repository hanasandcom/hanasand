import type { DecisionStep } from './pageModel'
import type { TiActionabilityModel } from '@/utils/ti/actionability'

export function actionPayloadSummaryLines(
    payload: TiActionabilityModel['actionPayloads']['payloads'][keyof TiActionabilityModel['actionPayloads']['payloads']],
    actionability: TiActionabilityModel,
) {
    if (payload.kind === 'watchlist_add') {
        return [
            `${actionability.watchlistRelevance.terms.length} watchlist term${actionability.watchlistRelevance.terms.length === 1 ? '' : 's'}`,
            `${actionability.watchlistRelevance.matches.length} org match${actionability.watchlistRelevance.matches.length === 1 ? '' : 'es'}`,
            `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    if (payload.kind === 'case_handoff') {
        return [
            `${actionability.caseReviewIntake.summary.total} case candidate${actionability.caseReviewIntake.summary.total === 1 ? '' : 's'}`,
            `${actionability.caseReviewIntake.summary.alerts} alert${actionability.caseReviewIntake.summary.alerts === 1 ? '' : 's'}`,
            `${actionability.caseReviewIntake.summary.captures} capture${actionability.caseReviewIntake.summary.captures === 1 ? '' : 's'}`,
            `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    if (payload.kind === 'webhook_delivery') {
        return [
            `${actionability.readiness.backedIds.webhookDestinationIds.length} destination${actionability.readiness.backedIds.webhookDestinationIds.length === 1 ? '' : 's'}`,
            `${actionability.readiness.backedIds.captureIds.length} capture${actionability.readiness.backedIds.captureIds.length === 1 ? '' : 's'}`,
            `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    if (payload.kind === 'analyst_handoff_bundle') {
        return [
            `${actionability.consumerReadiness.stages.length} console stage${actionability.consumerReadiness.stages.length === 1 ? '' : 's'}`,
            `${actionability.alertGenerationReadiness.candidateCount} alert candidate${actionability.alertGenerationReadiness.candidateCount === 1 ? '' : 's'}`,
            actionability.alertGenerationReadiness.generationEvidenceWindowReady ? 'evidence window ready' : 'evidence window pending',
            `${actionability.readiness.backedIds.alertIds.length} alert${actionability.readiness.backedIds.alertIds.length === 1 ? '' : 's'}`,
            `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    return [
        `${actionability.sourceEnrichmentIntake.summary.total} source item${actionability.sourceEnrichmentIntake.summary.total === 1 ? '' : 's'}`,
        `${actionability.sourceEnrichmentIntake.summary.sourceRequests} source request${actionability.sourceEnrichmentIntake.summary.sourceRequests === 1 ? '' : 's'}`,
        `${actionability.sourceEnrichmentIntake.summary.captures} capture${actionability.sourceEnrichmentIntake.summary.captures === 1 ? '' : 's'}`,
        `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
    ]
}
export type ConsumerRequestField = {
    label: string
    value: string
    state: DecisionStep['status']
}
export function consumerRequestFields(stage: TiActionabilityModel['consumerReadiness']['stages'][number]): ConsumerRequestField[] {
    const body = stage.request?.body ?? {}
    const specs: Record<TiActionabilityModel['consumerReadiness']['stages'][number]['id'], Array<{ key: string; label: string; required: boolean }>> = {
        publicTi: [
            { key: 'organizationId', label: 'Org', required: true },
            { key: 'terms', label: 'Terms', required: true },
        ],
        orgWatchlist: [
            { key: 'organizationId', label: 'Org', required: true },
            { key: 'watchlistId', label: 'Watchlist', required: true },
            { key: 'watchlistItemIds', label: 'Items', required: true },
        ],
        caseHandoff: [
            { key: 'organizationId', label: 'Org', required: true },
            { key: 'alertId', label: 'Alert', required: true },
            { key: 'captureIds', label: 'Captures', required: true },
            { key: 'casePath', label: 'Case link', required: false },
        ],
        webhookTrigger: [
            { key: 'organizationId', label: 'Org', required: true },
            { key: 'alertId', label: 'Alert', required: true },
            { key: 'webhookDestinationIds', label: 'Destination', required: true },
            { key: 'captureIds', label: 'Captures', required: true },
            { key: 'idempotencyKey', label: 'Idempotency', required: true },
        ],
        enrichment: [
            { key: 'tasks', label: 'Tasks', required: true },
            { key: 'sources', label: 'Sources', required: false },
        ],
    }

    return specs[stage.id]
        .map(spec => {
            const value = readRequestField(body[spec.key])
            return {
                label: spec.label,
                value: value ?? 'needed',
                state: value ? 'ready' as const : spec.required ? 'blocked' as const : 'review' as const,
            }
        })
        .filter(field => field.state !== 'review' || field.value !== 'needed')
}
export function readRequestField(value: unknown) {
    if (Array.isArray(value)) return value.length ? `${value.length}` : ''
    if (typeof value === 'string') return value.trim() ? value : ''
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
    if (typeof value === 'boolean') return value ? 'yes' : 'no'
    if (value && typeof value === 'object') return Object.keys(value).length ? 'set' : ''
    return ''
}
