import type { TiSearchResponse } from './search'
import type { VictimObservation } from './actorProfile'
import type { TiActorIntelligenceProfile } from './actorIntelligenceTypes'
import { buildProvenanceRows, buildSourceCoverage, buildTechniqueCoverage } from './actorIntelligenceEvidence'
import { buildCampaignTimeline, freshnessFor } from './actorIntelligenceTimeline'
import { unique } from './actorIntelligenceValues'

export type { TiActorSourceProvenance, TiActorSourceCoverage, TiActorTechniqueCoverage, TiActorCampaignTimelineItem, TiActorIntelligenceProfile } from './actorIntelligenceTypes'

export function buildActorIntelligence(result: TiSearchResponse, victimObservations: VictimObservation[]): TiActorIntelligenceProfile {
    const contract = result.actorIntelligence
    const fallback = fallbackActorIntelligence(result, victimObservations)
    const victimActivity = result.recentActivity.filter(item => item.victimName || item.claimType === 'victim_claim')
    const targetSectors = unique([
        ...(contract?.targetSectors ?? []),
        ...result.targets.map(target => target.sector),
        ...victimObservations.map(item => item.sector),
        ...victimActivity.flatMap(item => item.affectedSectors ?? []),
    ]).filter(item => !/not stated/i.test(item))
    const geographies = unique([
        ...(contract?.geographies ?? []),
        ...result.targets.flatMap(target => target.regions),
        ...victimObservations.map(item => item.country),
        ...victimActivity.flatMap(item => item.countries ?? []),
    ]).filter(item => !/not stated|global|multiple|various|unknown|north america|europe|nato-aligned/i.test(item))
    const sourceProvenance = unique([
        ...(contract?.sourceProvenance ?? []),
        ...result.sources.map(source => source.url || source.provenance || source.name),
        ...fallback.sourceProvenance,
    ]).slice(0, 10)
    const provenanceRows = buildProvenanceRows(result)
    const sourceCoverage = buildSourceCoverage(provenanceRows, result.generatedAt)
    const techniqueCoverage = buildTechniqueCoverage(result, provenanceRows)
    const campaignTimeline = buildCampaignTimeline(result, provenanceRows)
    const indicators = unique([...(contract?.indicators ?? []), ...fallback.indicators]).slice(0, 12)
    const lastSeen = contract?.lastSeen || result.lastSeen || fallback.lastSeen

    return {
        actorClass: contract?.actorClass || fallback.actorClass,
        attribution: contract?.attribution || fallback.attribution,
        firstSeen: contract?.firstSeen || fallback.firstSeen,
        lastSeen,
        motivation: unique([...(contract?.motivation ?? []), ...fallback.motivation]).slice(0, 6),
        malwareTools: unique([...(contract?.malwareTools ?? []), ...fallback.malwareTools]).slice(0, 10),
        campaigns: unique([...(contract?.campaigns ?? []), ...fallback.campaigns]).slice(0, 10),
        campaignTimeline,
        infrastructure: unique([...(contract?.infrastructure ?? []), ...fallback.infrastructure]).slice(0, 10),
        indicators,
        techniqueCoverage,
        targetSectors: targetSectors.length ? targetSectors.slice(0, 12) : fallback.targetSectors,
        geographies: geographies.length ? geographies.slice(0, 12) : fallback.geographies,
        confidence: contract?.confidence ?? result.confidence ?? fallback.confidence,
        confidenceReasoning: unique([...(contract?.confidenceReasoning ?? []), ...fallback.confidenceReasoning]).slice(0, 8),
        sourceProvenance: sourceProvenance.length ? sourceProvenance : fallback.sourceProvenance,
        updateTimeline: contract?.updateTimeline ?? [],
        provenanceRows,
        sourceCoverage,
        freshness: freshnessFor(result.generatedAt, lastSeen),
    }
}

