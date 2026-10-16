import type { TiActionabilityContract, TiSearchResponse } from '../search'
import type { VictimObservation } from '../actorProfile'
import type { WatchlistCandidate } from './types/actionability'
import { normalizeKind, uniqueBy } from './geography'
import type { TiActorIntelligenceProfile } from '../actorIntelligence'
import { caseIdFromPath } from './caseReadiness'
import type { EnrichmentGapQueueItem } from './types/sourceEnrichment'

export function readStringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

export function readTermArray(value: unknown) {
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : []
}

export function normalizeCandidates(contractCandidates: TiActionabilityContract['watchlistCandidates'], result: TiSearchResponse, victimObservations: VictimObservation[]): WatchlistCandidate[] {
    const candidates = [
        ...(contractCandidates ?? []).map(candidate => ({
            kind: normalizeKind(candidate.kind),
            value: candidate.value,
            reason: candidate.reason,
            confidence: candidate.confidence ?? 0.7,
        })),
        ...victimObservations.map(item => ({
            kind: 'company' as const,
            value: item.victim,
            reason: `Country observation for ${item.country}: ${item.sector}.`,
            confidence: 0.72,
        })),
        ...result.recentActivity.flatMap(item => item.victimName ? [{
            kind: 'company' as const,
            value: item.victimName,
            reason: `Recent activity victim field from ${item.firstReportedAt || item.date}.`,
            confidence: item.confidence,
        }] : []),
    ]

    return uniqueBy(candidates
        .map(candidate => ({
            ...candidate,
            value: candidate.value.trim(),
            reason: candidate.reason.trim() || 'Candidate watchlist term from actor context.',
        }))
        .filter(candidate => Boolean(candidate.value) && !/not stated|global|multiple|various|unknown/i.test(candidate.value)), candidate => `${candidate.kind}:${candidate.value.toLowerCase()}`)
        .slice(0, 12)
}

export function normalizeSourceProvenance(contractSources: TiActionabilityContract['sourceProvenance'], result: TiSearchResponse): NonNullable<TiActionabilityContract['sourceProvenance']> {
    const values = contractSources?.length ? contractSources : result.sources.map(source => ({
        sourceId: source.id,
        sourceName: source.name,
        provenance: source.url || source.provenance || source.name,
        confidence: result.confidence,
    }))
    return values.filter(item => item.sourceName && item.provenance).slice(0, 12)
}

export function normalizeMissingDetails(contractGaps: TiActionabilityContract['enrichmentGaps'], result: TiSearchResponse, actor: TiActorIntelligenceProfile, sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>): NonNullable<TiActionabilityContract['enrichmentGaps']> {
    const gaps = [...(contractGaps ?? [])]
    if (!sourceProvenance.some(source => source.captureId)) {
        gaps.push({
            id: 'capture-provenance',
            title: 'Attach capture IDs to source evidence',
            severity: 'high',
            detail: 'Source records identify provenance, but no capture IDs are attached for alert replay or case evidence.',
            dependency: 'TI search response sourceProvenance[].captureId or DWM alert evidence provenance',
            route: '/ti/profiles',
            sourceFamily: 'source_capture',
            requestedFields: ['sourceProvenance[].captureId', 'sourceProvenance[].sourceId', 'sourceProvenance[].provenance'],
        })
    }
    if (!result.actionability?.relatedAlerts?.length) {
        gaps.push({
            id: 'alert-linkage',
            title: 'Link actor result to generated alerts',
            severity: result.recentActivity.length ? 'medium' : 'high',
            detail: 'No related DWM alert IDs are attached, so the public result cannot open or create a backed case yet.',
            dependency: '/v1/dwm/alerts or /v1/dwm/alerts/rebuild alert ID',
            route: '/findings',
            sourceFamily: 'alert',
            requestedFields: ['relatedAlerts[].id', 'relatedAlerts[].casePath', 'handoffs.alertRebuild.endpoint'],
        })
    }
    if (!actor.malwareTools.length || !actor.campaigns.length) {
        gaps.push({
            id: 'actor-enrichment',
            title: 'Complete actor profile fields',
            severity: 'medium',
            detail: 'Actor tools and campaigns are needed to enrich watchlists and explain defensive relevance.',
            dependency: 'TiSearchResponse.actorIntelligence.malwareTools/campaigns',
            route: '/ti/profiles',
            sourceFamily: 'actor_profile',
            requestedFields: ['actorIntelligence.malwareTools', 'actorIntelligence.campaigns', 'actorIntelligence.sourceProvenance'],
        })
    }
    return uniqueBy(gaps, gap => gap.id).slice(0, 8)
}

export function normalizeRelatedCases(
    contractCases: TiActionabilityContract['relatedCases'],
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>,
): NonNullable<TiActionabilityContract['relatedCases']> {
    const alertCases = relatedAlerts
        .flatMap(alert => {
            const path = alert.casePath ?? alert.deliveryReadinessContext?.casePath
            const id = alert.caseIdCandidate ?? caseIdFromPath(path)
            if (!id && !path) return []
            return [{
                id: id ?? path!,
                title: alert.title,
                status: alert.status,
                ...(alert.severity ? { priority: alert.severity } : {}),
                ...(path ? { path } : {}),
            }]
        })
    return uniqueBy([...(contractCases ?? []), ...alertCases], item => item.path ?? item.id)
}

export function routeForGap(gap: NonNullable<TiActionabilityContract['enrichmentGaps']>[number]) {
    if (/alert|dwm/i.test(`${gap.id} ${gap.dependency}`)) return '/findings'
    if (/case/i.test(`${gap.id} ${gap.dependency}`)) return '/ti/workbench'
    return '/ti/profiles'
}

export function sourceFamilyForGap(gap: NonNullable<TiActionabilityContract['enrichmentGaps']>[number]): EnrichmentGapQueueItem['sourceFamily'] {
    const text = `${gap.id} ${gap.title} ${gap.detail} ${gap.dependency}`.toLowerCase()
    if (text.includes('capture') || text.includes('source')) return 'source_capture'
    if (text.includes('watchlist')) return 'watchlist'
    if (text.includes('alert')) return 'alert'
    if (text.includes('case')) return 'case'
    if (text.includes('country') || text.includes('geograph')) return 'geography'
    if (text.includes('indicator') || text.includes('ioc')) return 'indicator'
    return 'actor_profile'
}

export function requestedFieldsForGap(gap: NonNullable<TiActionabilityContract['enrichmentGaps']>[number]) {
    const family = sourceFamilyForGap(gap)
    if (family === 'source_capture') return ['sourceProvenance[].sourceId', 'sourceProvenance[].captureId', 'sourceProvenance[].provenance']
    if (family === 'alert') return ['relatedAlerts[].id', 'relatedAlerts[].status', 'relatedAlerts[].casePath']
    if (family === 'case') return ['relatedCases[].id', 'handoffs.caseCreate.payload.alertId']
    if (family === 'watchlist') return ['watchlistMatches[].organizationId', 'watchlistMatches[].watchlistItemId']
    if (family === 'geography') return ['targets[].regions', 'recentActivity[].countries', 'actorIntelligence.geographies']
    if (family === 'indicator') return ['actorIntelligence.indicators', 'actorIntelligence.infrastructure']
    return ['actorIntelligence.malwareTools', 'actorIntelligence.campaigns', 'actorIntelligence.confidenceReasoning']
}
