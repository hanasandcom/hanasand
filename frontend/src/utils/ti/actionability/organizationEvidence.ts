import type { PublicTiOrgRelevanceEnrichmentGap, PublicTiActorIdentity, PublicTiOrgRelevanceProof, PublicTiOrgSourceCoverage, PublicTiOrgSourceFamily, PublicTiOrgRelevanceEvidence } from './types/organizationRelevance'
import type { TiSearchResponse, TiActionabilityContract } from '../search'
import type { TiActorIntelligenceProfile } from '../actorIntelligence'
import { uniqueStrings, uniqueBy } from './geography'
import type { PublicTiReadinessBlocker } from './types/actionability'
import { sourceFamilyForGap } from './normalization'

export function formatGapCode(code: PublicTiOrgRelevanceEnrichmentGap['code']) {
    return code.replace(/_/g, ' ')
}

export function actorIdentityForOrgRelevance(result: TiSearchResponse, actor: TiActorIntelligenceProfile): PublicTiActorIdentity {
    return {
        canonicalName: result.query,
        aliases: uniqueStrings(result.aliases),
        actorClass: actor.actorClass,
        sectors: uniqueStrings(actor.targetSectors),
        regions: uniqueStrings(actor.geographies),
        motivations: uniqueStrings(actor.motivation),
    }
}

export function sourceCoverageForOrgRelevance(sourceEvidence: PublicTiOrgRelevanceProof['sourceEvidence'], blockers: PublicTiReadinessBlocker[]): PublicTiOrgSourceCoverage[] {
    const missingCapture = blockers.some(blocker => blocker.code === 'missing_capture')
    return sourceEvidence.map(source => ({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        sourceFamily: sourceFamilyForEvidence(source),
        provenance: source.provenance,
        captureId: source.captureId,
        sourceRequestId: source.sourceRequestId,
        parserStatus: source.parserStatus,
        confidence: source.confidence,
        status: source.captureId ? 'capture_ready' : missingCapture ? 'missing_capture' : 'public_reference',
        lastCollectedAt: source.lastCollectedAt || source.reportDate,
        supportsTerms: uniqueStrings(source.supportsTerms),
    }))
}

export function orgRelevanceEnrichmentGaps(input: {
    actorIdentity: PublicTiActorIdentity
    sourceCoverage: PublicTiOrgSourceCoverage[]
    sourceEvidence: PublicTiOrgRelevanceProof['sourceEvidence']
    freshness: TiActorIntelligenceProfile['freshness']
}): PublicTiOrgRelevanceEnrichmentGap[] {
    const gaps: PublicTiOrgRelevanceEnrichmentGap[] = []
    if (!input.actorIdentity.aliases.length) gaps.push(orgGap('missing_actor_aliases', 'public-ti', 'actorIdentity.aliases', 'Add known aliases before alert or watchlist handoff.', '/ti/profiles', 'actor_profile'))
    if (!input.actorIdentity.sectors.length) gaps.push(orgGap('missing_target_sectors', 'public-ti', 'actorIdentity.sectors', 'Attach target-sector evidence before routing this actor to a customer watchlist.', '/ti/profiles', 'actor_profile'))
    if (!input.actorIdentity.regions.length) gaps.push(orgGap('missing_target_regions', 'public-ti', 'actorIdentity.regions', 'Attach target-region evidence before regional exposure review.', '/ti/profiles', 'geography'))
    if (!input.sourceCoverage.length) gaps.push(orgGap('missing_source_coverage', 'source', 'sourceCoverage', 'Attach at least one source coverage row for this actor result.', '/ti/sources', 'source_capture'))
    if (!input.sourceEvidence.length) gaps.push(orgGap('missing_provenance', 'source', 'sourceEvidence', 'Source details are required before org relevance can be reviewed.', '/ti/profiles', 'source_capture'))
    if (input.freshness.stale) gaps.push(orgGap('stale_evidence', 'source', 'freshness.lastSeen', input.freshness.reason, '/ti/profiles', 'source_capture'))
    return uniqueBy(gaps, gap => `${gap.code}:${gap.field}`)
}

