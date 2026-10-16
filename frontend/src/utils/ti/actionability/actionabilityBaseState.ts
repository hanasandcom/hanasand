import type { TiSearchResponse } from '../search'
import type { TiActorIntelligenceProfile } from '../actorIntelligence'
import type { VictimObservation } from '../actorProfile'
import { normalizeCandidates, normalizeRelatedCases, normalizeSourceProvenance, normalizeMissingDetails } from './normalization'
import { buildGeographyHandoffs, buildSourceClusters, uniqueBy, dispositionFor } from './geography'

export function actionabilityBaseStateFor(
    result: TiSearchResponse,
    actor: TiActorIntelligenceProfile,
    victimObservations: VictimObservation[],
) {
    const contract = result.actionability
    const candidates = normalizeCandidates(contract?.watchlistCandidates, result, victimObservations)
    const matches = contract?.watchlistMatches ?? []
    const relatedAlerts = contract?.relatedAlerts ?? []
    const relatedCases = normalizeRelatedCases(contract?.relatedCases, relatedAlerts)
    const sourceProvenance = normalizeSourceProvenance(contract?.sourceProvenance, result)
    const enrichmentGaps = normalizeMissingDetails(contract?.enrichmentGaps, result, actor, sourceProvenance)
    const geographyHandoffs = buildGeographyHandoffs(result, victimObservations, candidates)
    const sourceClusters = buildSourceClusters(sourceProvenance)
    const firstAlert = relatedAlerts[0]
    const watchlistPayloads = contract?.handoffs?.watchlist?.payloads ?? candidates.slice(0, 8).map(candidate => ({
        kind: candidate.kind,
        value: candidate.value,
        notes: `${result.query}: ${candidate.reason}`,
    }))
    const watchlistEndpoint = contract?.handoffs?.watchlist?.endpoint ?? '/api/organizations/:id/watchlists'
    const alertRebuildEndpoint = contract?.handoffs?.alertRebuild?.endpoint ?? '/v1/dwm/alerts/rebuild'
    const caseEndpoint = contract?.handoffs?.caseCreate?.endpoint ?? '/v1/cases'
    const webhookDeliveryEndpoint = contract?.handoffs?.webhookDelivery?.endpoint ?? '/v1/dwm/webhooks/deliver'
    const watchlistBlockers = contract?.handoffs?.watchlist?.missing ?? (matches.length ? [] : ['Authenticated organization ID and member/admin watchlist permission'])
    const casePayload = contract?.handoffs?.caseCreate?.payload ?? (firstAlert ? {
        alertId: firstAlert.id,
        title: firstAlert.title,
        priority: firstAlert.severity,
        note: `Opened from public TI result ${result.query}.`,
    } : undefined)
    const caseDependencyBlockers = contract?.handoffs?.caseCreate?.missing ?? (casePayload ? [] : ['DWM alert ID from /v1/dwm/alerts or /v1/dwm/alerts/rebuild'])
    const caseBlockers = uniqueBy([...caseDependencyBlockers, ...(!matches.length ? watchlistBlockers : [])].map(value => ({ value })), item => item.value).map(item => item.value)
    const alertDisposition = contract?.alertDisposition ?? dispositionFor({ candidates, matches, relatedAlerts, relatedCases, sourceProvenance, enrichmentGaps })
    const shouldAlert = contract?.shouldAlert ?? (alertDisposition === 'ready_for_alert_review' || alertDisposition === 'case_ready')
    return {
        contract, candidates, matches, relatedAlerts, relatedCases, sourceProvenance, enrichmentGaps,
        geographyHandoffs, sourceClusters, firstAlert, watchlistPayloads, watchlistEndpoint,
        alertRebuildEndpoint, caseEndpoint, webhookDeliveryEndpoint, watchlistBlockers, casePayload,
        caseBlockers, alertDisposition, shouldAlert,
    }
}
