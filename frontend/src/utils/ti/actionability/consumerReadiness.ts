import type { TiSearchResponse, TiActionabilityContract } from '../search'
import type { TiActorIntelligenceProfile } from '../actorIntelligence'
import type { TiActionabilityModel, WatchlistCandidate, TiHandoffExportPayload } from './types/actionability'
import type { EnrichmentGapQueueItem } from './types/sourceEnrichment'
import type { ConsumerReadinessContract, ConsumerReadinessRequest, ConsumerReadinessBlocker, ConsumerReadinessStage } from './types/readiness'
import { uniqueBy } from './geography'
import { readStringArray, readTermArray } from './normalization'

export function buildConsumerReadiness(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
    exportPayloads: TiActionabilityModel['exportPayloads']
    enrichmentGapQueue: EnrichmentGapQueueItem[]
    watchTerms: Array<{ kind: WatchlistCandidate['kind']; value: string; notes: string }>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
}): ConsumerReadinessContract {
    const firstMatch = input.matches[0]
    const firstAlert = input.relatedAlerts[0]
    const firstCase = input.relatedCases[0]
    const orgId = firstMatch?.organizationId ?? firstAlert?.organizationId
    const tenantId = firstMatch?.tenantId ?? firstAlert?.tenantId ?? orgId
    const watchlistItemIds = uniqueBy(input.matches.map(match => match.watchlistItemId).filter((value): value is string => Boolean(value)).map(value => ({ value })), item => item.value).map(item => item.value)
    const watchlistId = firstMatch?.watchlistId
    const captureIds = uniqueBy([
        ...input.sourceProvenance.map(source => source.captureId).filter((value): value is string => Boolean(value)),
        ...(firstAlert?.captureIds ?? []),
    ].map(value => ({ value })), item => item.value).map(item => item.value)
    const webhookBody = input.exportPayloads.webhookDelivery.body
    const webhookDestinationIds = readStringArray(webhookBody.webhookDestinationIds)
    const publicTiRequest: ConsumerReadinessRequest = {
        method: 'POST',
        path: '/v1/dwm/watchlists',
        body: {
            tenantId,
            organizationId: orgId,
            name: `${input.result.query} exposure watchlist`,
            terms: input.watchTerms,
            status: 'active',
            source: 'public_ti',
            actorQuery: input.result.query,
            recordId: `query:${input.result.query}`,
            actorClass: input.actor.actorClass,
        },
    }
    const alertRequest: ConsumerReadinessRequest = {
        method: 'POST',
        path: '/v1/dwm/alerts/rebuild',
        body: {
            tenantId,
            organizationId: orgId,
            watchlistId,
            watchlistItemIds,
            publicTiHandoffId: `public-ti:${input.result.query}`,
        },
    }
    const caseRequest: ConsumerReadinessRequest = {
        method: 'POST',
        path: '/v1/cases',
        body: {
            tenantId,
            organizationId: orgId,
            alertId: firstAlert?.id,
            dedupeKey: firstAlert?.dedupeKey,
            caseIdCandidate: firstAlert?.caseIdCandidate ?? firstCase?.id,
            casePath: firstAlert?.casePath ?? firstCase?.path,
            title: firstAlert?.title ?? firstCase?.title ?? `${input.result.query} actor review`,
            priority: firstAlert?.severity ?? firstCase?.priority ?? 'medium',
            recommendedRoute: firstAlert?.recommendedRoute ?? 'analyst_review',
            captureIds,
            watchlistItemIds,
        },
    }
    const webhookRequest: ConsumerReadinessRequest = {
        method: 'POST',
        path: '/v1/dwm/webhooks/deliver',
        body: {
            tenantId,
            organizationId: orgId,
            alertId: webhookBody.alertId,
            dedupeKey: webhookBody.dedupeKey,
            recommendedRoute: webhookBody.recommendedRoute,
            webhookDestinationIds,
            captureIds: readStringArray(webhookBody.captureIds),
            evidenceCount: webhookBody.evidenceCount,
            idempotencyKey: webhookBody.idempotencyKey,
            dryRun: true,
        },
    }
    const enrichmentRequest: ConsumerReadinessRequest = {
        method: 'POST',
        path: '/ti/enrichment',
        body: input.exportPayloads.enrichment.body,
    }
    const blockers: ConsumerReadinessBlocker[] = [
        ...blockersForStage('publicTi', publicTiRequest, input.exportPayloads.watchlist.missing, input.exportPayloads.watchlist.provenance),
        ...blockersForStage('orgWatchlist', alertRequest, input.exportPayloads.alertRebuild.missing, input.exportPayloads.alertRebuild.provenance),
        ...blockersForStage('caseHandoff', caseRequest, input.exportPayloads.case.missing, input.exportPayloads.case.provenance),
        ...blockersForStage('webhookTrigger', webhookRequest, input.exportPayloads.webhookDelivery.missing, input.exportPayloads.webhookDelivery.provenance),
        ...blockersForStage('enrichment', enrichmentRequest, input.exportPayloads.enrichment.missing, input.exportPayloads.enrichment.provenance),
        ...(watchlistId ? [] : [consumerBlocker('missing_watchlist_id', 'orgWatchlist', 'orgWatchlist.request.body.watchlistId', 'Persisted watchlist ID is required before alert rebuild.', true)]),
        ...(watchlistItemIds.length ? [] : [consumerBlocker('missing_watchlist_item', 'orgWatchlist', 'orgWatchlist.request.body.watchlistItemIds', 'Persisted watchlist item IDs are required before alert rebuild.', true)]),
        ...(webhookDestinationIds.length ? [] : [consumerBlocker('webhook_trigger_contract_mismatch', 'webhookTrigger', 'webhookTrigger.request.body.webhookDestinationIds', 'Active webhook destination ID is required before dry-run delivery.', true)]),
        ...(webhookBody.idempotencyKey ? [] : [consumerBlocker('webhook_trigger_contract_mismatch', 'webhookTrigger', 'webhookTrigger.request.body.idempotencyKey', 'Webhook dry-run request requires an idempotency key.', true)]),
    ]
    const stages: ConsumerReadinessStage[] = [
        consumerStage('publicTi', 'Watchlist', 'Create or select the organization watchlist entry.', publicTiRequest, input.exportPayloads.watchlist, blockers),
        consumerStage('orgWatchlist', 'Alerts', 'Rebuild alert review from persisted watchlist items.', alertRequest, input.exportPayloads.alertRebuild, blockers),
        consumerStage('caseHandoff', 'Case', 'Open the related case from alert evidence and capture context.', caseRequest, input.exportPayloads.case, blockers),
        consumerStage('webhookTrigger', 'Webhook', 'Prepare a dry-run customer delivery from alert and destination context.', webhookRequest, input.exportPayloads.webhookDelivery, blockers),
        consumerStage('enrichment', 'Enrichment', `${input.enrichmentGapQueue.length} enrichment item${input.enrichmentGapQueue.length === 1 ? '' : 's'} available for source work.`, enrichmentRequest, input.exportPayloads.enrichment, blockers),
    ]
    const bundleStages = Object.fromEntries(stages.filter(stage => stage.id !== 'enrichment').map(stage => [stage.id, {
        request: stage.request,
        missing: stage.missing,
    }]))

    return {
        schemaVersion: 'ti.public_actor.consumer_readiness.v1',
        consumerSchemaVersion: 'hanasand.analyst_handoff.consumer.v1',
        orgTermsExportSchemaVersion: 'organization.watchlist_alert_terms_export.v1',
        webhookAuditSchemaVersion: 'dwm.webhook.audit_event.v1',
        ready: stages.filter(stage => stage.id !== 'enrichment').every(stage => stage.state === 'ready'),
        generatedAt: input.result.generatedAt,
        stages,
        blockers,
        bundlePreview: {
            schemaVersion: 'hanasand.analyst_handoff.consumer.v1',
            generatedAt: input.result.generatedAt,
            stages: bundleStages,
        },
    }
}

