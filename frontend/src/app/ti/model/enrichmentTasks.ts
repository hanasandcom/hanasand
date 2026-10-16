import { type TiSearchResponse } from '@/utils/ti/search'
import { type AnalystWorkItem, type EnrichmentTask, type WatchlistRelevance } from './types'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { linkFromText, sourceRequestRouteLabel } from './sourceLinks'
import { formatLabel } from './reviewLabels'
import { sourceHealthFieldLabel } from './sourceLabels'

export function enrichmentTasksFor(result: TiSearchResponse, selected: AnalystWorkItem | undefined, watchlist: WatchlistRelevance, sources: TiSearchResponse['sources'], actor: TiActorIntelligenceProfile, actionability: TiActionabilityModel): EnrichmentTask[] {
    const hasReviewInbox = Boolean(result.analystLoop?.metadataReviewInbox.length)
    const hasSourceUrls = sources.some(source => source.url || linkFromText(source.provenance))
    const hasOrganizations = watchlist.organizations.length > 0
    const hasActivity = result.recentActivity.length > 0
    const hasActorCore = actor.malwareTools.length > 0 && actor.campaigns.length > 0 && actor.infrastructure.length > 0
    const actionabilityTasks: EnrichmentTask[] = actionability.enrichmentGapQueue.map(gap => ({
        title: gap.title,
        status: gap.severity === 'high' ? 'needs_api' : 'needs_review',
        detail: `${gap.detail} Source family: ${formatLabel(gap.sourceFamily)}. Needs: ${gap.requestedFields.map(sourceHealthFieldLabel).join(', ')}. Work queue: ${sourceRequestRouteLabel(gap.route)}.`,
        route: gap.route,
        sourceFamily: gap.sourceFamily,
        requestedFields: gap.requestedFields,
        ownerLane: gap.sourceFamily === 'alert' ? 'alert' : gap.sourceFamily === 'case' ? 'case' : gap.sourceFamily === 'watchlist' ? 'org' : 'source',
    }))
    return [
        ...actionabilityTasks,
        {
            title: 'Complete actor profile',
            status: hasActorCore ? 'ready' : 'needs_api',
            detail: hasActorCore
                ? `Actor profile includes ${actor.malwareTools.length} tools, ${actor.campaigns.length} campaigns, and ${actor.infrastructure.length} infrastructure patterns for alert context.`
                : 'Missing tooling, campaigns, infrastructure, source-basis notes, or source details from the actor profile.',
        },
        {
            title: 'Persist alert review decision',
            status: 'needs_api',
            detail: 'Scratch notes are session-local. Persisted review needs selected finding ID, review state, owner, rationale, and delivery hold/release state in the authenticated case action.',
        },
        {
            title: 'Attach source capture provenance',
            status: hasSourceUrls ? 'ready' : 'needs_api',
            detail: hasSourceUrls
                ? 'Available source references include URLs or linked references that can be opened or mapped into console evidence.'
                : 'The result needs source URLs, capture references, or redacted source hashes before analyst trust is strong.',
        },
        {
            title: 'Map actor to customer watchlists',
            status: hasOrganizations ? 'watch' : 'needs_api',
            detail: hasOrganizations
                ? `Candidate watched objects include ${watchlist.organizations.slice(0, 3).join(', ')}.`
                : 'Org and domain relevance appears after saved watchlist or organization matches.',
        },
        {
            title: 'Create case from evidence',
            status: hasReviewInbox ? 'ready' : selected?.kind === 'exposure' || hasActivity ? 'needs_review' : 'needs_api',
            detail: hasReviewInbox
                ? 'The response includes metadata review inbox items that can feed authenticated case work.'
                : 'No stable related case id is attached; this page can export a handoff payload but cannot persist the case from public context.',
        },
    ]
}
