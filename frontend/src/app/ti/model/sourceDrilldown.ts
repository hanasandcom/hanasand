import { type TiSearchResponse } from '@/utils/ti/search'
import { type AnalystWorkItem, type SelectedSourceDrilldown, type SelectedSourceDrilldownRow } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { linkFromText } from './sourceLinks'
import { unique, uniqueBy } from './evidenceValues'
import { displayRequirementText } from './requirementCopy'

export function selectedSourceDrilldownFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    actor: TiActorIntelligenceProfile
): SelectedSourceDrilldown {
    const sourceById = new Map(result.sources.map(source => [source.id, source]))
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedSources = selectedSourceIds
        .map(sourceId => sourceById.get(sourceId))
        .filter((source): source is TiSearchResponse['sources'][number] => Boolean(source))
    const actorRows = actor.provenanceRows.filter(row =>
        selectedSourceIds.includes(row.sourceId ?? '')
        || selected.source.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.provenance.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.evidence.some(line => line.toLowerCase().includes(row.sourceName.toLowerCase()))
    )
    const sourceRows = actionability.sourceProvenance.filter(row =>
        selectedSourceIds.includes(row.sourceId ?? '')
        || selected.source.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.evidence.some(line => line.toLowerCase().includes(row.sourceName.toLowerCase()))
    )
    const clusterRows = actionability.sourceClusters.filter(row =>
        selected.provenance.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.evidence.some(line => line.toLowerCase().includes(row.sourceName.toLowerCase()))
    )
    const fallbackCaptureRows = [...actorRows, ...sourceRows, ...clusterRows].some(row => row.captureId)
        ? []
        : actionability.sourceProvenance.filter(row => row.captureId).slice(0, 2)
    const candidates: SelectedSourceDrilldownRow[] = [
        ...selectedSources.map(source => drilldownRow({
            sourceId: source.id,
            sourceName: source.name,
            provenance: source.url || source.provenance || selected.provenance,
            href: source.url || linkFromText(source.provenance),
            captureId: source.captureId,
            reportDate: source.reportDate,
            confidence: selected.confidence,
            handoff: 'Open the listed source and attach capture evidence before case replay if no capture reference is present.',
        })),
        ...actorRows.map(row => drilldownRow({
            sourceId: row.sourceId,
            sourceName: row.sourceName,
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            captureId: row.captureId,
            reportDate: row.reportDate,
            confidence: row.confidence,
            handoff: row.shownBecause,
        })),
        ...sourceRows.map(row => drilldownRow({
            sourceId: row.sourceId,
            sourceName: row.sourceName,
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            captureId: row.captureId,
            confidence: row.confidence,
            handoff: row.captureId ? 'Use linked capture reference as replayable case evidence.' : `Attach capture reference or source hash for ${row.sourceName} before case replay.`,
        })),
        ...clusterRows.map(row => drilldownRow({
            sourceName: row.sourceName,
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            captureId: row.captureId,
            confidence: row.confidence,
            handoff: row.enrichmentTask,
        })),
        ...fallbackCaptureRows.map(row => drilldownRow({
            sourceId: row.sourceId,
            sourceName: row.sourceName,
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            captureId: row.captureId,
            confidence: row.confidence,
            handoff: 'Use linked capture reference as replayable case evidence.',
        })),
    ]
    if (!candidates.length) {
        candidates.push(drilldownRow({
            sourceName: selected.source || 'Source collection',
            provenance: selected.href || selected.provenance || selected.source,
            href: selected.href,
            confidence: selected.confidence,
            handoff: 'Attach source reference, source URL, capture reference, or source hash before this result can support stronger follow-up.',
        }))
    }
    const rows = uniqueBy(candidates, row => `${row.sourceId ?? row.sourceName}:${row.provenance}:${row.captureId ?? ''}`)
        .sort((a, b) => Number(Boolean(b.captureId)) - Number(Boolean(a.captureId)))
        .slice(0, 6)
    const blockers = unique([
        ...rows.flatMap(row => row.missing),
        ...actionability.readiness.blockers
            .filter(blocker => blocker.ownerLane === 'source' || blocker.ownerLane === 'public-ti')
            .map(blocker => blocker.handoff),
    ]).slice(0, 6)

    return {
        schemaVersion: 'ti.public_actor.selected_source_drilldown.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: result.generatedAt,
        selectedItem: {
            id: selected.id,
            kind: selected.kind,
            title: displayRequirementText(selected.title),
            timestamp: selected.timestamp,
            source: selected.source,
            provenance: selected.provenance,
            confidence: selected.confidence,
            href: selected.href,
        },
        rows,
        alertHandoff: {
            ready: actionability.createAlertHandoff.ready,
            endpoint: actionability.createAlertHandoff.endpoint,
            route: actionability.createAlertHandoff.backedRoute,
            missing: actionability.createAlertHandoff.missing,
        },
        caseHandoff: {
            ready: actionability.caseHandoff.ready,
            endpoint: actionability.caseHandoff.endpoint,
            route: actionability.caseHandoff.backedRoute,
            missing: actionability.caseHandoff.missing,
        },
        blockers,
    }
}

export function drilldownRow(input: {
    sourceId?: string
    sourceName: string
    provenance: string
    href?: string
    captureId?: string
    reportDate?: string
    confidence?: number
    handoff: string
}): SelectedSourceDrilldownRow {
    const hasSource = Boolean(input.sourceId || input.provenance || input.href)
    const state: SelectedSourceDrilldownRow['state'] = input.captureId ? 'ready' : hasSource ? 'needs_capture' : 'needs_source'
    const missing = [
        hasSource ? '' : 'Source ID or source URL is required.',
        input.captureId ? '' : 'Capture ID or source hash is required before replayable case evidence.',
    ].filter(Boolean)
    const provenance = input.provenance || input.href || input.sourceName
    return {
        rowId: `source-drilldown:${input.sourceId ?? input.sourceName}:${provenance}:${input.captureId ?? 'missing-capture'}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
        sourceName: input.sourceName,
        sourceId: input.sourceId,
        provenance,
        href: input.href,
        captureId: input.captureId,
        reportDate: input.reportDate,
        confidence: input.confidence,
        state,
        ownerLane: state === 'ready' ? 'case' : state === 'needs_capture' ? 'source' : 'public-ti',
        route: state === 'ready' ? '/v1/cases' : '/ti/profiles',
        missing,
        handoff: input.handoff,
    }
}
