import type { CaseActionTrailEvent, CaseReviewIntakeItem, SelectedCaseOwnershipPlan, StagedHandoff } from './pageModel'
import { unique } from './pageModel'

export function caseReviewCandidatePayloadFor(row: CaseReviewIntakeItem, query: string) {
    return {
        schemaVersion: 'ti.public_actor.case_review_candidate.v1',
        query,
        candidateId: row.id,
        evidenceRowId: row.evidenceRowId,
        title: row.title,
        score: row.score,
        priority: row.priority,
        state: row.state,
        route: row.route,
        alertIds: row.alertIds,
        casePaths: row.casePaths,
        captureIds: row.captureIds,
        sourceIds: row.sourceIds,
        watchlistTerms: row.watchlistTerms,
        reasons: row.reasons,
        blockers: row.blockedBy,
        recommendedAction: row.recommendedAction,
        nextAction: row.nextAction,
    }
}
export function caseReviewReferenceSummary(item: SelectedCaseOwnershipPlan['caseReviewItems'][number]) {
    const parts = [
        item.alertIds.length ? `${item.alertIds.length} alert${item.alertIds.length === 1 ? '' : 's'} linked` : 'alert link pending',
        item.casePaths.length ? `${item.casePaths.length} case route${item.casePaths.length === 1 ? '' : 's'} linked` : '',
        item.captureIds.length ? `${item.captureIds.length} capture${item.captureIds.length === 1 ? '' : 's'} linked` : '',
    ].filter(Boolean)
    return parts.join(' · ')
}
export function eventProvenanceSummary(provenance: CaseActionTrailEvent['provenance']) {
    const parts = [
        provenance.sourceIds.length ? `${provenance.sourceIds.length} source${provenance.sourceIds.length === 1 ? '' : 's'} linked` : 'source link pending',
        provenance.captureIds.length ? `${provenance.captureIds.length} capture${provenance.captureIds.length === 1 ? '' : 's'} linked` : '',
        provenance.alertIds.length ? `${provenance.alertIds.length} alert${provenance.alertIds.length === 1 ? '' : 's'} linked` : '',
    ].filter(Boolean)
    return parts.join(' · ')
}
export function stagedReadinessChips(item: StagedHandoff) {
    const sourceMissing = unique(item.sourceDrilldown.rows.flatMap(row => row.missing))
    const actorReady = item.caseCreateRequest.actorContext.sourceCoverage.totalRows > 0 && item.caseCreateRequest.actorContext.techniques.length > 0
    const artifactReady = !item.selectedArtifact.readiness.blockers.length && !item.selectedArtifact.readiness.missing.length
    const replayReady = item.caseCreateRequest.actionReplay.rows.some(row => row.ready)
    const ownershipReady = item.caseOwnership.state === 'ready' && item.caseOwnership.blockers.length === 0
    const alertReady = item.alertPlan.ready && item.alertPlan.blockers.length === 0
    const deliveryReady = item.deliveryPlan.state === 'ready' && item.deliveryPlan.blockers.length === 0
    const enrichmentReady = item.enrichmentTriage.state !== 'blocked' && item.enrichmentTriage.summary.blockers === 0
    const trailReady = item.caseActionTrail.summary.replayable && item.caseActionTrail.summary.blocked === 0
    const lowerLevelFollowUps = [
        actorReady ? 0 : 1,
        artifactReady ? 0 : item.selectedArtifact.readiness.blockers.length || item.selectedArtifact.readiness.missing.length || 1,
        item.caseCreateRequest.watchlistBasis.ready ? 0 : item.caseCreateRequest.watchlistBasis.blockers.length || 1,
        enrichmentReady ? 0 : item.enrichmentTriage.summary.blockers || 1,
        replayReady ? 0 : 1,
    ].reduce((total, count) => total + count, 0)
    return [
        { label: 'review', value: item.reviewHandoff.blockers.length ? `${item.reviewHandoff.blockers.length} follow-up${item.reviewHandoff.blockers.length === 1 ? '' : 's'}` : 'ready', ready: item.reviewHandoff.blockers.length === 0 },
        { label: 'source', value: sourceMissing.length ? `${sourceMissing.length} missing` : `${item.sourceDrilldown.rows.length} result${item.sourceDrilldown.rows.length === 1 ? '' : 's'}`, ready: sourceMissing.length === 0 },
        { label: 'case', value: item.caseDraft.missing.length ? `${item.caseDraft.missing.length} missing` : item.caseDraft.route ? 'case link ready' : 'draft ready', ready: item.caseDraft.missing.length === 0 },
        { label: 'owner', value: ownershipReady ? item.caseOwnership.owner.label : item.caseOwnership.blockers.length ? `${item.caseOwnership.blockers.length} follow-up${item.caseOwnership.blockers.length === 1 ? '' : 's'}` : 'review', ready: ownershipReady },
        { label: 'alert', value: alertReady ? `${item.alertPlan.readiness.matchedCandidateCount} matched` : item.alertPlan.blockers.length ? `${item.alertPlan.blockers.length} follow-up${item.alertPlan.blockers.length === 1 ? '' : 's'}` : 'review', ready: alertReady },
        { label: 'delivery', value: deliveryReady ? `${item.deliveryPlan.summary.destinations} destination${item.deliveryPlan.summary.destinations === 1 ? '' : 's'}` : item.deliveryPlan.blockers.length ? `${item.deliveryPlan.blockers.length} follow-up${item.deliveryPlan.blockers.length === 1 ? '' : 's'}` : 'review', ready: deliveryReady },
        { label: 'source review', value: enrichmentReady ? `${item.enrichmentTriage.summary.intakeItems} intake` : item.enrichmentTriage.summary.blockers ? `${item.enrichmentTriage.summary.blockers} follow-up${item.enrichmentTriage.summary.blockers === 1 ? '' : 's'}` : 'review', ready: enrichmentReady },
        { label: 'activity', value: trailReady ? `${item.caseActionTrail.summary.total} events` : item.caseActionTrail.summary.blocked ? `${item.caseActionTrail.summary.blocked} syncing` : 'review', ready: trailReady },
        ...(lowerLevelFollowUps ? [{ label: 'more', value: `${lowerLevelFollowUps} follow-up${lowerLevelFollowUps === 1 ? '' : 's'}`, ready: false }] : []),
    ]
}
