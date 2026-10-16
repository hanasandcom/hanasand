import { type AlertPacket, type AnalystWorkItem, type LocalDecision, type SelectedCaseDraft, type SelectedTriageBrief, type WatchlistRelevance } from './types'
import { severityScore } from './evidenceValues'
import { type TiSearchResponse } from '@/utils/ti/search'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { sourceBasisLabel } from './sourceMetrics'
import { displayRequirementText } from './requirementCopy'
import { formatLabel } from './reviewLabels'

export function queueCountsFor(items: AnalystWorkItem[], decisions: Record<string, LocalDecision>) {
    return items.reduce((counts, item) => {
        const decision = decisions[item.id]
        if (decision?.status === 'closed' || decision?.status === 'suppressed') counts.closed += 1
        else counts.open += 1
        if (item.severity === 'critical' || item.severity === 'high') counts.high += 1
        return counts
    }, { open: 0, high: 0, closed: 0 })
}

export function filteredAnalystWorkItems(
    items: AnalystWorkItem[],
    filters: {
        kind: AnalystWorkItem['kind'] | 'all'
        source: string
        confidence: 'all' | 'high' | 'medium'
        sort: 'priority' | 'confidence' | 'freshness'
    }
) {
    const minConfidence = filters.confidence === 'high' ? 0.7 : filters.confidence === 'medium' ? 0.5 : 0
    return items
        .filter(item => filters.kind === 'all' || item.kind === filters.kind)
        .filter(item => filters.source === 'all' || item.source === filters.source)
        .filter(item => item.confidence >= minConfidence)
        .slice()
        .sort((a, b) => {
            if (filters.sort === 'confidence') return b.confidence - a.confidence
            if (filters.sort === 'freshness') return Date.parse(b.timestamp || '') - Date.parse(a.timestamp || '')
            return (b.priority?.score ?? severityScore(b.severity)) - (a.priority?.score ?? severityScore(a.severity))
        })
}

export function selectedTriageBriefFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    watchlist: WatchlistRelevance,
    alertPacket: AlertPacket | null,
    caseDraft: SelectedCaseDraft | null
): SelectedTriageBrief {
    const sourceBasis = sourceBasisLabel(selected.confidence)
    const visibleTerm = watchlist.matchedTerms[0] || watchlist.terms[0] || result.query
    const sourceLabel = selected.source || 'listed source'
    const hasSourceReference = Boolean(selected.href || selected.provenance || selected.priority?.sourceIds.length || caseDraft?.sourceRows.length)
    const hasCapture = Boolean(selected.priority?.captureIds.length || caseDraft?.sourceRows.some(row => row.captureId))
    const evidenceTone: SelectedTriageBrief['evidenceTone'] = hasCapture ? 'ready' : hasSourceReference ? 'review' : 'blocked'
    const blocker = actionability.readiness.blockers.find(item => item.ownerLane === 'source' || item.ownerLane === 'public-ti')
    const firstAction = selected.nextActions.map(displayRequirementText).find(Boolean)
    const alertValue = alertPacket?.customerValue ? displayRequirementText(alertPacket.customerValue) : ''
    const whatHappened = selected.kind === 'exposure' || selected.kind === 'victim'
        ? `${visibleTerm} is present in ${sourceLabel} reporting: ${displayRequirementText(selected.title)}.`
        : selected.kind === 'tradecraft'
            ? `${result.query} has a mapped technique or behavior from ${sourceLabel}: ${displayRequirementText(selected.title)}.`
            : `${sourceLabel} provides current context for ${result.query}: ${displayRequirementText(selected.title)}.`
    const whyItMatters = alertValue
        || (selected.severity === 'critical' || selected.severity === 'high'
            ? `${formatLabel(selected.severity)} priority with ${sourceBasis.toLowerCase()} evidence; review it before customer notification or case routing.`
            : `${sourceBasis} evidence that may support watchlist tuning, source review, or enrichment.`)
    const nextAction = caseDraft?.ready
        ? 'Stage this item as a case candidate with the attached watch terms and source results.'
        : blocker
            ? `Verify source coverage first: ${displayRequirementText(blocker.detail)}`
            : firstAction || 'Review the source, confirm customer relevance, then mark it for watchlist or case follow-up.'

    return {
        whatHappened,
        whyItMatters,
        nextAction,
        evidenceStatus: hasCapture
            ? 'Backed by captured source evidence with attached references.'
            : hasSourceReference
                ? 'Source reference is present, but the public result does not yet include a capture reference. Verify before customer-facing escalation.'
                : 'Verify source evidence before customer-facing escalation.',
        evidenceTone,
        safetyBoundary: 'Public TI results show source-safe summaries. This view does not expose source files, credential values, or webhook secrets.',
        labels: [
            { label: 'Severity', value: formatLabel(selected.severity) },
            { label: 'Evidence strength', value: sourceBasis },
            { label: 'Watch term', value: visibleTerm },
            { label: 'Freshness', value: selected.timestamp },
        ],
    }
}
