import { type LocalRelevanceMark, type SelectedReviewHandoff } from './core'
import { type CaseActionTrailPayload } from './caseTrail'
import { type SelectedAlertActionPlan } from './alertPlan'
import { type SelectedCaseCreateRequest } from './caseRequest'
import { type SelectedCaseDraft } from './caseDraft'
import { type SelectedCaseOwnershipPlan } from './caseOwnership'
import { type SelectedDeliveryReadinessPlan } from './delivery'
import { type SelectedEnrichmentTriage } from './enrichmentTriage'
import { type SelectedSourceDrilldown } from './source'
import { type SelectedWatchlistPlan } from './watchlistPlan'
import type { selectedArtifactPayloadFor } from '../artifactHandoff'
import type { SelectedPublicActorContext } from './publicActorContext'

export type StagedHandoff = SelectedPublicActorContext & {
    schemaVersion: 'ti.public_actor.staged_handoff.v1'
    id: string
    relevanceState: LocalRelevanceMark['state'] | 'not_marked'
    caseIntent: LocalRelevanceMark['caseIntent'] | 'not_set'
    ready: boolean
    blockers: string[]
    selectedArtifact: ReturnType<typeof selectedArtifactPayloadFor>
    reviewHandoff: SelectedReviewHandoff
    sourceDrilldown: SelectedSourceDrilldown
    caseDraft: SelectedCaseDraft
    caseOwnership: SelectedCaseOwnershipPlan
    caseCreateRequest: SelectedCaseCreateRequest
    watchlistPlan: SelectedWatchlistPlan
    alertPlan: SelectedAlertActionPlan
    deliveryPlan: SelectedDeliveryReadinessPlan
    enrichmentTriage: SelectedEnrichmentTriage
    caseActionTrail: CaseActionTrailPayload
}
