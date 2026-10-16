import { type AnalystWorkItem } from './types'
import { unique } from './evidenceValues'
import { type ActorArtifact } from '@/utils/ti/actorWorkbench'
import { watchlistArtifactText } from './watchlistWorkbench'

export function matchingWorkItemsForGap(items: AnalystWorkItem[], ...values: string[]) {
    const tokens = unique(values.join(' ').split(/[^a-z0-9._-]+/i).filter(value => value.length > 3)).map(value => value.toLowerCase()).slice(0, 12)
    if (!tokens.length) return []
    return items.filter(item => {
        const body = `${item.title} ${item.subtitle} ${item.detail} ${item.source} ${item.provenance} ${item.evidence.join(' ')}`.toLowerCase()
        return tokens.some(token => body.includes(token))
    }).slice(0, 5)
}

export function matchingArtifactIdsForGap(artifacts: ActorArtifact[], ...values: string[]) {
    const tokens = unique(values.join(' ').split(/[^a-z0-9._-]+/i).filter(value => value.length > 3)).map(value => value.toLowerCase()).slice(0, 12)
    if (!tokens.length) return []
    return artifacts.filter(artifact => {
        const body = watchlistArtifactText(artifact)
        return tokens.some(token => body.includes(token))
    }).map(item => item.id).slice(0, 5)
}

export function enrichmentEvidenceRef(item: AnalystWorkItem) {
    return {
        id: item.id,
        kind: item.kind,
        title: item.title,
        source: item.source,
        timestamp: item.timestamp,
        confidence: item.confidence,
        provenance: item.provenance,
    }
}
