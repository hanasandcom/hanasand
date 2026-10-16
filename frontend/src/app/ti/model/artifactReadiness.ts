import { type ActorArtifact } from '@/utils/ti/actorWorkbench'
import { type AnalystWorkItem } from './types'

export function artifactStateFor(artifact: ActorArtifact): 'ready' | 'review' | 'blocked' {
    if (artifact.readiness.state === 'ready_for_org_handoff') return 'ready'
    if (artifact.readiness.state === 'needs_source' || artifact.readiness.state === 'needs_watchlist_term') return 'blocked'
    return 'review'
}

export function artifactStateLabel(artifact: ActorArtifact) {
    if (artifact.readiness.state === 'ready_for_org_handoff') return 'ready'
    if (artifact.readiness.state === 'needs_source') return 'source question'
    if (artifact.readiness.state === 'needs_watchlist_term') return 'watch gap'
    if (artifact.readiness.state === 'stale') return 'stale'
    return 'review'
}

export function artifactWorklistPayloadFor(artifact: ActorArtifact) {
    return {
        schemaVersion: 'ti.public_actor.artifact_worklist.v1',
        source: 'public-ti',
        artifact: {
            id: artifact.id,
            kind: artifact.kind,
            label: artifact.label,
            subtitle: artifact.subtitle,
            confidence: artifact.confidence,
            freshness: artifact.freshness,
        },
        evidence: artifact.evidence,
        provenance: artifact.provenance,
        watchlistTerms: artifact.watchlistTerms,
        enrichmentTasks: artifact.enrichmentTasks,
        state: artifactStateLabel(artifact),
        blockers: artifact.readiness.blockers,
    }
}

export function sourceCountsFor(items: AnalystWorkItem[]) {
    const counts = new Map<string, number>()
    for (const item of items) {
        const source = item.source || 'Unspecified source'
        counts.set(source, (counts.get(source) ?? 0) + 1)
    }
    return Array.from(counts, ([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
}
