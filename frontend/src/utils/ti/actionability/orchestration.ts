import type { TiSearchResponse } from '../search'
import type { TiActorIntelligenceProfile } from '../actorIntelligence'
import type { VictimObservation } from '../actorProfile'
import type { TiActionabilityModel } from './types/actionability'
import { rationaleFor } from './geography'
import { actionabilityBaseStateFor } from './actionabilityBaseState'
import { buildExportPayloads } from './exportPayloads'
import { buildMissingDetailsQueue, buildWatchlistRelevance, buildCreateAlertHandoff, buildCaseHandoff, buildWebhookDeliveryHandoff } from './workflowHandoffs'
import { buildConsumerReadiness } from './consumerReadiness'
import { buildPublicTiStatus } from './organizationStatus'
import { buildOrgRelevanceProof } from './organizationRelevance'
import { buildEvidencePriority } from './evidencePriority'
import { buildPublicTiSourceHealthQueue, buildPublicTiSourceEnrichmentIntake } from './sourceReadiness'
import { buildPublicTiActorEnrichmentCoverage } from './actorCoverage'
import { buildPublicTiActorEnrichmentConsumerReadiness } from './actorConsumerReadiness'
import { buildPublicTiAlertGenerationReadiness } from './alertReadiness'
import { buildPublicTiCaseReviewIntake, buildPublicTiCaseReplayReadiness } from './caseReadiness'
import { buildPublicTiActionPayloads } from './actionPayloads'

export function buildTiActionability(result: TiSearchResponse, actor: TiActorIntelligenceProfile, victimObservations: VictimObservation[]): TiActionabilityModel {
    const {
        contract, candidates, matches, relatedAlerts, relatedCases, sourceProvenance, enrichmentGaps,
        geographyHandoffs, sourceClusters, watchlistPayloads, watchlistEndpoint,
        alertRebuildEndpoint, caseEndpoint, webhookDeliveryEndpoint, watchlistBlockers, casePayload,
        caseBlockers, alertDisposition, shouldAlert,
    } = actionabilityBaseStateFor(result, actor, victimObservations)
    const exportPayloads = buildExportPayloads({
        result,
        actor,
        watchlistEndpoint,
        alertRebuildEndpoint,
        caseEndpoint,
        watchlistPayloads,
        watchlistBlockers,
        casePayload,
        caseBlockers,
        webhookDeliveryEndpoint,
        webhookPayload: contract?.handoffs?.webhookDelivery?.payload,
        webhookBlockers: contract?.handoffs?.webhookDelivery?.missing,
        webhookDestinations: contract?.relatedWebhookDestinations ?? [],
        relatedAlerts,
        relatedCases,
        sourceProvenance,
        enrichmentGaps,
        geographyHandoffs,
        sourceClusters,
    })
    const enrichmentGapQueue = buildMissingDetailsQueue(enrichmentGaps)
    const consumerReadiness = buildConsumerReadiness({
        result,
        actor,
        matches,
        relatedAlerts,
        relatedCases,
        exportPayloads,
        enrichmentGapQueue,
        watchTerms: watchlistPayloads,
        sourceProvenance,
    })
    const readiness = buildPublicTiStatus({
        result,
        actor,
        matches,
        relatedAlerts,
        relatedCases,
        sourceProvenance,
        contract,
        exportPayloads,
        consumerReadiness,
    })
    const orgRelevance = buildOrgRelevanceProof({
        result,
        actor,
        matches,
        relatedAlerts,
        sourceProvenance,
        enrichmentGaps,
        exportPayloads,
        readiness,
    })
    const evidencePriority = buildEvidencePriority({
        result,
        actor,
        victimObservations,
        readiness,
        orgRelevance,
        sourceProvenance,
        relatedAlerts,
        relatedCases,
    })
    const sourceHealthQueue = buildPublicTiSourceHealthQueue({
        result,
        actor,
        orgRelevance,
        enrichmentGapQueue,
        exportPayloads,
    })
    const sourceEnrichmentIntake = buildPublicTiSourceEnrichmentIntake({
        result,
        sourceHealthQueue,
        readiness,
    })
    const actorEnrichmentCoverage = buildPublicTiActorEnrichmentCoverage({
        result,
        sourceHealthQueue,
        sourceEnrichmentIntake,
    })
    const actorEnrichmentConsumerReadiness = buildPublicTiActorEnrichmentConsumerReadiness({
        result,
        actorEnrichmentCoverage,
    })
    const alertGenerationReadiness = buildPublicTiAlertGenerationReadiness({
        result,
        watchlistTerms: watchlistPayloads,
        matches,
        readiness,
        actorEnrichmentCoverage,
        sourceHealthQueue,
        sourceEnrichmentIntake,
    })
    const caseReviewIntake = buildPublicTiCaseReviewIntake({
        result,
        evidencePriority,
        readiness,
    })
    const caseReplayReadiness = buildPublicTiCaseReplayReadiness({
        result,
        caseReviewIntake,
    })
    const actionPayloads = buildPublicTiActionPayloads({
        result,
        actor,
        exportPayloads,
        consumerReadiness,
        readiness,
        orgRelevance,
        sourceProvenance,
        enrichmentGapQueue,
        sourceHealthQueue,
        sourceEnrichmentIntake,
        actorEnrichmentConsumerReadiness,
        alertGenerationReadiness,
        caseReviewIntake,
        caseReplayReadiness,
    })

    return {
        alertDisposition,
        shouldAlert,
        rationale: contract?.rationale ?? rationaleFor(alertDisposition, candidates, matches, relatedAlerts, sourceProvenance),
        watchlist: {
            state: matches.length ? 'backed_matches' : candidates.length ? 'candidate_handoff' : 'missing_terms',
            candidates,
            matches,
            endpoint: watchlistEndpoint,
            payloads: watchlistPayloads,
            blockers: watchlistBlockers,
        },
        relatedAlerts,
        relatedCases,
        sourceProvenance,
        enrichmentGaps,
        enrichmentGapQueue,
        geographyHandoffs,
        sourceClusters,
        evidencePriority,
        sourceHealthQueue,
        sourceEnrichmentIntake,
        actorEnrichmentCoverage,
        actorEnrichmentConsumerReadiness,
        alertGenerationReadiness,
        caseReviewIntake,
        caseReplayReadiness,
        watchlistRelevance: buildWatchlistRelevance({
            state: matches.length ? 'backed_matches' : candidates.length ? 'candidate_handoff' : 'missing_terms',
            endpoint: watchlistEndpoint,
            matches,
            candidates,
            watchlistPayloads,
            blockers: watchlistBlockers,
            provenance: exportPayloads.watchlist.provenance,
        }),
        orgRelevance,
        createAlertHandoff: buildCreateAlertHandoff(exportPayloads.alertRebuild),
        caseHandoff: buildCaseHandoff(exportPayloads.case),
        webhookDeliveryHandoff: buildWebhookDeliveryHandoff(exportPayloads.webhookDelivery),
        consumerReadiness,
        readiness,
        actionPayloads,
        exportPayloads,
        handoffs: {
            watchlistEndpoint,
            alertRebuildEndpoint,
            caseEndpoint,
            webhookDeliveryEndpoint,
            casePayload,
            caseBlockers,
        },
    }
}
