import type { TiSearchResponse, TiActionabilityContract } from '../search'
import type { VictimObservation } from '../actorProfile'
import { countryFromValue, actorGeoProfile } from '../actorProfile'
import type { WatchlistCandidate, TiActionabilityModel } from './types/actionability'
import type { GeographyHandoff, SourceCluster } from './types/evidence'

export function buildGeographyHandoffs(result: TiSearchResponse, victimObservations: VictimObservation[], candidates: WatchlistCandidate[]): GeographyHandoff[] {
    const byCountry = new Map<string, VictimObservation[]>()
    for (const observation of victimObservations) {
        const country = countryFromValue(observation.country)
        if (!country) continue
        byCountry.set(country.code, [...(byCountry.get(country.code) ?? []), observation])
    }

    const countries = uniqueBy([
        ...victimObservations.map(observation => observation.country),
        ...result.targets.flatMap(target => target.regions),
        ...result.recentActivity.flatMap(item => item.countries ?? []),
    ].map(countryFromValue).filter((country): country is NonNullable<ReturnType<typeof countryFromValue>> => Boolean(country)), country => country.code)

    const targetRows = countries.map(country => {
        const observations = byCountry.get(country.code) ?? []
        const firstObservation = observations[0]
        const candidate = firstObservation
            ? candidates.find(item => item.value.toLowerCase() === firstObservation.victim.toLowerCase())
            : candidates.find(item => item.kind === 'vendor' && result.targets.some(target => target.sector.toLowerCase() === item.value.toLowerCase()))
        return {
            code: country.code,
            country: country.label,
            role: 'target' as const,
            observationCount: Math.max(1, observations.length),
            watchlistTerm: candidate ? { kind: candidate.kind, value: candidate.value, reason: candidate.reason } : undefined,
            enrichmentTask: firstObservation
                ? `Corroborate ${firstObservation.victim} with source capture, sector, and timestamp before customer alerting.`
                : `Collect country-specific source evidence for ${country.label} before using this geography in alert routing.`,
            provenanceSummary: observations.length
                ? observations.slice(0, 2).map(item => `${item.victim} · ${item.source}`).join(' | ')
                : 'Country is present in profile target geography without a named victim row.',
            evidenceRows: observations.map(item => ({
                victim: item.victim,
                source: item.source,
                sourceIds: item.sourceIds,
                provenanceRefs: item.provenanceRefs,
                reportDate: item.reportDate,
                confidence: item.confidence,
            })),
        }
    })

    const origin = actorGeoProfile(result).points.find(point => point.role === 'operator')
    const attributionEvidence = result.actorIntelligence?.attributionEvidence
    const originRows: GeographyHandoff[] = origin && attributionEvidence ? [{
        code: origin.code,
        country: origin.label,
        role: 'operator',
        observationCount: 1,
        enrichmentTask: `Keep ${origin.label} as attribution context; do not use operator origin by itself as a customer alert condition.`,
        provenanceSummary: result.actorIntelligence?.attribution ?? 'Attributed operator origin.',
        evidenceRows: [{
            victim: 'Operator attribution',
            source: attributionEvidence.sourceName,
            sourceIds: attributionEvidence.sourceId ? [attributionEvidence.sourceId] : [],
            provenanceRefs: [attributionEvidence.provenance],
            reportDate: attributionEvidence.reportDate,
            confidence: result.actorIntelligence?.confidence ?? result.confidence,
        }],
    }] : []

    return [...originRows, ...targetRows].slice(0, 12)
}

export function buildSourceClusters(sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>): SourceCluster[] {
    return sourceProvenance.map(source => {
        return {
            sourceName: source.sourceName,
            provenance: source.provenance,
            captureId: source.captureId,
            confidence: source.confidence,
            enrichmentTask: source.captureId
                ? `Use capture ${source.captureId} as replayable case evidence.`
                : `Attach capture ID or source hash for ${source.sourceName} before case replay.`,
        }
    }).slice(0, 8)
}

export function dispositionFor(input: {
    candidates: WatchlistCandidate[]
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    enrichmentGaps: NonNullable<TiActionabilityContract['enrichmentGaps']>
}): TiActionabilityModel['alertDisposition'] {
    if (input.relatedCases.length) return 'case_ready'
    if (input.relatedAlerts.length || input.matches.length) return 'ready_for_alert_review'
    if (input.candidates.length) return 'watchlist_required'
    if (input.sourceProvenance.length && !input.enrichmentGaps.some(gap => gap.severity === 'high')) return 'needs_enrichment'
    return 'not_alertable'
}

export function rationaleFor(disposition: TiActionabilityModel['alertDisposition'], candidates: WatchlistCandidate[], matches: NonNullable<TiActionabilityContract['watchlistMatches']>, alerts: NonNullable<TiActionabilityContract['relatedAlerts']>, sources: NonNullable<TiActionabilityContract['sourceProvenance']>) {
    if (disposition === 'case_ready') return 'A related case is already attached to this actor/query result.'
    if (alerts.length) return 'A backed alert ID is attached, so this result can move into case review.'
    if (matches.length) return 'A backed organization watchlist match is attached; rebuild or open alert review before customer delivery.'
    if (candidates.length) return 'The result has watchlist candidates, but no backed organization watchlist match or alert ID is attached.'
    if (sources.length) return 'Source details exist, but the result has no customer-relevant watchlist terms or alert linkage.'
    return 'The result does not have enough source, watchlist, alert, or case data to act on yet.'
}

export function normalizeKind(value: string | undefined): WatchlistCandidate['kind'] {
    if (value === 'domain' || value === 'vendor') return value
    return 'company'
}

export function uniqueStrings(values: Array<string | undefined>) {
    return uniqueBy(values.map(value => value?.trim()).filter((value): value is string => Boolean(value)), value => value)
}

export function newestTimestamp(values: Array<string | undefined>) {
    return uniqueStrings(values).sort((a, b) => Date.parse(b) - Date.parse(a))[0]
}

export function uniqueBy<T>(values: T[], keyFor: (value: T) => string) {
    const seen = new Set<string>()
    return values.filter(value => {
        const key = keyFor(value)
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}
