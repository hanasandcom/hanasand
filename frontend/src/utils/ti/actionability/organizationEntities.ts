import type { TiSearchResponse, TiActionabilityContract } from '../search'
import type { TiActorIntelligenceProfile } from '../actorIntelligence'
import type { PublicTiOrgRelevanceProof, PublicTiAffectedEntity, PublicTiOrgSourceFamily } from './types/organizationRelevance'
import { uniqueStrings } from './geography'

export function buildAffectedEntities(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    candidateTerms: PublicTiOrgRelevanceProof['candidateTerms']
    sourceEvidence: PublicTiOrgRelevanceProof['sourceEvidence']
    alertCaseRefs: PublicTiOrgRelevanceProof['alertCaseRefs']
}): PublicTiOrgRelevanceProof['affectedEntities'] {
    const evidenceRefs = uniqueStrings(input.sourceEvidence.flatMap(source => [source.sourceId, source.captureId, source.provenance]))
    const alertIds = input.alertCaseRefs.map(ref => ref.alertId)
    const entityFor = (kind: PublicTiAffectedEntity['kind'], value: string, sourceFamily: PublicTiOrgSourceFamily): PublicTiAffectedEntity => {
        const matchedTerms = input.matches.filter(match => match.value.toLowerCase() === value.toLowerCase())
        return {
            kind,
            value,
            matched: matchedTerms.length > 0 || input.candidateTerms.some(term => term.value.toLowerCase() === value.toLowerCase() && term.matched),
            sourceFamily,
            provenanceRefs: evidenceRefs,
            watchlistItemIds: uniqueStrings(matchedTerms.map(match => match.watchlistItemId)),
            alertIds,
        }
    }
    const vendorValues = uniqueStrings([
        ...input.candidateTerms.filter(term => term.kind === 'company' || term.kind === 'vendor').map(term => term.value),
        ...input.matches.filter(match => match.kind === 'company' || match.kind === 'vendor').map(match => match.value),
    ])
    const domainValues = uniqueStrings([
        ...input.candidateTerms.filter(term => term.kind === 'domain').map(term => term.value),
        ...input.matches.filter(match => match.kind === 'domain').map(match => match.value),
    ])
    const regionValues = uniqueStrings([
        ...input.actor.geographies,
        ...input.result.targets.flatMap(target => target.regions),
        ...input.result.recentActivity.flatMap(activity => activity.countries ?? []),
    ])

    return {
        vendors: vendorValues.map(value => entityFor('vendor', value, 'watchlist')).slice(0, 12),
        domains: domainValues.map(value => entityFor('domain', value, 'source_capture')).slice(0, 12),
        regions: regionValues.map(value => entityFor('region', value, 'geography')).slice(0, 12),
    }
}
