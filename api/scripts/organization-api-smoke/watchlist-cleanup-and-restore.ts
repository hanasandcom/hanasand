import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function runWatchlistCleanupAndRestore(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody, assertOrganizationTenantIdentity } = ctx
    const { organization } = journey
    const actorWatchlistItem = journey.actorWatchlistItem!

    const cleanupCompanyResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { kind: 'company', value: 'Live Proof Cleanup Holdings', reason: 'Disposable proof cleanup fixture.', requestId: 'smoke-cleanup-create-company' },
    }, 201)
    const cleanupCompanyItem = parseBody(cleanupCompanyResponse.body).watchlistItem

    const cleanupKeywordResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { kind: 'keyword', value: 'Live Proof Cleanup Phrase', reason: 'Disposable proof cleanup fixture.', requestId: 'smoke-cleanup-create-keyword' },
    }, 201)
    const cleanupKeywordItem = parseBody(cleanupKeywordResponse.body).watchlistItem

    const memberCleanupDeniedResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists/cleanup`,
        headers: authHeaders('org_smoke_member', 'member-token'),
        payload: { itemIds: [cleanupCompanyItem.id], reason: 'Member cleanup denied.', requestId: 'smoke-member-cleanup-denied' },
    }, 403)
    const memberCleanupDenied = parseBody(memberCleanupDeniedResponse.body).watchlistMutationDenial
    assert.equal(memberCleanupDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
    assertOrganizationTenantIdentity(memberCleanupDenied, organization.id)
    assert.equal(memberCleanupDenied.actorId, 'org_smoke_member')
    assert.equal(memberCleanupDenied.actorRole, 'reader')
    assert.equal(memberCleanupDenied.action, 'cleanup_watchlists')
    assert.equal(memberCleanupDenied.itemId, null)
    assert.equal(memberCleanupDenied.denialReason, 'role_not_allowed')
    assert.deepEqual(memberCleanupDenied.allowedRoles, ['owner', 'admin'])
    assert.deepEqual(memberCleanupDenied.readRoles, ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'])
    assert.equal(memberCleanupDenied.memberCanReadSharedWatchlists, true)
    assert.equal(memberCleanupDenied.memberCanMutateSharedWatchlists, false)
    assert.equal(memberCleanupDenied.viewerCanReadSharedWatchlists, true)
    assert.equal(memberCleanupDenied.viewerCanMutateSharedWatchlists, false)
    assert.equal(memberCleanupDenied.downstreamRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
    assert.equal(memberCleanupDenied.deniedMutationDoesNotAffectActiveTerms, true)
    assert.equal(memberCleanupDenied.activeExportRemainsAvailableToAllowedRoles, true)
    assert.ok(memberCleanupDenied.noLeakFields.includes('case.evidence.rawContent'))
    assert.equal(memberCleanupDenied.nonmemberEnumeration, false)
    assert.equal(memberCleanupDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
    assert.equal(memberCleanupDenied.requestId, 'smoke-member-cleanup-denied')
    assert.equal(memberCleanupDenied.reason, 'Member cleanup denied.')
    assert.equal(memberCleanupDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

    const cleanupBeforeArchiveExportResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-cleanup-export-before`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    const cleanupBeforeArchiveExport = parseBody(cleanupBeforeArchiveExportResponse.body).alertTermsExport
    assert.ok(cleanupBeforeArchiveExport.activeTerms.some((term: Row) => term.watchlistItemId === cleanupCompanyItem.id))
    assert.ok(cleanupBeforeArchiveExport.activeTerms.some((term: Row) => term.watchlistItemId === cleanupKeywordItem.id))
    const cleanupCompanyExportTerm = cleanupBeforeArchiveExport.activeTerms.find((term: Row) => term.watchlistItemId === cleanupCompanyItem.id)
    assert.equal(cleanupCompanyExportTerm.alertGenerationRef.lifecycle.reason, 'Disposable proof cleanup fixture.')
    assert.equal(cleanupCompanyExportTerm.alertGenerationRef.lifecycle.requestId, 'smoke-cleanup-create-company')
    assert.equal(cleanupCompanyExportTerm.alertGenerationRef.dedupe.parts.normalizedTerm, 'live proof cleanup holdings')

    const cleanupArchiveResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists/cleanup`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: {
            itemIds: [cleanupCompanyItem.id, cleanupKeywordItem.id, 'missing-cleanup-item'],
            reason: 'Archive disposable live proof watchlists.',
            requestId: 'smoke-proof-cleanup',
        },
    }, 200)
    const cleanupArchive = parseBody(cleanupArchiveResponse.body).cleanup
    assert.equal(cleanupArchive.schemaVersion, 'organization.watchlist_cleanup.v1')
    assert.equal(cleanupArchive.organizationId, organization.id)
    assert.equal(cleanupArchive.actorId, 'org_smoke_owner')
    assert.equal(cleanupArchive.actorRole, 'owner')
    assert.equal(cleanupArchive.archivedCount, 2)
    assert.deepEqual(cleanupArchive.archivedItemIds.sort(), [cleanupCompanyItem.id, cleanupKeywordItem.id].sort())
    assert.deepEqual(cleanupArchive.skippedItemIds, ['missing-cleanup-item'])
    assert.equal(cleanupArchive.reason, 'Archive disposable live proof watchlists.')
    assert.equal(cleanupArchive.requestId, 'smoke-proof-cleanup')
    assert.equal(cleanupArchive.serviceLogAction, 'organization_watchlist_cleanup_archived')
    assert.equal(parseBody(cleanupArchiveResponse.body).archivedItems[0].status, 'archived')

    const cleanupArchiveRepeatResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists/cleanup`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { item_ids: [cleanupCompanyItem.id], reason: 'Repeat cleanup should be safe.', request_id: 'smoke-proof-cleanup-repeat' },
    }, 200)
    assert.equal(parseBody(cleanupArchiveRepeatResponse.body).cleanup.archivedCount, 0)
    assert.deepEqual(parseBody(cleanupArchiveRepeatResponse.body).cleanup.skippedItemIds, [cleanupCompanyItem.id])
    assert.equal(parseBody(cleanupArchiveRepeatResponse.body).cleanup.requestId, 'smoke-proof-cleanup-repeat')

    const cleanupArchivedListResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists?status=archived`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 200)
    const cleanupArchivedIds = parseBody(cleanupArchivedListResponse.body).watchlistItems.map((item: Row) => item.id)
    assert.ok(cleanupArchivedIds.includes(cleanupCompanyItem.id))
    assert.ok(cleanupArchivedIds.includes(cleanupKeywordItem.id))

    const cleanupAfterArchiveExportResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-cleanup-export-after`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    const cleanupAfterArchiveExport = parseBody(cleanupAfterArchiveExportResponse.body).alertTermsExport
    assert.ok(!cleanupAfterArchiveExport.activeTerms.some((term: Row) => term.watchlistItemId === cleanupCompanyItem.id))
    assert.ok(!cleanupAfterArchiveExport.activeTerms.some((term: Row) => term.watchlistItemId === cleanupKeywordItem.id))
    assert.equal(cleanupAfterArchiveExport.excluded.archivedCount, 3)
    assert.deepEqual(cleanupAfterArchiveExport.termLifecycle.deletedTermIds.sort(), [actorWatchlistItem.id, cleanupCompanyItem.id, cleanupKeywordItem.id].sort())
    assert.equal(cleanupAfterArchiveExport.termLifecycle.deletedTermCount, 3)
    assert.ok(cleanupAfterArchiveExport.termLifecycle.excludedFromAlertMatching.every((item: Row) => item.deletedByArchive === true))
    assert.ok(cleanupAfterArchiveExport.termLifecycle.excludedFromAlertMatching.some((item: Row) => item.watchlistItemId === cleanupCompanyItem.id && item.lifecycleRequestId === 'smoke-proof-cleanup'))
    assert.ok(cleanupAfterArchiveExport.termLifecycle.excludedFromAlertMatching.some((item: Row) => item.watchlistItemId === cleanupKeywordItem.id && item.lifecycleReason === 'Archive disposable live proof watchlists.'))
    assert.ok(!cleanupAfterArchiveExport.termLifecycle.activeItemIds.includes(cleanupCompanyItem.id))
    assert.ok(!cleanupAfterArchiveExport.termLifecycle.activeItemIds.includes(cleanupKeywordItem.id))
    assert.ok(cleanupAfterArchiveExport.alertBridgeContract.typedBlockers.some((blocker: Row) => blocker.code === 'archived_watchlist_excluded' && blocker.count === 3))
    assert.ok(cleanupAfterArchiveExport.alertBridgeContract.lifecycleReadiness.typedBlockers.some((blocker: Row) => blocker.code === 'cleanup_required' && blocker.count === 3))
    assert.equal(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.readyForReplay, true)
    assert.equal(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.cleanupRequired, true)
    assert.equal(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.archivedExcludedCount, 3)
    assert.equal(cleanupAfterArchiveExport.downstreamAuthorization.watchlists.archivedCount, 3)
    assert.ok(cleanupAfterArchiveExport.downstreamAuthorization.downstream.alertGeneration.blockerCodes.includes('watchlist_archived'))
    assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.alertGenerationRef.status === 'active'))
    assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.enabled === true))
    assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.disabledReason === null))
    assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.alertGenerationRef.enabled === true))
    assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.alertGenerationRef.disabledReason === null))
    assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.alertGenerationRef.lifecycle.enabled === true))
    assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.alertGenerationReference.enabled === true))
    assert.deepEqual(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.roleActionContract.actor.allowedActions, [
        'create_watchlist',
        'edit_watchlist_terms',
        'archive_watchlist',
        'restore_watchlist',
        'acknowledge_alert',
        'assign_case',
        'link_case',
        'manage_invites',
    ])
    assert.deepEqual(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.roleActionContract.roleGates.restore_watchlist, ['owner', 'admin', 'editor'])
    assert.equal(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.roleActionContract.lifecycleDenials.archivedWatchlist, 'watchlist_archived')

    const restoreArchivedWatchlistResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists/${cleanupKeywordItem.id}/actions`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { action: 'restore', reason: 'Restore after cleanup proof.', requestId: 'smoke-restore-cleanup-keyword' },
    }, 200)
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).watchlistItem.status, 'active')
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).watchlistItem.archivedAt, null)
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).watchlistItem.enabled, true)
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).watchlistItem.disabledReason, null)
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.action, 'restore')
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.lifecycleTransition.statusAfter, 'active')
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.lifecycleTransition.enabledAfter, true)
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.lifecycleTransition.disabledReasonAfter, null)
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.lifecycleTransition.alertGenerationEligibleAfter, true)
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.downstreamLifecycleReceipt.statusAfter, 'active')
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.downstreamLifecycleReceipt.workflowStatus, 'ready_for_matching')
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.downstreamLifecycleReceipt.alertGenerationReadyAfter, true)
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.downstreamLifecycleReceipt.caseReplayReadyAfter, true)
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.downstreamLifecycleReceipt.webhookDeliveryReadyAfter, true)
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.downstreamLifecycleReceipt.lifecycleBlockerAfter, null)
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.downstreamLifecycleReceipt.destinationReadiness.deliveryBlockedByLifecycle, false)
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.downstreamLifecycleReceipt.lifecycleCleanup.cleanupRequired, false)
    assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.downstreamLifecycleReceipt.lifecycleCleanup.noCrossOrgLeakage, true)

    const restoredExportResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-restored-export`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    const restoredExport = parseBody(restoredExportResponse.body).alertTermsExport
    assert.ok(restoredExport.activeTerms.some((term: Row) => term.watchlistItemId === cleanupKeywordItem.id))
    assert.equal(restoredExport.activeTerms.find((term: Row) => term.watchlistItemId === cleanupKeywordItem.id).alertGenerationRef.lifecycle.requestId, 'smoke-restore-cleanup-keyword')
    assert.equal(restoredExport.activeTerms.find((term: Row) => term.watchlistItemId === cleanupKeywordItem.id).enabled, true)
    assert.equal(restoredExport.activeTerms.find((term: Row) => term.watchlistItemId === cleanupKeywordItem.id).disabledReason, null)
    assert.deepEqual(restoredExport.alertBridgeContract.alertCaseProof.roleActionContract.actor.allowedActions, [
        'create_watchlist',
        'edit_watchlist_terms',
        'archive_watchlist',
        'restore_watchlist',
        'acknowledge_alert',
        'assign_case',
        'link_case',
        'manage_invites',
    ])

}
