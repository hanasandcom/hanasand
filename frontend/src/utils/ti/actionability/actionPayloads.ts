import type { TiSearchResponse, TiActionabilityContract } from '../search'
import type { TiActorIntelligenceProfile } from '../actorIntelligence'
import type { TiActionabilityModel, PublicTiReadinessContract, PublicTiActionPayloadSet, PublicTiActionPayloadKind, TiHandoffExportPayload, PublicTiReadinessBlocker, PublicTiActionPayload } from './types/actionability'
import type { ConsumerReadinessContract } from './types/readiness'
import type { PublicTiOrgRelevanceProof } from './types/organizationRelevance'
import type { EnrichmentGapQueueItem, PublicTiSourceHealthQueue, PublicTiSourceEnrichmentIntake } from './types/sourceEnrichment'
import type { PublicTiActorEnrichmentConsumerReadinessReceipt, PublicTiAlertGenerationReadinessExport } from './types/actorReadiness'
import type { PublicTiCaseReviewIntake, PublicTiCaseReplayReadinessExport } from './types/caseReadiness'
import { uniqueStrings, uniqueBy } from './geography'
import { readTermArray } from './normalization'

export function buildPublicTiActionPayloads(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    exportPayloads: TiActionabilityModel['exportPayloads']
    consumerReadiness: ConsumerReadinessContract
    readiness: PublicTiReadinessContract
    orgRelevance: PublicTiOrgRelevanceProof
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    enrichmentGapQueue: EnrichmentGapQueueItem[]
    sourceHealthQueue: PublicTiSourceHealthQueue
    sourceEnrichmentIntake: PublicTiSourceEnrichmentIntake
    actorEnrichmentConsumerReadiness: PublicTiActorEnrichmentConsumerReadinessReceipt
    alertGenerationReadiness: PublicTiAlertGenerationReadinessExport
    caseReviewIntake: PublicTiCaseReviewIntake
    caseReplayReadiness: PublicTiCaseReplayReadinessExport
}): PublicTiActionPayloadSet {
    const actorId = actorIdForQuery(input.result.query)
    const sourceIds = uniqueStrings(input.sourceProvenance.map(source => source.sourceId))
    const provenanceIds = input.sourceProvenance.map(source => ({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        provenance: source.provenance,
        captureId: source.captureId,
        confidence: source.confidence,
    }))
    const commonContext = {
        actorId,
        query: input.result.query,
        actorClass: input.actor.actorClass,
        aliases: input.result.aliases,
        generatedAt: input.result.generatedAt,
        readinessState: input.readiness.state,
        backedIds: input.readiness.backedIds,
        orgRelevance: input.orgRelevance,
        sourceIds,
        provenanceIds,
    }
    const watchlistTerms = readTermArray(input.exportPayloads.watchlist.body.terms)
    const watchlistBlockers = blockersForAction(input.readiness, ['missing_org', 'missing_source_provenance', 'stale_provenance', 'entitlement_blocked', ...(watchlistTerms.length ? [] : ['missing_org_watchlist'] as const)])
    const caseBlockers = blockersForAction(input.readiness, ['missing_org', 'missing_alert', 'missing_capture', 'missing_case_route', 'missing_source_provenance', 'stale_provenance', 'entitlement_blocked'])
    const webhookBlockers = blockersForAction(input.readiness, ['missing_org', 'missing_alert', 'missing_capture', 'missing_webhook_destination', 'missing_source_provenance', 'stale_provenance', 'entitlement_blocked', 'unavailable_contract'])
    const analystBlockers = input.readiness.blockers
    const sourceBlockers = blockersForAction(input.readiness, ['missing_source_provenance', 'missing_capture', 'stale_provenance'])

    return {
        schemaVersion: 'ti.public_actor.action_payloads.v1',
        actorId,
        query: input.result.query,
        generatedAt: input.result.generatedAt,
        payloads: {
            watchlistAdd: actionPayload({
                kind: 'watchlist_add',
                label: 'Watchlist add request',
                actorId,
                result: input.result,
                route: '/v1/dwm/watchlists',
                backedRoute: input.exportPayloads.watchlist.backedRoute,
                body: {
                    ...input.exportPayloads.watchlist.body,
                    ...commonContext,
                    source: 'public_ti',
                    status: 'active',
                },
                provenance: input.exportPayloads.watchlist.provenance,
                blockedBy: watchlistBlockers,
            }),
            caseHandoff: actionPayload({
                kind: 'case_handoff',
                label: 'Case draft request',
                actorId,
                result: input.result,
                route: input.exportPayloads.case.endpoint ?? '/v1/cases',
                backedRoute: input.exportPayloads.case.backedRoute,
                body: {
                    ...input.exportPayloads.case.body,
                    ...commonContext,
                    caseReviewIntake: input.caseReviewIntake,
                    caseReplayReadiness: input.caseReplayReadiness,
                    source: 'public_ti',
                    noMutation: true,
                },
                provenance: input.exportPayloads.case.provenance,
                blockedBy: caseBlockers,
            }),
            webhookDelivery: actionPayload({
                kind: 'webhook_delivery',
                label: 'Webhook dry-run request',
                actorId,
                result: input.result,
                route: input.exportPayloads.webhookDelivery.endpoint ?? '/v1/dwm/webhooks/deliver',
                backedRoute: input.exportPayloads.webhookDelivery.backedRoute,
                body: {
                    ...input.exportPayloads.webhookDelivery.body,
                    ...commonContext,
                    dryRun: true,
                    noMutation: true,
                },
                provenance: input.exportPayloads.webhookDelivery.provenance,
                blockedBy: webhookBlockers,
            }),
            analystHandoffBundle: actionPayload({
                kind: 'analyst_handoff_bundle',
                label: 'Analyst handoff bundle',
                actorId,
                result: input.result,
                route: '/findings',
                backedRoute: '/findings',
                body: {
                    schemaVersion: input.consumerReadiness.consumerSchemaVersion,
                    ...commonContext,
                    stages: input.consumerReadiness.bundlePreview.stages,
                    readiness: input.readiness,
                    actorEnrichmentConsumerReadiness: input.actorEnrichmentConsumerReadiness,
                    alertGenerationReadiness: input.alertGenerationReadiness,
                    caseReviewIntake: input.caseReviewIntake,
                    caseReplayReadiness: input.caseReplayReadiness,
                    sourceEnrichmentIntake: input.sourceEnrichmentIntake,
                    actionRoutes: {
                        watchlist: '/v1/dwm/watchlists',
                        alertRebuild: '/v1/dwm/alerts/rebuild',
                        case: '/v1/cases',
                        webhookDelivery: '/v1/dwm/webhooks/deliver',
                        enrichment: '/ti/enrichment',
                    },
                },
                provenance: input.exportPayloads.blockers.provenance,
                blockedBy: analystBlockers,
            }),
            sourceEnrichment: actionPayload({
                kind: 'source_enrichment',
                label: 'Source enrichment request',
                actorId,
                result: input.result,
                route: input.exportPayloads.enrichment.backedRoute ?? '/ti/profiles',
                backedRoute: input.exportPayloads.enrichment.backedRoute,
                body: {
                    ...input.exportPayloads.enrichment.body,
                    ...commonContext,
                    tasks: input.enrichmentGapQueue,
                    sourceHealthQueue: input.sourceHealthQueue,
                    sourceEnrichmentIntake: input.sourceEnrichmentIntake,
                    actorEnrichmentConsumerReadiness: input.actorEnrichmentConsumerReadiness,
                    noMutation: true,
                },
                provenance: input.exportPayloads.enrichment.provenance,
                blockedBy: sourceBlockers,
            }),
        },
    }
}

