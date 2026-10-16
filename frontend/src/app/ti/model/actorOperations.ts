import { type TiSearchResponse } from '@/utils/ti/search'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { victimObservationsFor } from '@/utils/ti/actorProfile'
import { type ActorOperationsRow } from './types'
import { formatLabel, sourceReferenceCountLabel } from './reviewLabels'
import { isDateStale } from './evidenceValues'

export function actorOperationsRowsFor(result: TiSearchResponse, actor: TiActorIntelligenceProfile, victimObservations: ReturnType<typeof victimObservationsFor>): ActorOperationsRow[] {
    const latestDate = actor.sourceCoverage.latestReportDate || actor.lastSeen || result.lastSeen || ''
    const defaultSource = actor.provenanceRows[0]?.sourceName || result.sources[0]?.name || 'Public source'
    const defaultFamily = actor.sourceCoverage.sourceFamilies[0]?.family ? formatLabel(actor.sourceCoverage.sourceFamilies[0].family) : 'Source coverage'
    const techniqueRows: ActorOperationsRow[] = actor.techniqueCoverage.map(item => ({
        id: `ttp:${item.attackId || item.name}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
        type: 'Method',
        label: item.attackId ? `${item.attackId} ${item.name}` : item.name,
        detail: item.detail,
        tactic: item.tactic,
        confidence: item.confidence,
        freshness: item.freshness,
        source: item.sourceIds[0] ? 'Source reference linked' : defaultSource,
        sourceFamily: item.captureIds.length ? 'Source linked' : item.missing.length ? 'Sources syncing' : defaultFamily,
        timestamp: latestDate,
        artifactKind: 'technique',
        artifactLookup: item.attackId ? `${item.attackId} ${item.name}` : item.name,
        payload: {
            schemaVersion: 'ti.public_actor.operations_row.v1',
            rowType: 'technique',
            query: result.query,
            attackId: item.attackId,
            name: item.name,
            tactic: item.tactic,
            confidence: item.confidence,
            freshness: item.freshness,
            sourceIds: item.sourceIds,
            captureIds: item.captureIds,
            provenanceRefs: item.provenanceRefs,
            missing: item.missing,
        },
    }))
    const infrastructureRows: ActorOperationsRow[] = actor.infrastructure.map((item, index) => ({
        id: `infra:${item}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
        type: 'Infrastructure',
        label: item,
        detail: actor.confidenceReasoning[index % Math.max(1, actor.confidenceReasoning.length)] || 'Infrastructure pattern available for source collection and alert enrichment.',
        confidence: Math.max(0.35, actor.confidence - 0.05),
        freshness: actor.freshness.stale ? 'review' : 'ready',
        source: defaultSource,
        sourceFamily: defaultFamily,
        timestamp: latestDate,
        artifactKind: 'infrastructure',
        artifactLookup: item,
        payload: {
            schemaVersion: 'ti.public_actor.operations_row.v1',
            rowType: 'infrastructure',
            query: result.query,
            value: item,
            confidence: actor.confidence,
            freshness: actor.freshness,
            sourceCoverage: actor.sourceCoverage,
            provenanceRows: actor.provenanceRows.slice(0, 4),
        },
    }))
    const victimRows: ActorOperationsRow[] = victimObservations.map(item => ({
        id: `victim:${item.victim}:${item.country}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
        type: 'Victim',
        label: item.victim,
        detail: `${item.sector}. ${item.incident}`,
        confidence: item.confidence,
        freshness: item.reportDate ? (isDateStale(item.reportDate, result.generatedAt) ? 'review' : 'ready') : 'blocked',
        source: item.source,
        sourceFamily: sourceReferenceCountLabel(item.sourceIds, 'Victim observation'),
        timestamp: item.reportDate || item.timeframe || latestDate,
        artifactKind: 'country',
        artifactLookup: item.country,
        payload: {
            schemaVersion: 'ti.public_actor.operations_row.v1',
            rowType: 'victim',
            query: result.query,
            victim: item.victim,
            sector: item.sector,
            country: item.country,
            timeframe: item.timeframe,
            incident: item.incident,
            confidence: item.confidence,
            source: item.source,
            reportDate: item.reportDate,
            sourceIds: item.sourceIds,
            provenanceRefs: item.provenanceRefs,
        },
    }))
    return [...techniqueRows, ...infrastructureRows, ...victimRows]
        .sort((a, b) => b.confidence - a.confidence || Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''))
        .slice(0, 16)
}