export function orgGap(
    code: PublicTiOrgRelevanceEnrichmentGap['code'],
    ownerLane: PublicTiOrgRelevanceEnrichmentGap['ownerLane'],
    field: string,
    detail: string,
    route: string,
    sourceFamily: PublicTiOrgSourceFamily,
): PublicTiOrgRelevanceEnrichmentGap {
    return {
        code,
        ownerLane,
        field,
        detail,
        route,
        sourceFamily,
        recoverable: true,
    }
}

export function sourceRefsForTerm(value: string, sources: PublicTiOrgRelevanceProof['sourceEvidence']) {
    return sources
        .filter(source => source.supportsTerms.some(term => term.toLowerCase() === value.toLowerCase()))
        .flatMap(source => [source.sourceId, source.captureId, source.provenance])
        .filter((ref): ref is string => Boolean(ref))
}

export function rowEvidenceFor(refs: string[], sources: PublicTiOrgRelevanceProof['sourceEvidence'], fallbackSummary: string): PublicTiOrgRelevanceEvidence {
    const source = sources.find(item => refs.some(ref => ref === item.sourceId || ref === item.captureId || ref === item.provenance)) ?? sources[0]
    if (!source) {
        return {
            summary: fallbackSummary,
        }
    }
    return {
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        provenance: source.provenance,
        reportDate: source.reportDate,
        captureId: source.captureId,
        confidence: source.confidence,
        summary: source.shownBecause || fallbackSummary,
    }
}

export function sourceFamilyForEvidence(source: PublicTiOrgRelevanceProof['sourceEvidence'][number]): PublicTiOrgSourceFamily {
    if (source.sourceFamily) return source.sourceFamily
    const text = `${source.sourceId ?? ''} ${source.sourceName} ${source.provenance}`.toLowerCase()
    if (/microsoft|google|cisa|mandiant|crowdstrike|proofpoint|sentinelone|palo alto|unit 42|recorded future|secureworks/.test(text)) return 'vendor_disclosure'
    if (source.captureId) return 'source_capture'
    return 'public_ti'
}

export function ownerLaneForGap(gap: NonNullable<TiActionabilityContract['enrichmentGaps']>[number]): PublicTiReadinessBlocker['ownerLane'] {
    const family = gap.sourceFamily ?? sourceFamilyForGap(gap)
    if (family === 'watchlist') return 'org'
    if (family === 'alert') return 'alert'
    if (family === 'case') return 'case'
    if (family === 'source_capture' || family === 'indicator') return 'source'
    return 'public-ti'
}

export function blockersForGap(gap: NonNullable<TiActionabilityContract['enrichmentGaps']>[number], blockers: PublicTiReadinessBlocker[]) {
    const family = gap.sourceFamily ?? sourceFamilyForGap(gap)
    if (family === 'source_capture') return blockers.filter(blocker => blocker.code === 'missing_capture' || blocker.code === 'missing_source_provenance')
    if (family === 'watchlist') return blockers.filter(blocker => blocker.code === 'missing_org' || blocker.code === 'missing_org_watchlist')
    if (family === 'alert') return blockers.filter(blocker => blocker.code === 'missing_alert')
    if (family === 'case') return blockers.filter(blocker => blocker.code === 'missing_case_route')
    return blockers.filter(blocker => blocker.code === 'stale_provenance')
}

export function sourceFamilyForReadinessBlocker(blocker: PublicTiReadinessBlocker): PublicTiOrgSourceFamily {
    if (blocker.ownerLane === 'org') return 'watchlist'
    if (blocker.ownerLane === 'alert') return 'alert'
    if (blocker.ownerLane === 'case') return 'case'
    if (blocker.ownerLane === 'webhook') return 'webhook'
    if (blocker.ownerLane === 'source') return 'source_capture'
    return 'public_ti'
}
