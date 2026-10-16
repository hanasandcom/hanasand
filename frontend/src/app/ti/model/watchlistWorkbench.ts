import { type AlertPacket, type AnalystWorkItem, type WatchlistRelevance, type WatchlistWorkbenchRow } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type ActorArtifact } from '@/utils/ti/actorWorkbench'
import { unique } from './evidenceValues'
import { watchlistTermParts, watchlistTermRequestPayloadFor, watchlistWorkbenchRowId } from './watchlistPayloads'
import { sourceBasisLabel, uniqueNumbers } from './sourceMetrics'
import { displayRequirementText } from './requirementCopy'
import { watchlistIntersectionActionLabel } from './sourceLabels'
import { sourceCoverageStateRank } from './sourceCoverage'
import { type TiSearchResponse } from '@/utils/ti/search'

export function watchlistWorkbenchRowsFor({
    watchlist,
    actionability,
    query,
    workItems,
    artifacts,
}: {
    watchlist: WatchlistRelevance
    actionability: TiActionabilityModel
    query: string
    workItems: AnalystWorkItem[]
    artifacts: ActorArtifact[]
}): WatchlistWorkbenchRow[] {
    const seenTermIds = new Set<string>()
    const terms = unique([
        ...watchlist.terms,
        ...watchlist.matchedTerms,
        ...actionability.watchlistRelevance.terms.map(term => `${term.kind}: ${term.value}`),
        ...actionability.orgRelevance.candidateTerms.map(term => `${term.kind}: ${term.value}`),
        ...actionability.orgRelevance.watchlistIntersections.map(term => `${term.kind}: ${term.value}`),
    ]).filter(term => {
        const parsed = watchlistTermParts(term)
        const id = watchlistWorkbenchRowId(parsed.kind, parsed.value)
        if (seenTermIds.has(id)) return false
        seenTermIds.add(id)
        return true
    }).slice(0, 16)
    return terms.map(term => {
        const parsed = watchlistTermParts(term)
        const valueKey = parsed.value.toLowerCase()
        const matchingTerms = actionability.watchlistRelevance.terms.filter(item => item.value.toLowerCase() === valueKey || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase())
        const candidateTerms = actionability.orgRelevance.candidateTerms.filter(item => item.value.toLowerCase() === valueKey || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase())
        const intersections = actionability.orgRelevance.watchlistIntersections.filter(item => item.value.toLowerCase() === valueKey || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase())
        const sourceRefs = unique([...candidateTerms.flatMap(item => item.sourceEvidenceRefs), ...intersections.flatMap(item => item.sourceEvidenceRefs)])
        const sourceEvidence = actionability.orgRelevance.sourceEvidence.filter(source =>
            source.supportsTerms.some(supported => supported.toLowerCase() === valueKey || supported.toLowerCase().includes(valueKey))
            || sourceRefs.some(ref => source.sourceId === ref || source.sourceName.includes(ref) || source.provenance.includes(ref))
        )
        const evidenceItems = workItems.filter(item => watchlistRowText(item).includes(valueKey)).slice(0, 8)
        const artifactMatches = artifacts.filter(artifact => watchlistArtifactText(artifact).includes(valueKey))
        const confidenceValues = uniqueNumbers([
            ...evidenceItems.map(item => item.confidence),
            ...artifactMatches.map(item => item.confidence),
            ...sourceEvidence.map(item => item.confidence).filter((value): value is number => typeof value === 'number'),
        ])
        const newestAt = newestDate([
            ...evidenceItems.map(item => item.timestamp),
            ...sourceEvidence.map(item => item.lastCollectedAt || item.reportDate || ''),
            actionability.orgRelevance.freshness.lastSeen,
        ])
        const matched = intersections.length > 0 || matchingTerms.some(item => item.matched) || candidateTerms.some(item => item.matched) || watchlist.matchedTerms.some(item => item.toLowerCase() === term.toLowerCase())
        const blockers = unique([
            ...actionability.watchlistRelevance.blockers,
            ...actionability.exportPayloads.watchlist.missing,
            ...intersections.flatMap(item => item.blockers.map(blocker => blocker.handoff)),
        ].map(displayRequirementText)).slice(0, 6)
        const state: WatchlistWorkbenchRow['state'] = matched ? 'ready' : actionability.exportPayloads.watchlist.blocked || blockers.length ? 'blocked' : 'review'
        const route = intersections[0]?.route || actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route || '/findings'
        const casePath = intersections.flatMap(item => [item.casePath, ...item.casePaths]).find((value): value is string => Boolean(value))
        const intersectionDetail = intersections[0] ? `${watchlistIntersectionActionLabel(intersections[0].recommendedAction)} for ${parsed.value}.` : ''
        const payload = {
            ...watchlistTermRequestPayloadFor(term, watchlist, actionability, query),
            schemaVersion: 'ti.public_actor.watchlist_workbench_row.v1',
            selectedEvidenceRows: evidenceItems.map(item => ({
                id: item.id,
                title: item.title,
                source: item.source,
                timestamp: item.timestamp,
                confidence: item.confidence,
                provenance: item.provenance,
            })),
            selectedArtifacts: artifactMatches.map(artifact => ({
                id: artifact.id,
                kind: artifact.kind,
                label: artifact.label,
                confidence: artifact.confidence,
                freshness: artifact.freshness,
            })),
            sourceEvidence,
            intersections,
            state,
            casePath,
        }
        return {
            id: watchlistWorkbenchRowId(parsed.kind, parsed.value),
            kind: parsed.kind,
            value: parsed.value,
            matched,
            state,
            confidenceValues,
            newestAt,
            evidenceItems,
            artifactIds: artifactMatches.map(item => item.id),
            sourceCount: unique([...sourceEvidence.map(item => item.sourceName), ...evidenceItems.map(item => item.source)]).length,
            route,
            casePath,
            detail: candidateTerms[0]?.notes || matchingTerms[0]?.notes || intersectionDetail || watchlist.rationale,
            blockers,
            payload,
        }
    }).sort((a, b) => Number(b.matched) - Number(a.matched)
        || sourceCoverageStateRank(a.state) - sourceCoverageStateRank(b.state)
        || Date.parse(b.newestAt || '') - Date.parse(a.newestAt || '')
        || b.evidenceItems.length - a.evidenceItems.length
        || a.value.localeCompare(b.value))
}

