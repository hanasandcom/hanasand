import { type WatchlistRelevance } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { unique } from './evidenceValues'

export function watchlistTermRequestPayloadFor(term: string, watchlist: WatchlistRelevance, actionability: TiActionabilityModel, query: string) {
    const parsed = watchlistTermParts(term)
    const matchingTerms = actionability.watchlistRelevance.terms.filter(item =>
        item.value.toLowerCase() === parsed.value.toLowerCase()
        || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase()
    )
    const matchingIntersections = actionability.orgRelevance.watchlistIntersections.filter(item =>
        item.value.toLowerCase() === parsed.value.toLowerCase()
        || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase()
    )
    const sourceEvidenceRefs = unique(matchingIntersections.flatMap(item => item.sourceEvidenceRefs))
    const sourceHealthRows = actionability.sourceHealthQueue.rows.filter(row =>
        sourceEvidenceRefs.some(ref => row.provenance.includes(ref) || row.sourceName.includes(ref) || row.sourceId === ref)
        || actionability.orgRelevance.sourceCoverage.some(source =>
            source.sourceName === row.sourceName
            && (source.sourceFamily === row.sourceFamily || source.provenance === row.provenance)
        )
    )
    const sourceIntakeItems = actionability.sourceEnrichmentIntake.items.filter(item =>
        sourceHealthRows.some(row => row.id === item.sourceHealthRowId)
        || item.requestedFields.some(field => /sourceProvenance|captureId|sourceRequestId/i.test(field))
    )
    const watchlistAction = actionability.actionPayloads.payloads.watchlistAdd
    return {
        schemaVersion: 'ti.public_actor.watchlist_term_request.v1',
        source: 'public-ti',
        sessionLocal: true,
        query,
        kind: parsed.kind,
        value: parsed.value,
        route: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
        blocked: actionability.exportPayloads.watchlist.blocked,
        missing: actionability.exportPayloads.watchlist.missing,
        matched: matchingTerms.some(item => item.matched) || matchingIntersections.length > 0,
        matchedOrganizations: unique([
            ...watchlist.organizations,
            ...matchingIntersections.map(item => item.organizationId).filter((value): value is string => Boolean(value)),
        ]).slice(0, 12),
        watchlistItemIds: unique(matchingIntersections.map(item => item.watchlistItemId).filter((value): value is string => Boolean(value))),
        alertIds: unique(matchingIntersections.flatMap(item => item.alertIds)),
        casePaths: unique(matchingIntersections.flatMap(item => item.casePaths)),
        sourceEvidenceRefs,
        provenance: actionability.exportPayloads.watchlist.provenance,
        sourceIntake: {
            schemaVersion: 'ti.public_actor.watchlist_source_intake.v1',
            route: actionability.sourceEnrichmentIntake.route,
            candidateTerm: {
                kind: parsed.kind,
                value: parsed.value,
                matched: matchingTerms.some(item => item.matched) || matchingIntersections.length > 0,
            },
            actionReadiness: {
                ready: watchlistAction.ready,
                unavailable: watchlistAction.unavailable,
                route: watchlistAction.route,
                backedRoute: watchlistAction.backedRoute,
                blockedBy: watchlistAction.blockedBy,
            },
            sourceCoverage: actionability.orgRelevance.sourceCoverage.filter(source =>
                sourceEvidenceRefs.some(ref => source.provenance.includes(ref) || source.sourceName.includes(ref) || source.sourceId === ref)
            ),
            sourceHealthRows,
            enrichmentItems: sourceIntakeItems,
            requestedFields: unique(sourceIntakeItems.flatMap(item => item.requestedFields)),
        },
    }
}

export function watchlistTermParts(term: string): { kind: 'company' | 'domain' | 'vendor'; value: string } {
    const [kind, ...rest] = term.split(':')
    const value = rest.join(':').trim()
    if (value && (kind === 'company' || kind === 'domain' || kind === 'vendor')) return { kind, value }
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(term.trim())) return { kind: 'domain', value: term.trim() }
    return { kind: 'company', value: term.trim() }
}

export function watchlistWorkbenchRowId(kind: string, value: string) {
    return `watch:${kind}:${value}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-')
}
