import type { TiActionabilityModel } from './actionability'
import type { TiActorIntelligenceProfile } from './actorIntelligence'
import { formatIsoDate } from '../date/formatIsoDate'
import type { TiSearchResponse } from './search'
import type { ActorArtifact, ActorArtifactKind, ActorArtifactReadiness } from './actorWorkbenchTypes'
import { uniqueTrimmedStrings as unique } from './stringValues'

export { unique }

export function recordFromActorList(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    kind: Exclude<ActorArtifactKind, 'country' | 'technique'>
    label: string
    subtitle: string
    evidence: string[]
    watchlistKind: 'company' | 'domain' | 'vendor'
    enrichmentTask: string
}): ActorArtifact {
    const provenance = recordSourceDetails(input.actor, input.actionability)
    const matchedWatchTerms = input.actionability.watchlist.payloads.filter(payload => payload.value.toLowerCase() === input.label.toLowerCase())
    return withReadiness({
        result: input.result,
        artifact: {
            id: recordId(input.kind, input.label),
            kind: input.kind,
            label: input.label,
            subtitle: input.subtitle,
            confidence: input.actor.confidence,
            freshness: observedFreshnessFor(input.result, input.actor),
            evidence: unique(input.evidence.length ? input.evidence : [`${input.label} is present in the actor intelligence profile.`]),
            provenance,
            watchlistTerms: matchedWatchTerms.length ? matchedWatchTerms : [{
                kind: input.watchlistKind,
                value: input.label,
                notes: `${input.result.query}: ${input.subtitle}`,
            }],
            enrichmentTasks: [input.enrichmentTask],
        },
    })
}

export function observedFreshnessFor(result: TiSearchResponse, actor: TiActorIntelligenceProfile) {
    const candidate = actor.sourceCoverage.latestReportDate || result.lastSeen
    return candidate && Number.isFinite(Date.parse(candidate)) ? candidate : ''
}

export function withReadiness(input: { result: TiSearchResponse; artifact: Omit<ActorArtifact, 'readiness'> }): ActorArtifact {
    const blockers = [
        ...(!input.artifact.provenance.length ? ['sourceProvenance[] for the selected record'] : []),
        ...(!input.artifact.evidence.length ? ['artifact evidence text'] : []),
        ...(isStale(input.artifact.freshness, input.result.generatedAt) ? [`fresh source after ${formatDate(input.artifact.freshness)}`] : []),
        ...(!input.artifact.watchlistTerms.length && input.artifact.kind !== 'technique' ? ['customer watchlist term'] : []),
    ]
    const state = !input.artifact.provenance.length || !input.artifact.evidence.length
        ? 'needs_source'
        : isStale(input.artifact.freshness, input.result.generatedAt)
            ? 'stale'
            : !input.artifact.watchlistTerms.length
                ? input.artifact.kind === 'technique' ? 'context_only' : 'needs_watchlist_term'
                : 'ready_for_org_handoff'
    return {
        ...input.artifact,
        readiness: {
            state,
            label: statusLabel(state),
            blockers,
        },
    }
}

function statusLabel(state: ActorArtifactReadiness['state']) {
    if (state === 'ready_for_org_handoff') return 'Ready for org handoff'
    if (state === 'needs_source') return 'Needs source'
    if (state === 'stale') return 'Stale evidence'
    if (state === 'needs_watchlist_term') return 'Needs watchlist term'
    return 'Context only'
}

function isStale(value: string, generatedAt: string) {
    const freshness = Date.parse(value)
    const generated = Date.parse(generatedAt)
    if (!Number.isFinite(freshness) || !Number.isFinite(generated)) return false
    return generated - freshness > 180 * 24 * 60 * 60 * 1000
}

export function recordSourceDetails(actor: TiActorIntelligenceProfile, actionability: TiActionabilityModel) {
    return unique([
        ...actionability.sourceProvenance.map(source => source.provenance),
        ...actor.sourceProvenance,
    ]).slice(0, 8)
}

export function matchingActivity(result: TiSearchResponse, value: string) {
    const tokens = value.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 3)
    if (!tokens.length) return []
    return result.recentActivity
        .filter(item => tokens.some(token => `${item.title} ${item.detail} ${item.impact ?? ''}`.toLowerCase().includes(token)))
        .map(item => `${item.firstReportedAt || item.date}: ${item.title}; ${item.detail}`)
        .slice(0, 4)
}

export const formatDate = (value: string) => formatIsoDate(value)

export function matchingTechnique(result: TiSearchResponse, value: string) {
    const lower = value.toLowerCase()
    return result.ttps
        .filter(item => `${item.name} ${item.detail}`.toLowerCase().includes(lower))
        .map(item => `${item.attackId || item.name}: ${item.tactic}; ${item.detail}`)
        .slice(0, 3)
}

export function recordId(kind: ActorArtifactKind, value: string) {
    return `${kind}:${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown'}`
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
