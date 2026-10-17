import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function assertAlertActorLifecycle(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody, assertOrganizationTenantIdentity } = ctx
    const { organization } = journey
    const actorWatchlistItem = journey.actorWatchlistItem!

    const ownerDisablesActorResponse = await apiRequest({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/watchlists/${actorWatchlistItem.id}?requestId=smoke-disable-actor`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { reason: 'Retire actor watchlist after proof.' },
    }, 200)
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.action, 'disabled')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.requestId, 'smoke-disable-actor')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.reason, 'Retire actor watchlist after proof.')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.lifecycleTransition.statusAfter, 'archived')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.lifecycleTransition.enabledAfter, false)
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.lifecycleTransition.disabledReasonAfter, 'watchlist_archived')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.lifecycleTransition.cleanupRoute, 'POST /api/organizations/:id/watchlists/cleanup')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.lifecycleTransition.mutationAfterArchiveDeniedByLookup, true)
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.lifecycleTransition.lookupDenialBlockerAfter, 'watchlist_not_found_or_cross_org')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.mutationReceipt.action, 'disabled')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.mutationReceipt.statusAfter, 'archived')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.mutationReceipt.enabledAfter, false)
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.mutationReceipt.lifecycleBlockerAfter, 'watchlist_archived')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.mutationReceipt.activeTermsIncludedInExport, false)
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.mutationReceipt.archivedMutationDeniedByLookup, true)
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.schemaVersion, 'organization.watchlist_downstream_lifecycle_receipt.v1')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.watchlistItemId, actorWatchlistItem.id)
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.statusAfter, 'archived')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.workflowStatus, 'excluded_from_matching')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.alertGenerationReadyAfter, false)
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.caseReplayReadyAfter, false)
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.webhookDeliveryReadyAfter, false)
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.lifecycleBlockerAfter, 'watchlist_archived')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.destinationReadiness.blockerCode, 'watchlist_archived')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.destinationReadiness.deliveryBlockedByLifecycle, true)
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.consumerContracts.alertGeneration, 'organization.watchlist_alert_generation_consumer.v1')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.consumerContracts.caseVisibility, 'organization.case_visibility_consumer.v1')
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.consumerContracts.webhookAlertDeliveryReadiness, 'organization.webhook_alert_delivery_readiness.v1')
    assert.ok(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.matchProvenance.requiredFields.includes('provenanceHash'))
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.lifecycleCleanup.cleanupRequired, true)
    assert.equal(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.lifecycleCleanup.lookupDenialBlockerAfter, 'watchlist_not_found_or_cross_org')
    assert.ok(parseBody(ownerDisablesActorResponse.body).operation.downstreamLifecycleReceipt.noLeakFields.includes('destination.secret'))
    assert.equal(parseBody(ownerDisablesActorResponse.body).watchlistItem.status, 'archived')
    assert.equal(parseBody(ownerDisablesActorResponse.body).watchlistItem.enabled, false)
    assert.equal(parseBody(ownerDisablesActorResponse.body).watchlistItem.disabledReason, 'watchlist_archived')

    const archivedActorUpdateDeniedResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/watchlists/${actorWatchlistItem.id}`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: {
            kind: 'actor',
            value: 'retired actor renamed',
            reason: 'Archived watchlists must stay excluded from active alert matching.',
            requestId: 'smoke-archived-watchlist-update-denied',
        },
    }, 404)
    const archivedActorUpdateDenied = parseBody(archivedActorUpdateDeniedResponse.body).watchlistLookupDenial
    assert.equal(archivedActorUpdateDenied.schemaVersion, 'organization.watchlist_lookup_denial.v1')
    assertOrganizationTenantIdentity(archivedActorUpdateDenied, organization.id)
    assert.equal(archivedActorUpdateDenied.actorRole, 'owner')
    assert.equal(archivedActorUpdateDenied.action, 'update_watchlist')
    assert.equal(archivedActorUpdateDenied.itemId, actorWatchlistItem.id)
    assert.equal(archivedActorUpdateDenied.blockerCode, 'watchlist_not_found_or_cross_org')
    assert.equal(archivedActorUpdateDenied.nonmemberEnumeration, false)
    assert.ok(archivedActorUpdateDenied.noLeakFields.includes('activeTerms[]'))
    assert.equal(archivedActorUpdateDenied.requestId, 'smoke-archived-watchlist-update-denied')

    const archivedWatchlistsResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists?status=archived`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    assert.deepEqual(parseBody(archivedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.id), [actorWatchlistItem.id])
    assert.deepEqual(parseBody(archivedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.enabled), [false])
    assert.deepEqual(parseBody(archivedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.disabledReason), ['watchlist_archived'])
    const archivedActorReadResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/${actorWatchlistItem.id}`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    const archivedActorReadContract = parseBody(archivedActorReadResponse.body).watchlistReadContract
    assert.equal(archivedActorReadContract.termLifecycle.schemaVersion, 'organization.watchlist_item_term_lifecycle.v1')
    assert.equal(archivedActorReadContract.termLifecycle.watchlistItemId, actorWatchlistItem.id)
    assert.equal(archivedActorReadContract.termLifecycle.status, 'archived')
    assert.equal(archivedActorReadContract.termLifecycle.activeForAlertMatching, false)
    assert.equal(archivedActorReadContract.termLifecycle.deletedByArchive, true)
    assert.equal(archivedActorReadContract.termLifecycle.blockerCode, 'watchlist_archived')
    assert.equal(archivedActorReadContract.termLifecycle.lifecycleReason, 'Retire actor watchlist after proof.')
    assert.equal(archivedActorReadContract.termLifecycle.lifecycleRequestId, 'smoke-disable-actor')
    assert.ok(archivedActorReadContract.termLifecycle.noLeakFields.includes('destination.secret'))

    const alertTermsAfterArchiveResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-alert-terms-after-archive`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    }, 200)
    const alertTermsAfterArchive = parseBody(alertTermsAfterArchiveResponse.body).alertTermsExport
    assert.equal(alertTermsAfterArchive.activeTerms.length, 4)
    assert.equal(alertTermsAfterArchive.excluded.archivedCount, 1)
    assert.deepEqual(alertTermsAfterArchive.termLifecycle.archivedItemIds, [actorWatchlistItem.id])
    assert.deepEqual(alertTermsAfterArchive.termLifecycle.deletedTermIds, [actorWatchlistItem.id])
    assert.equal(alertTermsAfterArchive.termLifecycle.deletedTermCount, 1)
    assert.equal(alertTermsAfterArchive.termLifecycle.excludedFromAlertMatching[0].watchlistItemId, actorWatchlistItem.id)
    assert.equal(alertTermsAfterArchive.termLifecycle.excludedFromAlertMatching[0].status, 'archived')
    assert.equal(alertTermsAfterArchive.termLifecycle.excludedFromAlertMatching[0].blockerCode, 'watchlist_archived')
    assert.equal(alertTermsAfterArchive.termLifecycle.excludedFromAlertMatching[0].deletedByArchive, true)
    assert.equal(alertTermsAfterArchive.termLifecycle.excludedFromAlertMatching[0].lifecycleReason, 'Retire actor watchlist after proof.')
    assert.equal(alertTermsAfterArchive.termLifecycle.excludedFromAlertMatching[0].lifecycleRequestId, 'smoke-disable-actor')
    assert.deepEqual(alertTermsAfterArchive.alertGenerationConsumer.lifecycleExclusions.deletedTermIds, [actorWatchlistItem.id])
    assert.ok(alertTermsAfterArchive.alertGenerationConsumer.blockerCodes.includes('watchlist_archived'))
    assert.ok(!alertTermsAfterArchive.alertGenerationConsumer.activeTerms.some((term: Row) => term.watchlistItemId === actorWatchlistItem.id))
    assert.equal(alertTermsAfterArchive.alertGenerationConsumer.matchingInputReceipt.termCount, 4)
    assert.ok(!alertTermsAfterArchive.alertGenerationConsumer.matchingInputReceipt.terms.some((term: Row) => term.watchlistItemId === actorWatchlistItem.id))
    assert.deepEqual(alertTermsAfterArchive.alertGenerationConsumer.matchingInputReceipt.lifecycleExclusions.archivedItemIds, [actorWatchlistItem.id])
    assert.deepEqual(alertTermsAfterArchive.alertGenerationConsumer.matchingInputReceipt.lifecycleExclusions.deletedTermIds, [actorWatchlistItem.id])
    assert.equal(alertTermsAfterArchive.alertGenerationConsumer.matchingInputReceipt.scopeGuardrails.crossOrgReadAllowed, false)
    assert.equal(alertTermsAfterArchive.termExportDeltaReceipt.activeTermCount, 4)
    assert.equal(alertTermsAfterArchive.termExportDeltaReceipt.excludedTermCount, 1)
    assert.deepEqual(alertTermsAfterArchive.termExportDeltaReceipt.excludedWatchlistItemIds, [actorWatchlistItem.id])
    assert.deepEqual(alertTermsAfterArchive.termExportDeltaReceipt.excludedReasons, ['watchlist_archived'])
    assert.deepEqual(alertTermsAfterArchive.termExportDeltaReceipt.lifecycle.archivedItemIds, [actorWatchlistItem.id])
    assert.deepEqual(alertTermsAfterArchive.termExportDeltaReceipt.lifecycle.deletedTermIds, [actorWatchlistItem.id])
    assert.ok(alertTermsAfterArchive.termExportDeltaReceipt.blockerCodes.includes('watchlist_archived'))
    assert.ok(!alertTermsAfterArchive.termExportDeltaReceipt.exportedWatchlistItemIds.includes(actorWatchlistItem.id))
    assert.deepEqual(alertTermsAfterArchive.alertBridgeContract.typedBlockers.map((blocker: Row) => blocker.code), ['archived_watchlist_excluded'])
    assert.equal(alertTermsAfterArchive.alertBridgeContract.typedBlockers[0].severity, 'notice')
    assert.equal(alertTermsAfterArchive.alertBridgeContract.typedBlockers[0].count, 1)
    assert.equal(alertTermsAfterArchive.downstreamAuthorization.watchlists.archivedCount, 1)
    assert.deepEqual(alertTermsAfterArchive.downstreamAuthorization.downstream.alertGeneration.blockerCodes, ['watchlist_archived'])
    assert.equal(alertTermsAfterArchive.downstreamAuthorization.lifecycleDenials.archivedWatchlist, 'watchlist_archived')
    assert.deepEqual(alertTermsAfterArchive.alertBridgeContract.lifecycleReadiness.typedBlockers.map((blocker: Row) => blocker.code), ['watchlist_archived', 'cleanup_required'])
    assert.equal(alertTermsAfterArchive.alertBridgeContract.lifecycleReadiness.watchlists.archivedCount, 1)
    assert.equal(alertTermsAfterArchive.alertBridgeContract.lifecycleReadiness.watchlists.cleanupRequired, true)
    assert.equal(alertTermsAfterArchive.alertBridgeContract.alertCaseProof.readyForReplay, true)
    assert.equal(alertTermsAfterArchive.alertBridgeContract.alertCaseProof.cleanupLifecycle.cleanupRequired, true)
    assert.equal(alertTermsAfterArchive.alertBridgeContract.alertCaseProof.cleanupLifecycle.archivedExcludedCount, 1)
    assert.deepEqual(alertTermsAfterArchive.alertBridgeContract.alertCaseProof.typedBlockers.map((blocker: Row) => blocker.code), ['cleanup_required'])
    assert.ok(!alertTermsAfterArchive.activeTerms.some((term: Row) => term.watchlistItemId === actorWatchlistItem.id))

}
