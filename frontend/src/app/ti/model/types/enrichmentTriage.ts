import { type SourceHealthRow } from './source'
import { type TiActionabilityModel } from '@/utils/ti/actionability'

export type SelectedEnrichmentTriage = {
    schemaVersion: 'ti.public_actor.selected_enrichment_triage.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    route: string
    state: 'ready' | 'review' | 'blocked'
    summary: {
        sourceRows: number
        intakeItems: number
        blockers: number
        sourceRequests: number
        captures: number
    }
    rows: Array<{
        id: string
        sourceName: string
        sourceFamily: SourceHealthRow['sourceFamily']
        state: SourceHealthRow['state']
        route: string
        ownerLane: SourceHealthRow['ownerLane']
        remediationPath: string
        lastChecked: string
        recommendedAction: string
        sourceId?: string
        sourceRequestId?: string
        captureId?: string
        requestedFields: string[]
        nextAction: string
        matchingIntakeItemIds: string[]
        blockers: string[]
        evidence: {
            provenance: string
            timestamp: string
            confidence?: number
            parserStatus?: string
        }
        consumerReadiness: Array<{
            consumer: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['consumer']
            state: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['state']
            ready: boolean
            route: string
            blockerCodes: string[]
            retryable: boolean
            nextRetryAt?: string
        }>
    }>
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}
