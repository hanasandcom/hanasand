import { type TiSearchResponse } from '@/utils/ti/search'
import { type AnalystWorkItem, type CaseActionTrailPayload, type LocalRelevanceMark, type SelectedAlertActionPlan, type SelectedCaseCreateRequest, type SelectedCaseDraft, type SelectedCaseOwnershipPlan, type SelectedDeliveryReadinessPlan, type SelectedEnrichmentTriage, type SelectedReviewHandoff, type SelectedSourceDrilldown, type SelectedWatchlistPlan, type StagedHandoff } from './types'
import { selectedArtifactPayloadFor } from './artifactHandoff'
import { unique } from './evidenceValues'

export function stagedHandoffFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    selectedArtifact: ReturnType<typeof selectedArtifactPayloadFor>,
    reviewHandoff: SelectedReviewHandoff,
    sourceDrilldown: SelectedSourceDrilldown,
    caseDraft: SelectedCaseDraft,
    caseOwnership: SelectedCaseOwnershipPlan,
    caseCreateRequest: SelectedCaseCreateRequest,
    watchlistPlan: SelectedWatchlistPlan,
    alertPlan: SelectedAlertActionPlan,
    deliveryPlan: SelectedDeliveryReadinessPlan,
    enrichmentTriage: SelectedEnrichmentTriage,
    caseActionTrail: CaseActionTrailPayload,
    relevance: LocalRelevanceMark | undefined
): StagedHandoff {
    const blockers = unique([
        ...reviewHandoff.blockers,
        ...selectedArtifact.readiness.blockers,
        ...selectedArtifact.readiness.missing,
        ...sourceDrilldown.blockers,
        ...caseDraft.missing,
        ...caseOwnership.blockers,
        ...caseCreateRequest.blockers,
        ...caseCreateRequest.watchlistBasis.blockers,
        ...watchlistPlan.blockers,
        ...alertPlan.blockers.map(blocker => blocker.detail),
        ...deliveryPlan.blockers,
        ...enrichmentTriage.rows.flatMap(row => row.blockers),
        ...caseActionTrail.events.flatMap(event => event.blockers),
    ]).slice(0, 10)
    return {
        schemaVersion: 'ti.public_actor.staged_handoff.v1',
        source: 'public-ti',
        sessionLocal: true,
        id: `staged:${selected.id}:${Date.now()}`,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: selected.title,
        relevanceState: relevance?.state ?? 'not_marked',
        caseIntent: relevance?.caseIntent ?? caseDraft.caseIntent,
        ready: caseDraft.ready && caseCreateRequest.ready && watchlistPlan.ready && alertPlan.ready && deliveryPlan.state === 'ready' && enrichmentTriage.state !== 'blocked' && blockers.length === 0,
        blockers,
        selectedArtifact,
        reviewHandoff,
        sourceDrilldown,
        caseDraft,
        caseOwnership,
        caseCreateRequest,
        watchlistPlan,
        alertPlan,
        deliveryPlan,
        enrichmentTriage,
        caseActionTrail,
    }
}
