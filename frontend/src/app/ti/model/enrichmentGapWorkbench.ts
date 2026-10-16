import { type AnalystWorkItem, type EnrichmentGapWorkbenchRow, type EnrichmentTask } from './types'
import { type TiSearchResponse } from '@/utils/ti/search'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type ActorArtifact } from '@/utils/ti/actorWorkbench'
import { enrichmentEvidenceRef, matchingArtifactIdsForGap, matchingWorkItemsForGap } from './enrichmentGapReferences'
import { formatLabel, readinessOwnerLabel, taskStatusLabel } from './reviewLabels'
import { newestDate } from './watchlistWorkbench'
import { isDateStale, unique, uniqueBy } from './evidenceValues'
import { artifactStateFor, artifactStateLabel, artifactWorklistPayloadFor } from './artifactReadiness'
import { sourceCoverageStateRank } from './sourceCoverage'
import { uniqueNumbers } from './sourceMetrics'
import { displayRequirementText } from './requirementCopy'

const TI_ENRICHMENT_GAP_PREVIEW_ROWS = 2

export function enrichmentGapWorkbenchRowsFor({
    tasks,
    result,
    actor,
    actionability,
    workItems,
    artifacts,
}: {
    tasks: EnrichmentTask[]
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    workItems: AnalystWorkItem[]
    artifacts: ActorArtifact[]
}): EnrichmentGapWorkbenchRow[] {
    const rows: EnrichmentGapWorkbenchRow[] = []
    const observedActorDate = actor.sourceCoverage.latestReportDate || (typeof result.lastSeen === 'string' && Number.isFinite(Date.parse(result.lastSeen)) ? result.lastSeen : '')

    for (const task of tasks) {
        const evidenceItems = matchingWorkItemsForGap(workItems, task.title, task.detail)
        const artifactIds = matchingArtifactIdsForGap(artifacts, task.title, task.detail)
        rows.push(enrichmentGapRow({
            id: `task:${task.title}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            type: task.sourceFamily || task.ownerLane || task.status,
            label: task.title,
            entity: task.sourceFamily ? formatLabel(task.sourceFamily) : task.ownerLane ? readinessOwnerLabel(task.ownerLane) : taskStatusLabel(task.status),
            state: task.status === 'ready' ? 'ready' : task.status === 'needs_api' ? 'blocked' : 'review',
            newestAt: newestDate([...evidenceItems.map(item => item.timestamp), observedActorDate]),
            source: task.sourceFamily ? formatLabel(task.sourceFamily) : 'Analyst review',
            impact: task.detail,
            route: task.route,
            evidenceItems,
            artifactIds,
            missing: task.requestedFields ?? [],
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                task,
                evidenceRows: evidenceItems.map(enrichmentEvidenceRef),
                artifactIds,
            },
        }))
    }

    for (const row of actionability.sourceHealthQueue.rows.filter(item => item.state !== 'ready').slice(0, TI_ENRICHMENT_GAP_PREVIEW_ROWS)) {
        const evidenceItems = matchingWorkItemsForGap(workItems, row.sourceName, row.provenance)
        rows.push(enrichmentGapRow({
            id: `source-health:${row.id}`,
            type: row.sourceFamily,
            label: row.parserStatus,
            entity: row.sourceName,
            state: row.state,
            confidenceValues: [row.confidence].filter((value): value is number => typeof value === 'number'),
            newestAt: row.timestamp,
            source: row.sourceName,
            impact: row.nextAction,
            route: row.route,
            evidenceItems,
            artifactIds: matchingArtifactIdsForGap(artifacts, row.sourceName, row.provenance),
            missing: row.requestedFields,
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                sourceHealthRow: row,
                evidenceRows: evidenceItems.map(enrichmentEvidenceRef),
            },
        }))
    }

    for (const item of workItems.filter(item => item.confidence < 0.55 || !item.href || isDateStale(item.timestamp, result.generatedAt)).slice(0, TI_ENRICHMENT_GAP_PREVIEW_ROWS)) {
        const missing = [
            item.confidence < 0.55 ? 'confidence' : '',
            item.href ? '' : 'sourceProvenance[].provenance',
            isDateStale(item.timestamp, result.generatedAt) ? 'report date' : '',
        ].filter(Boolean)
        rows.push(enrichmentGapRow({
            id: `evidence:${item.id}`,
            type: item.kind,
            label: item.confidence < 0.55 ? 'Corroborate evidence' : !item.href ? 'Attach source link' : 'Refresh evidence date',
            entity: item.title,
            state: !item.href || item.confidence < 0.4 ? 'blocked' : 'review',
            confidenceValues: [item.confidence],
            newestAt: item.timestamp,
            source: item.source,
            impact: item.detail,
            route: item.href,
            evidenceItems: [item],
            artifactIds: matchingArtifactIdsForGap(artifacts, item.title, item.detail, item.evidence.join(' ')),
            missing,
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                evidenceRow: enrichmentEvidenceRef(item),
                missing,
            },
        }))
    }

    for (const artifact of artifacts.filter(item => item.readiness.blockers.length || item.enrichmentTasks.length).slice(0, TI_ENRICHMENT_GAP_PREVIEW_ROWS)) {
        const evidenceItems = matchingWorkItemsForGap(workItems, artifact.label, artifact.evidence.join(' '))
        rows.push(enrichmentGapRow({
            id: `artifact:${artifact.id}`,
            type: artifact.kind,
            label: artifact.enrichmentTasks[0] || artifactStateLabel(artifact),
            entity: artifact.label,
            state: artifactStateFor(artifact),
            confidenceValues: [artifact.confidence],
            newestAt: artifact.freshness,
            source: artifact.provenance[0] || 'Detail context',
            impact: artifact.subtitle,
            route: artifact.readiness.state === 'needs_source' ? '/ti/profiles' : undefined,
            evidenceItems,
            artifactIds: [artifact.id],
            missing: [...artifact.readiness.blockers, ...artifact.enrichmentTasks],
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                artifact: artifactWorklistPayloadFor(artifact),
                evidenceRows: evidenceItems.map(enrichmentEvidenceRef),
            },
        }))
    }

    if (actor.sourceCoverage.missing.length) {
        rows.push(enrichmentGapRow({
            id: 'actor-source-coverage',
            type: 'source coverage',
            label: 'Complete source coverage',
            entity: actor.actorClass,
            state: 'blocked',
            newestAt: actor.sourceCoverage.latestReportDate || actor.lastSeen,
            source: 'Actor profile',
            impact: actor.freshness.reason,
            route: '/ti/profiles',
            evidenceItems: workItems.slice(0, 3),
            artifactIds: artifacts.slice(0, 3).map(item => item.id),
            missing: actor.sourceCoverage.missing,
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                sourceCoverage: actor.sourceCoverage,
            },
        }))
    }

    return uniqueBy(rows, row => row.id)
        .sort((a, b) => sourceCoverageStateRank(a.state) - sourceCoverageStateRank(b.state)
            || Date.parse(b.newestAt || '') - Date.parse(a.newestAt || '')
            || b.evidenceItems.length - a.evidenceItems.length
            || a.label.localeCompare(b.label))
        .slice(0, 14)
}

export function enrichmentGapRow(input: Omit<EnrichmentGapWorkbenchRow, 'confidenceValues'> & { confidenceValues?: number[] }): EnrichmentGapWorkbenchRow {
    const confidenceValues = uniqueNumbers([...(input.confidenceValues ?? []), ...input.evidenceItems.map(item => item.confidence)])
    return {
        ...input,
        confidenceValues,
        missing: unique(input.missing.map(displayRequirementText)),
    }
}
