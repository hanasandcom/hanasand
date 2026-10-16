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
assert(pageClientSource.includes('Console actions'), 'Public TI page should use professional console action language.')
assert(pageClientSource.includes('Decision flow'), 'Public TI page should expose a compact decision flow.')
assert(pageClientSource.includes('const TI_WORKBENCH_PREVIEW_ROWS = 1'), 'Public TI dense workbenches should default to one visible row before expansion.')
assert(pageClientSource.includes('const TI_EVIDENCE_QUEUE_PREVIEW_ROWS = 2'), 'Public TI evidence queue should keep the first viewport focused before expansion.')
assert(pageClientSource.includes('const TI_SELECTED_CONTEXT_ROWS = 2'), 'Public TI selected source context should stay capped before expansion.')
assert(pageClientSource.includes('const TI_SELECTED_CONTINUITY_REF_ROWS = 2'), 'Public TI first-viewport continuity refs should stay compact.')
assert(pageClientSource.includes('const TI_SELECTED_DETAIL_LIST_ROWS = 3'), 'Public TI selected detail panels should cap visible evidence and source details.')
assert(pageClientSource.includes('artifact.watchlistTerms.slice(0, TI_SELECTED_DETAIL_LIST_ROWS).map'), 'Public TI selected artifact watchlist terms should use the detail preview cap.')
assert(pageClientSource.includes('artifact.enrichmentTasks.slice(0, TI_SELECTED_DETAIL_LIST_ROWS).map'), 'Public TI selected artifact source questions should use the detail preview cap.')
assert(!pageClientSource.includes('artifact.watchlistTerms.map(term => <li'), 'Public TI selected artifact watchlist terms should not render every row by default.')
assert(!pageClientSource.includes('artifact.enrichmentTasks.map(task => <li'), 'Public TI selected artifact source questions should not render every row by default.')
assert(pageClientSource.includes('const TI_SELECTED_SOURCE_REQUEST_ROWS = 2'), 'Public TI selected detail source requests should stay compact before expansion.')
assert(!pageClientSource.includes('TI_DESKTOP_SOURCE_FILTER_CHIPS'), 'Public TI source filters should not render duplicate desktop chip buttons.')
assert(pageClientSource.includes('data-ti-source-count-summary=\'true\''), 'Public TI source filters should summarize source counts without extra filter buttons.')
assert(pageClientSource.includes('const TI_MOBILE_SOURCE_FILTER_OPTIONS = 5'), 'Public TI mobile source filters should stay compact.')
assert(pageClientSource.includes('const TI_ACTIVITY_TIMELINE_ROWS = 3'), 'Public TI activity timeline should stay compact before expansion.')
assert(pageClientSource.includes('const TI_SOURCE_REFERENCE_ROWS = 2'), 'Public TI source reference panel should stay compact.')
assert(pageClientSource.includes('const TI_ENRICHMENT_GAP_PREVIEW_ROWS = 2'), 'Public TI enrichment gap workbench should stay compact.')
assert(pageClientSource.includes('const TI_DOSSIER_REASON_ROWS = 3'), 'Public TI actor dossier should cap confidence reasons.')
assert(pageClientSource.includes('const TI_DOSSIER_SOURCE_FAMILY_ROWS = 3'), 'Public TI actor dossier should cap source-family chips.')
assert(pageClientSource.includes('actor.confidenceReasoning.slice(0, TI_DOSSIER_REASON_ROWS).map'), 'Public TI actor dossier confidence reasons should use the named preview cap.')
assert(pageClientSource.includes('coverage.sourceFamilies.slice(0, TI_DOSSIER_SOURCE_FAMILY_ROWS).map'), 'Public TI actor dossier source-family chips should use the named preview cap.')
assert(!pageClientSource.includes('actor.confidenceReasoning.map(item => <li'), 'Public TI actor dossier should not render every confidence reason by default.')
assert(!pageClientSource.includes('coverage.sourceFamilies.map(item =>'), 'Public TI actor dossier should not render every source-family chip by default.')
assert(!pageClientSource.includes('data-ti-right-rail'), 'Public TI default actor page should not render a secondary right rail.')
assert(pageClientSource.includes('request {selectedRow.sourceRequestId ? \'queued\' : \'not queued\'}'), 'Public TI selected source state should avoid dead none labels.')
assert(pageClientSource.includes('Linked records'), 'Public TI page should expose consumer workflow state as linked records.')
assert(pageClientSource.includes('data-ti-consumer-readiness'), 'Public TI page should expose consumer readiness rows for render checks.')
assert(pageClientSource.includes('data-ti-consumer-field-readiness'), 'Public TI consumer readiness should expose required field readiness chips.')
assert(pageClientSource.includes('consumerRequestActionLabel(stage.request.method, stage.request.path)'), 'Public TI consumer readiness should show backed request method and an analyst-safe route label.')
assert(!pageClientSource.includes('font-mono text-[11px] font-semibold text-ui-text'), 'Public TI consumer readiness should not render request routes as debug-style chips.')
assert(pageClientSource.includes('const visibleLabel = feedback || (showLabel ? label : \'\')'), 'Public TI copy payload actions should stay icon-only unless explicitly promoted.')
assert(!pageClientSource.includes('showLabel ? label : \'Copy\''), 'Public TI copy payload actions should not render visible Copy text on every row.')
assert(pageClientSource.includes('org alert state'), 'Public TI consumer route labels should avoid raw internal endpoint wording.')
assert(pageClientSource.includes('{stage.payload.provenance.length} source reference'), 'Public TI consumer readiness should show stage source-reference counts.')
assert(consumerReadinessSource.includes("{ key: 'idempotencyKey', label: 'Idempotency', required: true }"), 'Webhook readiness should require an idempotency key in consumerReadiness.')
assert(pageClientSource.includes('watchlistItemIds'), 'Public TI alert readiness should show persisted watchlist item readiness.')
assert(pageClientSource.includes('data-ti-handoff-evidence-matrix'), 'Public TI page should expose handoff evidence for backed action review.')
assert(pageClientSource.includes('Review evidence'), 'Public TI page should label backed action evidence in analyst language.')
assert(pageClientSource.includes('data-ti-source-activation'), 'Public TI page should expose source activation review actions when available.')
assert(pageClientSource.includes('Source Activation'), 'Public TI page should label source activation review in analyst language.')
assert(pageClientSource.includes('Action packages'), 'Public TI page should expose validated action packages.')
assert(!pageClientSource.includes('>Action exports<'), 'Public TI page should not render implementation-shaped action export copy.')
assert(pageClientSource.includes('Action packages for authenticated review'), 'Public TI page should explain copy-only action packages professionally.')
assert(pageClientSource.includes('data-ti-action-export-summary'), 'Public TI action exports should expose compact operational summaries.')
assert(pageClientSource.includes('actionability.alertGenerationReadiness.candidateCount'), 'Public TI action exports should summarize alert-generation readiness.')
assert(pageClientSource.includes('evidence window pending'), 'Public TI action exports should show evidence-window readiness without internal wording.')
assert(pageClientSource.includes('ti.public_actor.selected_alert_action_plan.v1'), 'Selected evidence should export a versioned alert action plan.')
assert(pageClientSource.includes('data-ti-selected-alert-action-plan'), 'Selected evidence should render a stable alert action plan hook.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Alert action plan\''), 'Selected alert plan should expose a copyable request packet.')
assert(pageClientSource.includes('selectedAlertActionPlanFor(result, selected, actionability'), 'Selected alert plan should consume selected evidence and backed actionability state.')
assert(pageClientSource.includes('actionability.alertGenerationReadiness.readyForCustomerDelivery'), 'Selected alert plan should preserve alert readiness state.')
assert(pageClientSource.includes('data-ti-selected-alert-evidence'), 'Selected alert plan should render source-backed alert evidence rows.')
assert(pageClientSource.includes('data-ti-selected-alert-replay'), 'Selected alert plan should render case replay readiness rows.')
assert(pageClientSource.includes('actionability.orgRelevance.handoffRows.filter'), 'Selected alert plan should consume org relevance handoff rows.')
assert(pageClientSource.includes('actionability.caseReplayReadiness.rows.filter'), 'Selected alert plan should consume case replay readiness rows.')
assert(pageClientSource.includes('evidenceRows: activeAlertHandoffRows.slice'), 'Selected alert plan should preserve alert evidence rows in the export.')
assert(pageClientSource.includes('replayRows: activeReplayRows.slice'), 'Selected alert plan should preserve replay linkage in the export.')
assert(pageClientSource.includes('ti.public_actor.selected_delivery_readiness.v1'), 'Selected evidence should export versioned delivery readiness.')
assert(pageClientSource.includes('data-ti-selected-delivery-readiness'), 'Selected evidence should render a stable delivery readiness hook.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Delivery status\''), 'Selected delivery readiness should expose copyable status.')
assert(pageClientSource.includes('selectedDeliveryReadinessPlanFor(result, selected, actionability'), 'Selected delivery readiness should be built from selected evidence and backed actionability state.')
assert(pageClientSource.includes('actionability.webhookDeliveryHandoff.ready'), 'Selected delivery readiness should preserve webhook delivery readiness.')
assert(pageClientSource.includes('actionability.consumerReadiness.stages.find(stage => stage.id === \'webhookTrigger\')'), 'Selected delivery readiness should consume authenticated delivery stage readiness.')
assert(pageClientSource.includes('alert.deliveryReadinessContext'), 'Selected delivery readiness should consume alert delivery persistence context.')
assert(pageClientSource.includes('ti.public_actor.selected_watchlist_plan.v1'), 'Selected evidence should export a versioned watchlist plan.')
assert(pageClientSource.includes('data-ti-selected-watchlist-plan'), 'Selected evidence should render a stable watchlist plan hook.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Watchlist plan\''), 'Selected watchlist plan should expose a copyable request.')
assert(pageClientSource.includes('selectedWatchlistPlanFor(result, selected, actionability'), 'Selected watchlist plan should consume selected evidence and backed actionability state.')
