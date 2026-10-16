import type { TiSearchResponse } from './search'
import type { TiActorSourceProvenance, TiActorSourceCoverage, TiActorTechniqueCoverage } from './actorIntelligenceTypes'
import { unique, uniqueBy, parseSourceDate } from './actorIntelligenceValues'

export function buildProvenanceRows(result: TiSearchResponse): TiActorSourceProvenance[] {
    const contractRows = result.actorIntelligence?.structuredProvenance ?? []
    const actionabilityRows = result.actionability?.sourceProvenance ?? []
    const sourceRows = result.sources.map(source => ({
        sourceId: source.id,
        sourceName: source.name,
        provenance: source.url || source.provenance || source.name,
        reportDate: source.reportDate,
        captureId: source.captureId,
        sourceFamily: source.sourceFamily,
        parserStatus: source.parserStatus,
        lastCollectedAt: source.lastCollectedAt,
        confidence: result.confidence,
        shownBecause: `Source record supporting ${result.query}.`,
    }))

    return uniqueBy([
        ...contractRows,
        ...actionabilityRows.map(source => ({
            sourceId: source.sourceId,
            sourceName: source.sourceName,
            provenance: source.provenance,
            reportDate: source.reportDate,
            captureId: source.captureId,
            sourceRequestId: source.sourceRequestId,
            sourceFamily: source.sourceFamily,
            parserStatus: source.parserStatus,
            lastCollectedAt: source.lastCollectedAt,
            confidence: source.confidence,
            shownBecause: 'Evidence used for watchlist, alert, or case delivery.',
        })),
        ...sourceRows,
    ].filter(row => row.sourceName && row.provenance), row => `${row.sourceId ?? row.sourceName}:${row.provenance}`).slice(0, 12)
}

export function buildSourceCoverage(rows: TiActorSourceProvenance[], generatedAt: string): TiActorSourceCoverage {
    const sourceIds = unique(rows.map(row => row.sourceId ?? '').filter(Boolean))
    const datedRows = rows.filter(row => parseSourceDate(row.reportDate) !== null)
    const captureRows = rows.filter(row => row.captureId).length
    const latestReportDate = datedRows.map(row => row.reportDate).filter((value): value is string => Boolean(value)).sort((a, b) => {
        const parsedA = parseSourceDate(a) ?? 0
        const parsedB = parseSourceDate(b) ?? 0
        return parsedB - parsedA
    })[0]
    const generated = Date.parse(generatedAt)
    const latest = latestReportDate ? parseSourceDate(latestReportDate) : null
    const families = rows.reduce((counts, row) => {
        const family = sourceFamilyFor(row)
        counts.set(family, (counts.get(family) ?? 0) + 1)
        return counts
    }, new Map<string, number>())
    const missing = [
        rows.length ? '' : 'actorIntelligence.structuredProvenance[]',
        sourceIds.length ? '' : 'actorIntelligence.structuredProvenance[].sourceId',
        datedRows.length ? '' : 'actorIntelligence.structuredProvenance[].reportDate',
        captureRows ? '' : 'sourceProvenance[].captureId',
    ].filter(Boolean)

    return {
        totalRows: rows.length,
        datedRows: datedRows.length,
        captureRows,
        sourceIds,
        sourceFamilies: Array.from(families.entries()).map(([family, count]) => ({ family, count })).sort((a, b) => b.count - a.count || a.family.localeCompare(b.family)),
        latestReportDate,
        stale: !latest || (Number.isFinite(generated) && generated - latest > 180 * 24 * 60 * 60 * 1000),
        missing,
    }
}

export function buildTechniqueCoverage(result: TiSearchResponse, provenanceRows: TiActorSourceProvenance[]): TiActorTechniqueCoverage[] {
    return result.ttps.map(item => {
        const sourceIds = unique(item.sourceIds ?? [])
        const supportingRows = provenanceRows.filter(row => row.sourceId && sourceIds.includes(row.sourceId))
        const captureIds = unique([...(item.captureIds ?? []), ...supportingRows.map(row => row.captureId).filter((value): value is string => Boolean(value))])
        const provenanceRefs = unique(supportingRows.map(row => row.provenance)).slice(0, 6)
        const missing = [sourceIds.length ? '' : 'sourceId', captureIds.length ? '' : 'captureId', item.attackId ? '' : 'attackId'].filter(Boolean)
        const freshness: TiActorTechniqueCoverage['freshness'] = missing.length || item.confidence < 0.75 ? 'review' : 'ready'
        return { attackId: item.attackId, name: item.name, tactic: item.tactic, detail: item.detail, confidence: item.confidence, sourceIds, captureIds, provenanceRefs, freshness, missing }
    }).slice(0, 10)
}

function sourceFamilyFor(row: TiActorSourceProvenance) {
    const value = `${row.sourceId ?? ''} ${row.sourceName} ${row.provenance}`.toLowerCase()
    if (row.sourceFamily) return row.sourceFamily
    if (row.captureId || row.sourceRequestId) return 'source_capture'
    if (/cisa|government|advisory|allied|cert|ncsc|fbi|nsa|svr/.test(value)) return 'government_advisory'
    if (/microsoft|google|mandiant|crowdstrike|proofpoint|sentinelone|palo alto|unit 42|recorded future|secureworks|hpe|solarwinds/.test(value)) return 'vendor_disclosure'
    if (/actor profile reference/.test(value)) return 'actor_profile'
    return 'public_ti'
}
