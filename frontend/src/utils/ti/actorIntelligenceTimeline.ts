import type { TiSearchResponse } from './search'
import type { TiActorSourceProvenance, TiActorCampaignTimelineItem, TiActorIntelligenceProfile } from './actorIntelligenceTypes'
import { unique, parseSourceDate } from './actorIntelligenceValues'

export function buildCampaignTimeline(result: TiSearchResponse, provenanceRows: TiActorSourceProvenance[]): TiActorCampaignTimelineItem[] {
    const rows = result.recentActivity.map(item => {
        const firstReportedAt = item.firstReportedAt || item.date || ''
        const rowSourceIds = unique(item.sourceIds)
        const provenanceRefs = unique(provenanceRows.filter(row => row.sourceId && rowSourceIds.includes(row.sourceId)).map(row => row.provenance)).slice(0, 6)
        const affectedSectors = unique(item.affectedSectors ?? [])
        const countries = unique(item.countries ?? [])
        const missing = [
            rowSourceIds.length ? '' : 'sourceIds',
            provenanceRefs.length ? '' : 'provenanceRefs',
            Date.parse(firstReportedAt) || /\b(19|20)\d{2}\b/.test(firstReportedAt) ? '' : 'firstReportedAt',
        ].filter(Boolean)
        const freshness: TiActorCampaignTimelineItem['freshness'] = missing.length || item.confidence < 0.7 ? 'review' : 'ready'
        return { title: item.title, firstReportedAt, sourceIds: rowSourceIds, provenanceRefs, affectedSectors, countries, confidence: item.confidence, freshness, missing }
    })

    return rows.sort((a, b) => {
        const parsedA = parseSourceDate(a.firstReportedAt) ?? 0
        const parsedB = parseSourceDate(b.firstReportedAt) ?? 0
        return parsedB - parsedA || b.confidence - a.confidence
    }).slice(0, 10)
}

export function freshnessFor(generatedAt: string, lastSeen: string): TiActorIntelligenceProfile['freshness'] {
    const generated = Date.parse(generatedAt)
    const last = Date.parse(lastSeen)
    const stale = Number.isFinite(generated) && Number.isFinite(last) ? generated - last > 180 * 24 * 60 * 60 * 1000 : false
    return {
        generatedAt,
        lastSeen,
        stale,
        reason: stale ? `Last observed date is older than 180 days at ${generatedAt}.` : Number.isFinite(last) ? 'Last observed date is within freshness policy.' : 'No dated activity is available; freshness is unknown.',
    }
}