export function actionPayload<K extends PublicTiActionPayloadKind>(input: {
    kind: K
    label: string
    actorId: string
    result: TiSearchResponse
    route: string
    backedRoute?: string
    body: Record<string, unknown>
    provenance: TiHandoffExportPayload['provenance']
    blockedBy: PublicTiReadinessBlocker[]
}): PublicTiActionPayload<K> {
    const uniqueBlockers = uniqueBy(input.blockedBy, blocker => `${blocker.code}:${blocker.stage}:${blocker.field}`)
    return {
        schemaVersion: 'ti.public_actor.action_payload.v1',
        kind: input.kind,
        label: input.label,
        actorId: input.actorId,
        query: input.result.query,
        generatedAt: input.result.generatedAt,
        method: 'POST',
        route: input.route,
        backedRoute: input.backedRoute,
        ready: uniqueBlockers.length === 0,
        unavailable: uniqueBlockers.length > 0,
        blockedBy: uniqueBlockers,
        body: input.body,
        provenance: input.provenance,
    }
}

export function blockersForAction(readiness: PublicTiReadinessContract, codes: PublicTiReadinessBlocker['code'][]): PublicTiReadinessBlocker[] {
    const allowed = new Set(codes)
    return readiness.blockers.filter(blocker => allowed.has(blocker.code))
}

export function actorIdForQuery(query: string) {
    return `actor:${query.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown'}`
}
