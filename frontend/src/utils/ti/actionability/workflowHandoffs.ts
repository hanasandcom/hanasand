import type { WatchlistRelevanceContract, WatchlistCandidate, TiHandoffExportPayload } from './types/actionability'
import type { WorkflowHandoffContract } from './types/readiness'
import type { TiActionabilityContract } from '../search'
import type { EnrichmentGapQueueItem } from './types/sourceEnrichment'
import { routeForGap, sourceFamilyForGap, requestedFieldsForGap } from './normalization'

export function buildWatchlistRelevance(input: {
    state: WatchlistRelevanceContract['state']
    endpoint: string
    matches: WatchlistRelevanceContract['matches']
    candidates: WatchlistCandidate[]
    watchlistPayloads: Array<{ kind: WatchlistCandidate['kind']; value: string; notes: string }>
    blockers: string[]
    provenance: TiHandoffExportPayload['provenance']
}): WatchlistRelevanceContract {
    return {
        schemaVersion: 'ti.public_actor.watchlist_relevance.v1',
        state: input.state,
        endpoint: input.endpoint,
        matches: input.matches,
        candidates: input.candidates,
        terms: input.watchlistPayloads.map(term => ({
            ...term,
            matched: input.matches.some(match => match.kind === term.kind && match.value.toLowerCase() === term.value.toLowerCase()),
        })),
        blockers: input.blockers,
        provenance: input.provenance,
    }
}

export function buildCreateAlertHandoff(payload: TiHandoffExportPayload): WorkflowHandoffContract {
    return {
        schemaVersion: 'ti.public_actor.workflow_handoff.v1',
        kind: 'create_alert',
        method: 'POST',
        endpoint: payload.endpoint ?? '/v1/dwm/alerts/rebuild',
        ready: !payload.blocked,
        blocked: payload.blocked,
        missing: payload.missing,
        payload: payload.body,
        backedRoute: payload.backedRoute,
        provenance: payload.provenance,
    }
}

export function buildCaseHandoff(payload: TiHandoffExportPayload): WorkflowHandoffContract {
    return {
        schemaVersion: 'ti.public_actor.workflow_handoff.v1',
        kind: 'case',
        method: 'POST',
        endpoint: payload.endpoint ?? '/v1/cases',
        ready: !payload.blocked,
        blocked: payload.blocked,
        missing: payload.missing,
        payload: payload.body,
        backedRoute: payload.backedRoute,
        provenance: payload.provenance,
    }
}

export function buildWebhookDeliveryHandoff(payload: TiHandoffExportPayload): WorkflowHandoffContract {
    return {
        schemaVersion: 'ti.public_actor.workflow_handoff.v1',
        kind: 'webhook_delivery',
        method: 'POST',
        endpoint: payload.endpoint ?? '/v1/dwm/webhooks/deliver',
        ready: !payload.blocked,
        blocked: payload.blocked,
        missing: payload.missing,
        payload: payload.body,
        backedRoute: payload.backedRoute,
        provenance: payload.provenance,
    }
}

export function buildMissingDetailsQueue(gaps: NonNullable<TiActionabilityContract['enrichmentGaps']>): EnrichmentGapQueueItem[] {
    return gaps.map(gap => ({
        id: gap.id,
        title: gap.title,
        severity: gap.severity,
        detail: gap.detail,
        dependency: gap.dependency,
        route: gap.route ?? routeForGap(gap),
        sourceFamily: gap.sourceFamily ?? sourceFamilyForGap(gap),
        requestedFields: gap.requestedFields?.length ? gap.requestedFields : requestedFieldsForGap(gap),
    }))
}
