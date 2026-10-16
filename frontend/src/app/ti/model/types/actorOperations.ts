import { type ActorArtifactKind } from '@/utils/ti/actorWorkbench'

export type ActorOperationsRow = {
    id: string
    type: 'Method' | 'Infrastructure' | 'Victim'
    label: string
    detail: string
    tactic?: string
    confidence: number
    freshness: 'ready' | 'review' | 'blocked'
    source: string
    sourceFamily: string
    timestamp: string
    artifactKind?: ActorArtifactKind
    artifactLookup?: string
    payload: Record<string, unknown>
}
