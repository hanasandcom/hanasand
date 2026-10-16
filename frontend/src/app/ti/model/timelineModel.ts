import { evidenceTimestamp, type TiSearchResponse } from '@/utils/ti/search'
import { type AnalystWorkItem, type SectionOverviewItem, type WatchlistRelevance } from './types'
import { humanResultStatus } from './sourceLabels'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { victimObservationsFor } from '@/utils/ti/actorProfile'
import { sourceBasisLabel } from './sourceMetrics'
import { domainFromUrl, unique } from './evidenceValues'
import { linkFromText } from './sourceLinks'
import { humanizeSlug } from '../../seo'

export function timelineFor(result: TiSearchResponse, selected?: AnalystWorkItem) {
    const events = [
        {
            id: 'generated',
            at: result.generatedAt,
            label: 'Profile generated',
            detail: `${humanResultStatus(result.status)} result from ${result.mode}${result.cacheStatus ? ` · cache ${result.cacheStatus}` : ''}.`,
        },
        ...(selected ? [{
            id: `selected-${selected.id}`,
            at: selected.timestamp,
            label: 'Selected evidence',
            detail: selected.subtitle,
        }] : []),
        ...result.recentActivity.slice(0, 4).map((item, index) => ({
            id: `activity-${index}`,
            at: evidenceTimestamp(item.firstReportedAt, item.date),
            label: item.title,
            detail: item.detail,
        })),
    ]
    return events
}

export function sectionOverviewFor(input: {
    result: TiSearchResponse
    actorIntel: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    workItems: AnalystWorkItem[]
    victimObservations: ReturnType<typeof victimObservationsFor>
    watchlist: WatchlistRelevance
}): SectionOverviewItem[] {
    const relatedRecords = input.actionability.relatedAlerts.length + input.actionability.relatedCases.length
    const caseCandidates = input.actionability.caseReviewIntake.summary.total
    const readyActions = Object.values(input.actionability.actionPayloads.payloads).filter(payload => payload.ready).length
    const sourceRows = input.actorIntel.provenanceRows.length || input.actionability.sourceProvenance.length || input.result.sources.length
    return [
        { label: 'Overview', value: sourceBasisLabel(input.actorIntel.confidence), state: input.actorIntel.provenanceRows.length ? 'ready' : 'blocked' },
        { label: 'Activity', value: `${input.workItems.length} item${input.workItems.length === 1 ? '' : 's'}`, state: input.workItems.length ? 'ready' : 'review' },
        { label: 'Targets', value: `${input.victimObservations.length || input.actorIntel.targetSectors.length} row${(input.victimObservations.length || input.actorIntel.targetSectors.length) === 1 ? '' : 's'}`, state: input.victimObservations.length || input.actorIntel.targetSectors.length ? 'ready' : 'review' },
        { label: 'Infrastructure', value: `${input.actorIntel.infrastructure.length} pattern${input.actorIntel.infrastructure.length === 1 ? '' : 's'}`, state: input.actorIntel.infrastructure.length ? 'ready' : 'review' },
        { label: 'Sources', value: `${sourceRows} source result${sourceRows === 1 ? '' : 's'}`, state: sourceRows ? 'ready' : 'blocked' },
        { label: 'Evidence', value: `${input.workItems.filter(item => item.evidence.length).length} supported`, state: input.workItems.some(item => item.evidence.length) ? 'ready' : 'blocked' },
        { label: 'Watchlist relevance', value: input.actionability.orgRelevance.organizationRefs.length ? `${input.actionability.orgRelevance.organizationRefs.length} matched` : `${input.actionability.orgRelevance.candidateTerms.length} candidate${input.actionability.orgRelevance.candidateTerms.length === 1 ? '' : 's'}`, state: input.actionability.orgRelevance.state },
        { label: 'Related alerts/cases', value: relatedRecords ? `${relatedRecords} linked` : `${caseCandidates} candidate${caseCandidates === 1 ? '' : 's'}`, state: relatedRecords ? 'ready' : caseCandidates ? 'review' : 'blocked' },
        { label: 'Source questions', value: `${input.actionability.enrichmentGapQueue.length} open`, state: input.actionability.enrichmentGapQueue.length ? 'review' : 'ready' },
        { label: 'Actions', value: `${readyActions}/5 available`, state: readyActions === 5 ? 'ready' : readyActions ? 'review' : 'blocked' },
    ]
}

export function watchlistRelevanceFor(result: TiSearchResponse, victimObservations: ReturnType<typeof victimObservationsFor>, sources: TiSearchResponse['sources'], actor: TiActorIntelligenceProfile, actionability: TiActionabilityModel): WatchlistRelevance {
    const organizations = unique([
        ...victimObservations.map(item => item.victim),
        ...result.recentActivity.map(item => item.victimName).filter((value): value is string => Boolean(value)),
        ...(result.analystLoop?.metadataReviewInbox.flatMap(item => [item.company, item.victim]).filter((value): value is string => Boolean(value)) ?? []),
    ]).slice(0, 10)
    const sectors = unique([
        ...victimObservations.map(item => item.sector),
        ...result.targets.map(item => item.sector),
        ...result.recentActivity.flatMap(item => item.affectedSectors ?? []),
    ].filter(value => !/not stated/i.test(value))).slice(0, 10)
    const countries = unique([
        ...victimObservations.map(item => item.country),
        ...result.targets.flatMap(item => item.regions),
        ...result.recentActivity.flatMap(item => item.countries ?? []),
    ].filter(value => !/not stated/i.test(value))).slice(0, 10)
    const domains = unique(sources.map(source => source.url || linkFromText(source.provenance)).map(domainFromUrl).filter((value): value is string => Boolean(value))).slice(0, 8)
    const terms = unique([
        result.query,
        humanizeSlug(result.query),
        ...result.aliases,
        ...organizations,
        ...sectors,
        ...actor.campaigns.slice(0, 4),
        ...actor.malwareTools.slice(0, 4),
    ].filter(Boolean)).slice(0, 14)
    const matchedTerms = actionability.watchlistRelevance.terms.filter(term => term.matched).map(term => `${term.kind}: ${term.value}`)

    return {
        terms,
        matchedTerms,
        organizations,
        sectors,
        countries,
        domains,
        rationale: matchedTerms.length
            ? `${matchedTerms.length} organization watchlist match${matchedTerms.length === 1 ? '' : 'es'} for this query.`
            : organizations.length
                ? 'Candidate watchlist inputs are present; save an organization watchlist match before alert review.'
                : 'Candidate actor, alias, sector, country, campaign, tool, and source-domain terms appear when present in the profile or source results.',
    }
}
