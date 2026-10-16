import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type TiSearchResponse } from '@/utils/ti/search'
import { type AnalystWorkItem, type SourceCoverageWorkbenchRow } from './types'
import { sourceCoverageWorkbenchRow } from './sourceCoverageRows'
import { linkFromText } from './sourceLinks'
import { sourceRoleLabel } from './sourceLabels'
import { uniqueBy } from './evidenceValues'

export function sourceCoverageWorkbenchRowsFor({
    actor,
    actionability,
    sources,
    sourcePosture,
    workItems,
    sourceOptions,
}: {
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    sources: TiSearchResponse['sources']
    sourcePosture: NonNullable<TiSearchResponse['collectionStrategy']>['sourcePosture']
    workItems: AnalystWorkItem[]
    sourceOptions: string[]
}): SourceCoverageWorkbenchRow[] {
    const sourceById = new Map(sources.map(source => [source.id, source]))
    const rows: SourceCoverageWorkbenchRow[] = []

    for (const row of actionability.sourceHealthQueue.rows) {
        const source = row.sourceId ? sourceById.get(row.sourceId) : undefined
        rows.push(sourceCoverageWorkbenchRow({
            id: row.id,
            sourceName: row.sourceName,
            family: row.sourceFamily,
            provenance: row.provenance,
            href: source?.url || linkFromText(row.provenance),
            newestAt: row.timestamp,
            parserStatus: row.parserStatus,
            state: row.state,
            confidenceValues: [row.confidence].filter((value): value is number => typeof value === 'number'),
            captureId: row.captureId,
            sourceRequestId: row.sourceRequestId,
            sourceId: row.sourceId,
            missing: row.requestedFields,
            nextAction: row.nextAction,
            actor,
            workItems,
            sourceOptions,
            extraPayload: {
                sourceHealthRow: row,
            },
        }))
    }

    for (const row of actor.provenanceRows) {
        rows.push(sourceCoverageWorkbenchRow({
            id: `source-coverage:${row.sourceId ?? row.sourceName}:${row.provenance}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            sourceName: row.sourceName,
            family: row.sourceFamily || 'public_report',
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            newestAt: row.lastCollectedAt || row.reportDate,
            parserStatus: row.parserStatus || (row.captureId ? 'capture linked' : 'public reference'),
            state: row.captureId ? 'ready' : actor.sourceCoverage.stale ? 'review' : 'review',
            confidenceValues: [row.confidence].filter((value): value is number => typeof value === 'number'),
            captureId: row.captureId,
            sourceRequestId: row.sourceRequestId,
            sourceId: row.sourceId,
            missing: [
                row.captureId ? '' : 'sourceProvenance[].captureId',
                row.reportDate || row.lastCollectedAt ? '' : 'actorIntelligence.structuredProvenance[].reportDate',
            ].filter(Boolean),
            nextAction: row.shownBecause,
            actor,
            workItems,
            sourceOptions,
            extraPayload: {
                provenanceRow: row,
            },
        }))
    }

    for (const source of sources) {
        const href = source.url || linkFromText(source.provenance)
        rows.push(sourceCoverageWorkbenchRow({
            id: `source-link:${source.id}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            sourceName: source.name,
            family: source.type,
            provenance: source.url || source.provenance || source.name,
            href,
            newestAt: actor.sourceCoverage.latestReportDate || actor.lastSeen,
            parserStatus: href ? 'source link attached' : 'source reference only',
            state: href ? (actor.sourceCoverage.stale ? 'review' : 'ready') : 'review',
            confidenceValues: [],
            sourceId: source.id,
            missing: source.url || source.provenance ? [] : ['sourceProvenance[].provenance'],
            nextAction: href ? 'Open source and attach a matching evidence row before case work.' : 'Attach source URL or source reference before review.',
            actor,
            workItems,
            sourceOptions,
            extraPayload: {
                sourceRecord: source,
            },
        }))
    }

    if (!rows.length) {
        for (const posture of sourcePosture.filter(source => source.role !== 'rejected_paid_rows').slice(0, 4)) {
            rows.push(sourceCoverageWorkbenchRow({
                id: `source-posture:${posture.source}:${posture.role}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
                sourceName: posture.source,
                family: posture.role,
                provenance: posture.source,
                newestAt: actor.sourceCoverage.latestReportDate || actor.lastSeen,
                parserStatus: sourceRoleLabel(posture.role),
                state: 'review',
                confidenceValues: [],
                missing: actor.sourceCoverage.missing,
                nextAction: posture.summary,
                actor,
                workItems,
                sourceOptions,
                extraPayload: {
                    sourcePosture: posture,
                },
            }))
        }
    }

    return uniqueBy(rows, row => row.sourceId ? `id:${row.sourceId}` : `${row.sourceName}:${row.provenance}`)
        .sort((a, b) => sourceCoverageStateRank(a.state) - sourceCoverageStateRank(b.state)
            || Date.parse(b.newestAt || '') - Date.parse(a.newestAt || '')
            || b.evidenceItems.length - a.evidenceItems.length
            || a.sourceName.localeCompare(b.sourceName))
        .slice(0, 12)
}

export function sourceCoverageStateRank(state: SourceCoverageWorkbenchRow['state']) {
    if (state === 'blocked') return 0
    if (state === 'review') return 1
    return 2
}
