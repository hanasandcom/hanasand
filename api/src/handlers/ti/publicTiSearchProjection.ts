import { searchThreatIntel, type TiSearchResponse } from '#utils/ti/search.ts'
import { sanitizeCustomerOutboundText } from '../../utils/dwm/customerOutputSafety.ts'
import { boolean, compact, confidence, finiteNumber, httpUrl, iso, nonNegativeInteger, publicIndicators, records, strings, text } from './publicTiProjections.ts'

function publicSearchResult(result: TiSearchResponse) {
    const actorIntelligence = result.actorIntelligence
    const actionability = result.actionability
    return sanitizePublicSearchValue(compact({
        query: result.query,
        queryKind: result.queryKind,
        generatedAt: result.generatedAt,
        mode: result.mode,
        cacheStatus: result.cacheStatus,
        status: result.status,
        runId: result.runId,
        refreshAfterSeconds: finiteNumber(result.refreshAfterSeconds),
        summary: result.summary,
        confidence: confidence(result.confidence),
        lastSeen: result.lastSeen,
        aliases: strings(result.aliases),
        recentActivity: records(result.recentActivity).map(row => {
            return compact({
                date: text(row.date), title: text(row.title), detail: text(row.detail), confidence: confidence(row.confidence), sourceIds: strings(row.sourceIds),
                url: httpUrl(row.url), claimType: text(row.claimType), victimName: text(row.victimName), affectedSectors: strings(row.affectedSectors), countries: strings(row.countries),
                impact: text(row.impact), firstReportedAt: iso(row.firstReportedAt), lastReportedAt: iso(row.lastReportedAt), publisherCount: nonNegativeInteger(row.publisherCount),
                corroboratingSourceIds: strings(row.corroboratingSourceIds), contradictingSourceIds: strings(row.contradictingSourceIds), assertionKind: text(row.assertionKind), reviewState: text(row.reviewState), corroborationState: text(row.corroborationState), observationSummary: text(row.observationSummary),
            })
        }),
        targets: records(result.targets).map(row => compact({ sector: text(row.sector), regions: strings(row.regions), rationale: text(row.rationale), confidence: confidence(row.confidence) })),
        ttps: records(result.ttps).map(row => compact({ name: text(row.name), attackId: text(row.attackId), tactic: text(row.tactic), detail: text(row.detail), confidence: confidence(row.confidence), extractionMethod: text(row.extractionMethod)?.slice(0, 120), extractorVersion: text(row.extractorVersion)?.slice(0, 120) })),
        datasets: records(result.datasets).map(row => compact({ name: text(row.name), type: text(row.type), coverage: text(row.coverage), status: text(row.status), url: httpUrl(row.url) })),
        sources: records(result.sources).map(row => compact({ id: text(row.id), name: text(row.name), type: text(row.type), provenance: text(row.provenance), url: httpUrl(row.url), captureId: text(row.captureId), sourceRequestId: text(row.sourceRequestId), sourceFamily: text(row.sourceFamily), parserStatus: text(row.parserStatus), reportDate: iso(row.reportDate), lastCollectedAt: iso(row.lastCollectedAt) })),
        notes: strings(result.notes),
        actorIntelligence: actorIntelligence ? compact({
            actorClass: text(actorIntelligence.actorClass), attribution: text(actorIntelligence.attribution), firstSeen: iso(actorIntelligence.firstSeen), lastSeen: iso(actorIntelligence.lastSeen),
            motivation: strings(actorIntelligence.motivation), malwareTools: strings(actorIntelligence.malwareTools), campaigns: strings(actorIntelligence.campaigns), infrastructure: publicIndicators(actorIntelligence.infrastructure),
            targetSectors: strings(actorIntelligence.targetSectors), geographies: strings(actorIntelligence.geographies), confidence: confidence(actorIntelligence.confidence), confidenceReasoning: strings(actorIntelligence.confidenceReasoning), sourceProvenance: strings(actorIntelligence.sourceProvenance),
        }) : undefined,
        actionability: actionability ? compact({
            schemaVersion: actionability.schemaVersion, alertDisposition: actionability.alertDisposition, shouldAlert: boolean(actionability.shouldAlert), rationale: text(actionability.rationale),
            watchlistCandidates: records(actionability.watchlistCandidates).map(row => compact({ kind: text(row.kind), value: text(row.value), reason: text(row.reason), confidence: confidence(row.confidence) })),
        }) : undefined,
    })) as ReturnType<typeof compact>
}

export async function executePublicSearch(searchImpl: typeof searchThreatIntel, query: string) {
    try {
        const result = await searchImpl({ query, preflightHealth: true })
        if (result.status === 'unavailable' || result.mode === 'unavailable') return { status: 'unavailable' as const }
        return { status: 'ok' as const, value: publicSearchResult(result) }
    } catch {
        return { status: 'unavailable' as const }
    }
}

function sanitizePublicSearchValue(value: unknown): unknown {
    if (typeof value === 'string') return sanitizeCustomerOutboundText(value)
    if (Array.isArray(value)) return value.map(sanitizePublicSearchValue)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizePublicSearchValue(item)]))
}