export function watchlistRowText(item: AnalystWorkItem) {
    return `${item.title} ${item.subtitle} ${item.detail} ${item.source} ${item.provenance} ${item.evidence.join(' ')}`.toLowerCase()
}

export function watchlistArtifactText(artifact: ActorArtifact) {
    return `${artifact.label} ${artifact.subtitle} ${artifact.evidence.join(' ')} ${artifact.provenance.join(' ')} ${artifact.watchlistTerms.map(term => `${term.kind} ${term.value} ${term.notes}`).join(' ')}`.toLowerCase()
}

export function newestDate(values: string[]) {
    return values
        .filter(Boolean)
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0]
}

export function alertPacketFor(result: TiSearchResponse, selected: AnalystWorkItem, watchlist: WatchlistRelevance): AlertPacket {
    const isCustomerAlert = selected.kind === 'exposure' || Boolean(watchlist.organizations.some(org => selected.title.toLowerCase().includes(org.toLowerCase())))
    const evidenceBasis = unique([
        `${selected.source}; ${selected.provenance}`,
        `Timestamp: ${selected.timestamp}`,
        `Evidence strength: ${sourceBasisLabel(selected.confidence)}`,
        ...selected.evidence.slice(0, 3).map(displayRequirementText),
    ])
    const blockedUntil = [
        selected.href ? '' : 'A source URL or internal capture reference is attached.',
        isCustomerAlert ? '' : 'A watched company, domain, vendor, or portfolio term matches this finding.',
        selected.confidence >= 0.7 ? '' : 'Corroborating evidence is added.',
    ].filter(Boolean)

    return {
        title: isCustomerAlert ? `Candidate customer alert: ${displayRequirementText(selected.title)}` : `Actor context brief: ${displayRequirementText(selected.title)}`,
        customerValue: isCustomerAlert
            ? 'This finding has enough structure to enter alert review: named object, evidence basis, timestamp, source reference, and routing guidance.'
            : 'This finding strengthens watchlist and detection context, but should not become a customer alert until it matches a watched organization, domain, vendor, or portfolio term.',
        watchTerms: watchlist.terms.slice(0, 8),
        evidenceBasis,
        routing: selected.kind === 'tradecraft'
            ? 'Send to detection and hunting enrichment before customer notification.'
            : selected.kind === 'victim' && !isCustomerAlert
                ? 'Send to actor-profile enrichment and watchlist expansion.'
                : 'Send to alert review, source verification, and customer delivery only after the console saves it.',
        blockedUntil,
    }
}
