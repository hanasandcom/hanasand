import type { TiActionabilityContract } from '../search'
import type { PublicTiOrgRelevanceProof, PublicTiOrgWatchlistIntersection, PublicTiOrgSourceFamily } from './types/organizationRelevance'
import type { PublicTiReadinessBlocker } from './types/actionability'
import { sourceRefsForTerm, sourceFamilyForEvidence } from './organizationEvidence'
import { uniqueStrings, uniqueBy } from './geography'
import type { TiActorIntelligenceProfile } from '../actorIntelligence'

export function buildWatchlistIntersections(input: {
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    candidateTerms: PublicTiOrgRelevanceProof['candidateTerms']
    sourceEvidence: PublicTiOrgRelevanceProof['sourceEvidence']
    alertCaseRefs: PublicTiOrgRelevanceProof['alertCaseRefs']
    blockers: PublicTiReadinessBlocker[]
}): PublicTiOrgWatchlistIntersection[] {
    const terms = input.candidateTerms.length
        ? input.candidateTerms
        : input.matches.map(match => ({
            kind: match.kind,
            value: match.value,
            notes: '',
            matched: true,
            sourceEvidenceRefs: sourceRefsForTerm(match.value, input.sourceEvidence),
        }))
    const alertCaseIds = uniqueStrings(input.alertCaseRefs.flatMap(ref => [ref.caseIdCandidate]))
    const casePaths = uniqueStrings(input.alertCaseRefs.flatMap(ref => [ref.casePath]))
    const alertIds = uniqueStrings(input.alertCaseRefs.map(ref => ref.alertId))
    const captureIds = uniqueStrings(input.alertCaseRefs.flatMap(ref => ref.captureIds))
    const webhookDestinationIds = uniqueStrings(input.alertCaseRefs.flatMap(ref => ref.webhookDestinationIds))

    return uniqueBy(terms.map(term => {
        const matches = input.matches.filter(match => match.kind === term.kind && match.value.toLowerCase() === term.value.toLowerCase())
        const match = matches[0]
        const refs = uniqueStrings([
            ...term.sourceEvidenceRefs,
            ...matches.flatMap(item => [item.watchlistId, item.watchlistItemId, item.route, item.casePath]),
        ])
        const sourceFamilies = uniqueStrings(input.sourceEvidence
            .filter(source => refs.some(ref => ref === source.sourceId || ref === source.captureId || ref === source.provenance) || source.supportsTerms.some(value => value.toLowerCase() === term.value.toLowerCase()))
            .map(source => sourceFamilyForEvidence(source)))
        const blockers = intersectionBlockers({ term, match, refs, captureIds, alertIds, inputBlockers: input.blockers })
        const hasWatchlist = Boolean(match?.organizationId && match.watchlistId && match.watchlistItemId)
        const state: PublicTiOrgWatchlistIntersection['state'] = blockers.some(blocker => blocker.code === 'missing_org' || blocker.code === 'missing_org_watchlist' || blocker.code === 'missing_source_provenance')
            ? 'blocked'
            : hasWatchlist && alertIds.length && casePaths.length ? 'ready' : 'review'
        return {
            intersectionId: `intersection:${term.kind}:${term.value.toLowerCase()}`,
            kind: term.kind,
            value: term.value,
            state,
            tenantId: match?.tenantId,
            organizationId: match?.organizationId,
            watchlistId: match?.watchlistId,
            watchlistItemId: match?.watchlistItemId,
            route: match?.casePath ?? match?.route ?? '/v1/dwm/watchlists',
            casePath: match?.casePath ?? casePaths[0],
            sourceEvidenceRefs: refs,
            sourceFamilies: sourceFamilies as PublicTiOrgSourceFamily[],
            alertIds,
            caseIds: alertCaseIds,
            casePaths,
            captureIds,
            webhookDestinationIds,
            recommendedAction: recommendedIntersectionAction({ hasWatchlist, alertIds, casePaths, captureIds, refs }),
            blockers,
        }
    }), item => item.intersectionId).slice(0, 24)
}

export function intersectionBlockers(input: {
    term: PublicTiOrgRelevanceProof['candidateTerms'][number]
    match?: NonNullable<TiActionabilityContract['watchlistMatches']>[number]
    refs: string[]
    captureIds: string[]
    alertIds: string[]
    inputBlockers: PublicTiReadinessBlocker[]
}) {
    const needed = new Set<PublicTiReadinessBlocker['code']>()
    if (!input.match?.organizationId) needed.add('missing_org')
    if (!input.match?.watchlistId || !input.match?.watchlistItemId) needed.add('missing_org_watchlist')
    if (!input.refs.length) needed.add('missing_source_provenance')
    if (!input.captureIds.length) needed.add('missing_capture')
    if (!input.alertIds.length && input.match?.watchlistItemId) needed.add('missing_alert')
    if (!input.term.matched && !input.match) needed.add('missing_org_watchlist')
    return input.inputBlockers.filter(blocker => needed.has(blocker.code))
}

export function recommendedIntersectionAction(input: {
    hasWatchlist: boolean
    alertIds: string[]
    casePaths: string[]
    captureIds: string[]
    refs: string[]
}): PublicTiOrgWatchlistIntersection['recommendedAction'] {
    if (!input.refs.length || !input.captureIds.length) return 'attach_source_evidence'
    if (!input.hasWatchlist) return 'persist_watchlist_item'
    if (!input.alertIds.length) return 'rebuild_alerts'
    if (input.casePaths.length) return 'open_case'
    return 'open_watchlist_item'
}

export function sourceSupportsTerm(source: NonNullable<TiActionabilityContract['sourceProvenance']>[number], term: Record<string, unknown>) {
    const haystack = `${source.sourceId ?? ''} ${source.sourceName} ${source.provenance}`.toLowerCase()
    const value = typeof term.value === 'string' ? term.value.toLowerCase() : ''
    return Boolean(value && haystack.includes(value.toLowerCase()))
}

export function actorEvidenceForSource(actor: TiActorIntelligenceProfile, source: NonNullable<TiActionabilityContract['sourceProvenance']>[number]) {
    const sourceKey = `${source.sourceId ?? ''}:${source.captureId ?? ''}:${source.provenance}`.toLowerCase()
    return actor.provenanceRows.find(row => {
        const rowKey = `${row.sourceId ?? ''}:${row.captureId ?? ''}:${row.provenance}`.toLowerCase()
        return Boolean(
            rowKey === sourceKey
            || (source.captureId && row.captureId === source.captureId)
            || (source.sourceId && row.sourceId === source.sourceId)
            || row.provenance === source.provenance
        )
    })
}
