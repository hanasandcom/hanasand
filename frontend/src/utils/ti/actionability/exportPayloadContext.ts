import type { TiSearchResponse, TiActionabilityContract } from '../search'
import type { TiActorIntelligenceProfile } from '../actorIntelligence'
import type { WatchlistCandidate } from './types/actionability'
import type { GeographyHandoff, SourceCluster } from './types/evidence'
import { uniqueBy } from './geography'

export type ExportPayloadInput = {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    watchlistEndpoint: string
    alertRebuildEndpoint: string
    caseEndpoint: string
    watchlistPayloads: Array<{ kind: WatchlistCandidate['kind']; value: string; notes: string }>
    watchlistBlockers: string[]
    casePayload?: { alertId: string; title?: string; priority?: string; note?: string }
    caseBlockers: string[]
    webhookDeliveryEndpoint: string
    webhookPayload?: Record<string, unknown>
    webhookBlockers?: string[]
    webhookDestinations: NonNullable<TiActionabilityContract['relatedWebhookDestinations']>
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    enrichmentGaps: NonNullable<TiActionabilityContract['enrichmentGaps']>
    geographyHandoffs: GeographyHandoff[]
    sourceClusters: SourceCluster[]
}

export function exportPayloadContextFor(input: ExportPayloadInput) {
    const provenance = input.sourceProvenance.map(source => ({
        sourceName: source.sourceName,
        provenance: source.provenance,
        captureId: source.captureId,
        confidence: source.confidence,
    }))
    const watchTerms = input.watchlistPayloads.map(payload => ({
        kind: payload.kind,
        value: payload.value,
        notes: payload.notes,
    }))
    const relatedAlertContext = input.relatedAlerts.map(alert => ({
        id: alert.id,
        title: alert.title,
        status: alert.status,
        severity: alert.severity,
        caseIdCandidate: alert.caseIdCandidate,
        casePath: alert.casePath,
        source: alert.source,
        tenantId: alert.tenantId,
        organizationId: alert.organizationId,
        dedupeKey: alert.dedupeKey,
        recommendedRoute: alert.recommendedRoute,
        captureIds: alert.captureIds,
        evidenceCount: alert.evidenceCount,
        webhookDestinationIds: alert.webhookDestinationIds,
    }))
    const webhookDestinations = input.webhookDestinations.filter(destination => destination.status === 'active')
    const firstAlert = input.relatedAlerts[0]
    const captureIds = uniqueBy([
        ...input.sourceClusters.map(source => source.captureId).filter((captureId): captureId is string => Boolean(captureId)),
        ...(firstAlert?.captureIds ?? []),
    ].map(value => ({ value })), item => item.value).map(item => item.value)
    const webhookDestinationIds = uniqueBy([
        ...webhookDestinations.map(destination => destination.id),
        ...(firstAlert?.webhookDestinationIds ?? []),
    ].map(value => ({ value })), item => item.value).map(item => item.value)
    const webhookMissing = input.webhookBlockers ?? [
        ...(firstAlert?.id ? [] : ['DWM alert ID from /v1/dwm/alerts or /v1/dwm/alerts/rebuild']),
        ...(webhookDestinationIds.length ? [] : ['Active webhook destination ID from /v1/dwm/webhooks']),
        ...(captureIds.length ? [] : ['Replayable capture ID from source details or DWM alert evidence']),
    ]
    const relatedCaseContext = input.relatedCases.map(item => ({
        id: item.id,
        title: item.title,
        status: item.status,
        priority: item.priority,
        path: item.path,
    }))
    const enrichmentTasks = uniqueBy([
        ...input.enrichmentGaps.map(gap => ({
            id: gap.id,
            title: gap.title,
            severity: gap.severity,
            detail: gap.detail,
            dependency: gap.dependency,
        })),
        ...input.sourceClusters.map(source => ({
            id: `source:${source.sourceName}:${source.captureId || source.provenance}`,
            title: source.captureId ? 'Attach replayable capture as case evidence' : 'Attach capture ID or source hash',
            severity: source.captureId ? 'low' as const : 'high' as const,
            detail: source.enrichmentTask,
            dependency: source.captureId ? input.caseEndpoint : 'sourceProvenance[].captureId or source hash',
        })),
        ...input.geographyHandoffs.filter(item => !item.watchlistTerm).map(item => ({
            id: `geo:${item.role}:${item.code}`,
            title: `${item.country} ${item.role === 'operator' ? 'attribution' : 'targeting'} review`,
            severity: item.role === 'operator' ? 'low' as const : 'medium' as const,
            detail: item.enrichmentTask,
            dependency: item.role === 'operator' ? 'actor attribution source details' : 'country-specific victim/source evidence',
        })),
    ], task => task.id).slice(0, 12)
    const caseBody = input.casePayload ?? {
        sourceType: 'ti_actor',
        sourceId: input.result.query,
        title: `${input.result.query} actor/query review`,
        priority: relatedAlertContext[0]?.severity ?? 'medium',
        summary: input.result.summary,
        relatedAlertIds: relatedAlertContext.map(alert => alert.id),
        watchTerms,
        provenance,
    }
    return {
        provenance, watchTerms, relatedAlertContext, webhookDestinations, firstAlert,
        captureIds, webhookDestinationIds, webhookMissing, relatedCaseContext, enrichmentTasks, caseBody,
    }
}
