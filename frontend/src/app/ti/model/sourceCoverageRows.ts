import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { type AnalystWorkItem, type SourceCoverageWorkbenchRow } from './types'
import { uniqueNumbers } from './sourceMetrics'
import { unique } from './evidenceValues'
import { displayRequirementText } from './requirementCopy'
import { formatLabel } from './reviewLabels'

export function sourceCoverageWorkbenchRow(input: {
    id: string
    sourceName: string
    family: string
    provenance: string
    href?: string
    newestAt?: string
    parserStatus: string
    state: 'ready' | 'review' | 'blocked'
    confidenceValues: number[]
    captureId?: string
    sourceRequestId?: string
    sourceId?: string
    missing: string[]
    nextAction: string
    actor: TiActorIntelligenceProfile
    workItems: AnalystWorkItem[]
    sourceOptions: string[]
    extraPayload: Record<string, unknown>
}): SourceCoverageWorkbenchRow {
    const evidenceItems = workItemsForSource(input.workItems, input.sourceName, input.provenance, input.sourceId)
    const confidenceValues = uniqueNumbers([...input.confidenceValues, ...evidenceItems.map(item => item.confidence)])
    const artifactTypes = sourceArtifactTypesFor(input.actor, input.sourceName, input.provenance, input.sourceId, evidenceItems)
    const queueFilter = input.sourceOptions.find(option => option.toLowerCase() === input.sourceName.toLowerCase())
        ?? input.sourceOptions.find(option => evidenceItems.some(item => item.source === option))
    const missing = unique(input.missing.map(displayRequirementText))
    const payload = {
        schemaVersion: 'ti.public_actor.source_coverage_workbench.v1',
        source: 'public-ti',
        sourceName: input.sourceName,
        sourceId: input.sourceId,
        sourceFamily: input.family,
        provenance: input.provenance,
        href: input.href,
        newestAt: input.newestAt,
        parserStatus: displayRequirementText(input.parserStatus),
        state: input.state,
        confidenceValues,
        artifactTypes,
        captureId: input.captureId,
        sourceRequestId: input.sourceRequestId,
        missing,
        evidenceRows: evidenceItems.map(item => ({
            id: item.id,
            kind: item.kind,
            title: item.title,
            timestamp: item.timestamp,
            confidence: item.confidence,
            provenance: item.provenance,
        })),
        nextAction: displayRequirementText(input.nextAction),
        ...input.extraPayload,
    }
    return {
        id: input.id,
        sourceName: input.sourceName,
        family: input.family,
        provenance: input.provenance,
        href: input.href,
        newestAt: input.newestAt,
        parserStatus: input.parserStatus,
        state: input.state,
        confidenceValues,
        artifactTypes,
        evidenceItems,
        captureId: input.captureId,
        sourceRequestId: input.sourceRequestId,
        sourceId: input.sourceId,
        missing,
        nextAction: input.nextAction,
        queueFilter,
        payload,
    }
}

export function workItemsForSource(items: AnalystWorkItem[], sourceName: string, provenance: string, sourceId?: string) {
    const tokens = unique([sourceName, provenance, sourceId ?? ''])
        .map(token => token.toLowerCase())
        .filter(token => token.length > 2)
    return items.filter(item => {
        const body = `${item.source} ${item.provenance} ${item.evidence.join(' ')}`.toLowerCase()
        return tokens.some(token => body.includes(token))
    }).slice(0, 6)
}

export function sourceArtifactTypesFor(actor: TiActorIntelligenceProfile, sourceName: string, provenance: string, sourceId: string | undefined, evidenceItems: AnalystWorkItem[]) {
    const tokens = unique([sourceName, provenance, sourceId ?? '']).map(token => token.toLowerCase()).filter(token => token.length > 2)
    const types = [
        actor.techniqueCoverage.some(item => item.sourceIds.some(id => sourceId && id === sourceId) || item.provenanceRefs.some(ref => tokens.some(token => ref.toLowerCase().includes(token)))) ? 'Method' : '',
        actor.campaignTimeline.some(item => item.sourceIds.some(id => sourceId && id === sourceId) || item.provenanceRefs.some(ref => tokens.some(token => ref.toLowerCase().includes(token)))) ? 'Campaign' : '',
        ...evidenceItems.map(item => formatLabel(item.kind)),
    ]
    return unique(types.filter(Boolean)).slice(0, 5)
}