export function blockersForStage(stage: ConsumerReadinessStage['id'], request: ConsumerReadinessRequest, missing: string[], provenance: TiHandoffExportPayload['provenance']): ConsumerReadinessBlocker[] {
    const blockers = missing.map(item => consumerBlocker(blockerCodeFor(item, stage), stage, `${stage}.missing`, item, true))
    if (!request.body.organizationId && stage !== 'enrichment') blockers.push(consumerBlocker('missing_org', stage, `${stage}.request.body.organizationId`, 'Organization context is required in the authenticated console.', true))
    if (!provenance.length && stage !== 'publicTi') blockers.push(consumerBlocker('missing_provenance', stage, `${stage}.provenance`, 'Source details are required before this handoff can be consumed.', true))
    if ((stage === 'caseHandoff' || stage === 'webhookTrigger') && !readStringArray(request.body.captureIds).length) blockers.push(consumerBlocker('missing_provenance', stage, `${stage}.request.body.captureIds`, 'Capture IDs are required for case and delivery evidence.', true))
    if ((stage === 'caseHandoff' || stage === 'webhookTrigger') && !request.body.alertId) blockers.push(consumerBlocker('absent_alert_id', stage, `${stage}.request.body.alertId`, 'Alert ID is required before case or delivery handoff.', true))
    if (stage === 'publicTi' && !readTermArray(request.body.terms).length) blockers.push(consumerBlocker('missing_watchlist_term', stage, `${stage}.request.body.terms`, 'At least one watchlist term is required.', true))
    return uniqueBy(blockers, item => `${item.stage}:${item.code}:${item.field}:${item.detail}`)
}

export function consumerStage(id: ConsumerReadinessStage['id'], label: string, detail: string, request: ConsumerReadinessRequest, payload: TiHandoffExportPayload, blockers: ConsumerReadinessBlocker[]): ConsumerReadinessStage {
    const missing = uniqueBy([
        ...payload.missing,
        ...blockers.filter(blocker => blocker.stage === id).map(blocker => blocker.detail),
    ].map(value => ({ value })), item => item.value).map(item => item.value)
    return {
        id,
        label,
        state: missing.length ? 'blocked' : payload.blocked ? 'review' : 'ready',
        detail,
        route: payload.backedRoute,
        request,
        payload,
        missing,
    }
}

export function consumerBlocker(code: ConsumerReadinessBlocker['code'], stage: ConsumerReadinessStage['id'], field: string, detail: string, recoverable: boolean): ConsumerReadinessBlocker {
    return { code, stage, field, detail, recoverable }
}

export function blockerCodeFor(value: string, stage: ConsumerReadinessStage['id']): ConsumerReadinessBlocker['code'] {
    if (/organization|org|member|admin/i.test(value)) return 'missing_org'
    if (/watchlist item/i.test(value)) return 'missing_watchlist_item'
    if (/watchlist/i.test(value)) return 'missing_watchlist_id'
    if (/alert id|DWM alert ID/i.test(value)) return 'absent_alert_id'
    if (/capture|source|provenance/i.test(value)) return 'missing_provenance'
    if (/webhook|destination|idempotency/i.test(value) || stage === 'webhookTrigger') return 'webhook_trigger_contract_mismatch'
    return 'missing_stage'
}
