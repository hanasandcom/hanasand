import { type AnalystWorkItem } from './types'
import { unique } from './evidenceValues'
import { type ActorArtifact } from '@/utils/ti/actorWorkbench'
import { watchlistArtifactText } from './watchlistWorkbench'

export function matchingWorkItemsForGap(items: AnalystWorkItem[], ...values: string[]) {
    return matchingGapRecords(items, values, item => `${item.title} ${item.subtitle} ${item.detail} ${item.source} ${item.provenance} ${item.evidence.join(' ')}`)
}

export function matchingArtifactIdsForGap(artifacts: ActorArtifact[], ...values: string[]) {
    return matchingGapRecords(artifacts, values, watchlistArtifactText).map(item => item.id)
}

function matchingGapRecords<T>(items: T[], values: string[], textFor: (item: T) => string) {
    const tokens = unique(values.join(' ').split(/[^a-z0-9._-]+/i).filter(value => value.length > 3)).map(value => value.toLowerCase()).slice(0, 12)
    return items.filter(item => {
        const body = textFor(item).toLowerCase()
        return tokens.some(token => body.includes(token))
    }).slice(0, 5)
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