type TiActorIntelligenceFallback = Omit<TiActorIntelligenceProfile, 'provenanceRows' | 'sourceCoverage' | 'techniqueCoverage' | 'campaignTimeline' | 'freshness'>

function fallbackActorIntelligence(result: TiSearchResponse, victimObservations: VictimObservation[]): TiActorIntelligenceFallback {
    return {
        actorClass: hasActorEvidence(result, victimObservations) ? 'Named threat actor or activity cluster' : '',
        attribution: result.notes.find(note => /attribut/i.test(note)) || 'No attribution evidence',
        firstSeen: result.recentActivity.map(item => item.firstReportedAt || item.date).filter(Boolean).sort()[0] || 'No dated activity yet',
        lastSeen: result.lastSeen || 'Observation date unavailable',
        motivation: [],
        malwareTools: [],
        campaigns: result.recentActivity.filter(item => item.claimType === 'campaign').map(item => item.title).slice(0, 6),
        infrastructure: result.recentActivity.filter(item => item.claimType === 'infrastructure_activity').map(item => item.title).slice(0, 6),
        indicators: [],
        targetSectors: result.targets.map(target => target.sector).slice(0, 8),
        geographies: unique([...result.targets.flatMap(target => target.regions), ...victimObservations.map(item => item.country)]).slice(0, 8),
        confidence: result.confidence,
        confidenceReasoning: [
            result.sources.length ? `${result.sources.length} source records are attached to the profile.` : 'No source records yet.',
            result.recentActivity.length ? `${result.recentActivity.length} activity rows are available for review.` : 'No recent activity rows yet.',
            result.ttps.length ? `${result.ttps.length} tradecraft rows are mapped for analyst review.` : 'No tradecraft rows yet.',
        ],
        sourceProvenance: result.sources.map(source => source.url || source.provenance || source.name).slice(0, 8),
        updateTimeline: [],
    }
}

function hasActorEvidence(result: TiSearchResponse, victimObservations: VictimObservation[]) {
    const contract = result.actorIntelligence
    const contractHasDetails = Boolean(contract && (
        contract.actorClass || contract.attribution || contract.firstSeen || contract.lastSeen
        || contract.motivation?.length || contract.malwareTools?.length || contract.campaigns?.length
        || contract.infrastructure?.length || contract.indicators?.length || contract.targetSectors?.length
        || contract.geographies?.length || contract.attributionEvidence || contract.structuredProvenance?.length
        || hasBusinessModelEvidence(contract.businessModel) || contract.updateTimeline?.length
    ))
    return Boolean(
        contractHasDetails || result.actorIdentity?.catalogMatched || result.actorIdentity?.candidates.length
        || result.aliases.length || result.notes.length || result.sources.length || result.targets.length
        || result.ttps.length || result.recentActivity.length || victimObservations.length
    )
}

function hasBusinessModelEvidence(businessModel: NonNullable<NonNullable<TiSearchResponse['actorIntelligence']>['businessModel']> | undefined) {
    if (!businessModel) return false
    const evidenceLists = [
        businessModel.extortionModels,
        businessModel.advertisedProducts,
        businessModel.advertisedData,
        businessModel.pricingClaims,
        businessModel.negotiationClaims,
        businessModel.paymentClaims,
        businessModel.revenueClaims,
        businessModel.revenueShareClaims,
        businessModel.publicationStrategies,
        businessModel.publicityTactics,
        businessModel.publicityEvents,
        businessModel.pressureTactics,
        businessModel.communicationChannels,
        businessModel.buyerSellerCommunications,
        businessModel.intermediaryCommunications,
        businessModel.monetizationPaths,
        businessModel.profitabilitySignals,
        businessModel.pendingFindings,
    ]
    if (evidenceLists.some(items => items?.length)) return true
    const conclusion = businessModel.profitabilityConclusion
    return Boolean(conclusion && (
        conclusion.summary.trim() || conclusion.claimIds.length || conclusion.sourceIds.length || conclusion.captureIds.length
    ))
}
