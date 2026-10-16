import { type AnalystWorkItem, type LocalRelevanceMark, type WatchlistRelevance } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'

export function isDateStale(value: string, generatedAt: string) {
    const freshness = Date.parse(value)
    const generated = Date.parse(generatedAt)
    if (!Number.isFinite(freshness) || !Number.isFinite(generated)) return false
    return generated - freshness > 180 * 24 * 60 * 60 * 1000
}

export function severityScore(severity: AnalystWorkItem['severity']) {
    if (severity === 'critical') return 95
    if (severity === 'high') return 80
    if (severity === 'medium') return 55
    return 25
}

export function relevanceMarkFor(
    state: LocalRelevanceMark['state'],
    selected: AnalystWorkItem,
    watchlist: WatchlistRelevance,
    actionability: TiActionabilityModel,
    note: string
): LocalRelevanceMark {
    const watchTerms = unique([
        ...watchlist.matchedTerms,
        ...watchlist.terms,
        ...actionability.watchlistRelevance.terms.map(term => `${term.kind}: ${term.value}`),
    ]).slice(0, 8)
    const sourceBlocked = actionability.readiness.blockers.some(blocker => blocker.ownerLane === 'source' || blocker.ownerLane === 'public-ti')
    const caseIntent: LocalRelevanceMark['caseIntent'] = state === 'not_relevant'
        ? 'no_case'
        : state === 'needs_source' || sourceBlocked
            ? 'source_review'
            : state === 'customer_relevant' && (selected.kind === 'exposure' || actionability.caseHandoff.ready || actionability.createAlertHandoff.ready)
                ? 'case_candidate'
                : 'watchlist_context'
    const defaultRationale = state === 'customer_relevant'
        ? 'Marked for customer relevance review from selected evidence and watchlist context.'
        : state === 'context_only'
            ? 'Marked as actor context for watchlist and detection enrichment.'
            : state === 'needs_source'
                ? 'Marked for source or capture enrichment before customer-facing action.'
                : 'Marked as not relevant for current watchlist or case work.'
    return {
        state,
        rationale: note.trim() || defaultRationale,
        watchTerms,
        caseIntent,
        markedAt: new Date().toISOString(),
    }
}

export function unique(values: string[]) {
    const seen = new Set<string>()
    return values.map(value => value.trim()).filter(value => {
        const key = value.toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
}

export function readStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(item => readStringArray(item))
    if (typeof value === 'string' && value.trim()) return [value.trim()]
    if (value && typeof value === 'object' && 'value' in value) return readStringArray((value as { value?: unknown }).value)
    return []
}

export function uniqueBy<T>(values: T[], keyFor: (value: T) => string) {
    const seen = new Set<string>()
    return values.filter(value => {
        const key = keyFor(value)
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
}

export function domainFromUrl(value?: string) {
    if (!value) return null
    try {
        return new URL(value).hostname.replace(/^www\./, '')
    } catch {
        return null
    }
}
