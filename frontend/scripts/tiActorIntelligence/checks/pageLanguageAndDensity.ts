import { assert } from '../assert'
import {
    actionabilitySource,
    actorIntelligenceSource,
    actorProfileSource,
    actorWorkbenchSource,
    apiSearchSource,
    consumerReadinessSource,
    pageClientSource,
    bannedUiCopy,
    brightDarkSurfaceTokens,
    publicTiImplementationPhrases,
    publicTiBackendEmptyStatePatterns,
} from '../sourceText'

for (const phrase of bannedUiCopy) {
    assert(!pageClientSource.toLowerCase().includes(phrase), `Public TI page should not render prompt-shaped/internal copy: ${phrase}.`)
}
for (const token of brightDarkSurfaceTokens) {
    assert(!pageClientSource.includes(token), `Public TI dense dark surfaces should not use bright dark-mode token: ${token}.`)
}
for (const phrase of publicTiImplementationPhrases) {
    assert(!pageClientSource.includes(phrase), `Public TI page should not expose implementation wording: ${phrase}.`)
    assert(!actorIntelligenceSource.includes(phrase), `Public TI actor intelligence fallbacks should not expose implementation wording: ${phrase}.`)
}
for (const pattern of publicTiBackendEmptyStatePatterns) {
    assert(!pattern.test(pageClientSource), `Public TI empty states should not expose backend-shaped copy: ${pattern}.`)
    assert(!pattern.test(actorIntelligenceSource), `Public TI actor intelligence should not expose backend-shaped copy: ${pattern}.`)
    assert(!pattern.test(actionabilitySource), `Public TI actionability should not expose backend-shaped copy: ${pattern}.`)
    assert(!pattern.test(actorProfileSource), `Public TI actor geography should not expose backend-shaped copy: ${pattern}.`)
    assert(!pattern.test(actorWorkbenchSource), `Public TI actor workbench should not expose backend-shaped copy: ${pattern}.`)
}
for (const [label, source] of [
    ['page client', pageClientSource],
    ['actor intelligence', actorIntelligenceSource],
    ['actionability', actionabilitySource],
    ['actor profile', actorProfileSource],
    ['actor workbench', actorWorkbenchSource],
    ['api search fallback', apiSearchSource],
] as const) {
    const legacySourceWording = new RegExp(`\\bsource ${'basis'}\\b`, 'i')
    assert(!legacySourceWording.test(source), `Public TI ${label} should use evidence-strength language instead of legacy source wording.`)
}
assert(pageClientSource.includes('const TI_WORKBENCH_PREVIEW_ROWS = 1'), 'Public TI dense workbenches should default to one visible row before expansion.')
assert(pageClientSource.includes('const TI_EVIDENCE_QUEUE_PREVIEW_ROWS = 2'), 'Public TI evidence queue should keep the first viewport focused before expansion.')
assert(pageClientSource.includes('const TI_SELECTED_CONTINUITY_REF_ROWS = 2'), 'Public TI first-viewport continuity refs should stay compact.')
assert(pageClientSource.includes('const TI_ACTIVITY_TIMELINE_ROWS = 3'), 'Public TI activity timeline should stay compact before expansion.')
assert(!pageClientSource.includes('data-ti-right-rail'), 'Public TI default actor page should not render a secondary right rail.')
assert(pageClientSource.includes('request {selectedRow.sourceRequestId ? \'queued\' : \'not queued\'}'), 'Public TI selected source state should avoid dead none labels.')
assert(!pageClientSource.includes('font-mono text-[11px] font-semibold text-ui-text'), 'Public TI consumer readiness should not render request routes as debug-style chips.')
assert(pageClientSource.includes('const visibleLabel = feedback || (showLabel ? label : \'\')'), 'Public TI copy payload actions should stay icon-only unless explicitly promoted.')
assert(!pageClientSource.includes('showLabel ? label : \'Copy\''), 'Public TI copy payload actions should not render visible Copy text on every row.')
assert(pageClientSource.includes('org alert state'), 'Public TI consumer route labels should avoid raw internal endpoint wording.')
assert(consumerReadinessSource.includes('{ key: \'idempotencyKey\', label: \'Idempotency\', required: true }'), 'Webhook readiness should require an idempotency key in consumerReadiness.')
assert(pageClientSource.includes('watchlistItemIds'), 'Public TI alert readiness should show persisted watchlist item readiness.')
assert(pageClientSource.includes('data-ti-handoff-evidence-matrix'), 'Public TI page should expose handoff evidence for backed action review.')
assert(pageClientSource.includes('Review evidence'), 'Public TI page should label backed action evidence in analyst language.')
assert(!pageClientSource.includes('>Action exports<'), 'Public TI page should not render implementation-shaped action export copy.')
assert(pageClientSource.includes('actionability.alertGenerationReadiness.candidateCount'), 'Public TI action exports should summarize alert-generation readiness.')
assert(pageClientSource.includes('evidence window pending'), 'Public TI action exports should show evidence-window readiness without internal wording.')
assert(pageClientSource.includes('ti.public_actor.selected_alert_action_plan.v1'), 'Selected evidence should export a versioned alert action plan.')
assert(pageClientSource.includes('selectedAlertActionPlanFor(result, selected, actionability'), 'Selected alert plan should consume selected evidence and backed actionability state.')
assert(pageClientSource.includes('actionability.alertGenerationReadiness.readyForCustomerDelivery'), 'Selected alert plan should preserve alert readiness state.')
assert(pageClientSource.includes('actionability.orgRelevance.handoffRows.filter'), 'Selected alert plan should consume org relevance handoff rows.')
assert(pageClientSource.includes('actionability.caseReplayReadiness.rows.filter'), 'Selected alert plan should consume case replay readiness rows.')
assert(pageClientSource.includes('evidenceRows: activeAlertHandoffRows.slice'), 'Selected alert plan should preserve alert evidence rows in the export.')
assert(pageClientSource.includes('replayRows: activeReplayRows.slice'), 'Selected alert plan should preserve replay linkage in the export.')
assert(pageClientSource.includes('ti.public_actor.selected_delivery_readiness.v1'), 'Selected evidence should export versioned delivery readiness.')
assert(pageClientSource.includes('selectedDeliveryReadinessPlanFor(result, selected, actionability'), 'Selected delivery readiness should be built from selected evidence and backed actionability state.')
assert(pageClientSource.includes('actionability.webhookDeliveryHandoff.ready'), 'Selected delivery readiness should preserve webhook delivery readiness.')
assert(pageClientSource.includes('actionability.consumerReadiness.stages.find(stage => stage.id === \'webhookTrigger\')'), 'Selected delivery readiness should consume authenticated delivery stage readiness.')
assert(pageClientSource.includes('alert.deliveryReadinessContext'), 'Selected delivery readiness should consume alert delivery persistence context.')
assert(pageClientSource.includes('ti.public_actor.selected_watchlist_plan.v1'), 'Selected evidence should export a versioned watchlist plan.')
assert(pageClientSource.includes('selectedWatchlistPlanFor(result, selected, actionability'), 'Selected watchlist plan should consume selected evidence and backed actionability state.')
