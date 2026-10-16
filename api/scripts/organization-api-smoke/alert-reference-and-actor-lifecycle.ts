import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function runAlertReferenceAndActorLifecycle(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { app, authHeaders, parseBody, assertOrganizationTenantIdentity } = ctx
    const { organization } = journey
    const readiness = journey.readiness!
    const alertTermsExport = journey.alertTermsExport!
    const actorWatchlistItem = journey.actorWatchlistItem!

    const alertTermsRetryResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-alert-terms-ready-retry`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    })
    assert.equal(alertTermsRetryResponse.statusCode, 200, alertTermsRetryResponse.body)
    const alertTermsRetryExport = parseBody(alertTermsRetryResponse.body).alertTermsExport
    assert.ok(alertTermsRetryExport.activeTerms.every((term: Row) => term.enabled === true))
    assert.ok(alertTermsRetryExport.activeTerms.every((term: Row) => term.disabledReason === null))
    assert.deepEqual(
        alertTermsRetryExport.activeTerms.map((term: Row) => ({
            watchlistItemId: term.watchlistItemId,
            alertGeneratorKey: term.alertGeneratorKey,
            alertGenerationRef: term.alertGenerationRef,
        })),
        alertTermsExport.activeTerms.map((term: Row) => ({
            watchlistItemId: term.watchlistItemId,
            alertGeneratorKey: term.alertGeneratorKey,
            alertGenerationRef: term.alertGenerationRef,
        }))
    )

    assert.equal(readiness.generatedAlertReferences.length, 5)
    const domainReference = readiness.generatedAlertReferences.find((reference: Row) => reference.matchedTerm.value === 'acme-shared.example')
    assert.ok(domainReference)
    assertOrganizationTenantIdentity(domainReference, organization.id)
    assert.equal(domainReference.watchlistItemId, domainReference.watchlist.id)
    assert.equal(domainReference.alert.organizationId, organization.id)
    assert.equal(domainReference.alert.orgId, organization.id)
    assert.equal(domainReference.alert.tenantId, organization.id)
    assert.equal(domainReference.alert.watchlistItemId, domainReference.watchlistItemId)
    assert.equal(domainReference.alert.watchlist.id, domainReference.watchlistItemId)
    assert.equal(domainReference.alert.route, 'organization_watchlist')
    assert.equal(domainReference.alert.casePath, `/dwm?organizationId=${encodeURIComponent(organization.id)}&watchlistItemId=${encodeURIComponent(domainReference.watchlistItemId)}`)
    assert.equal(domainReference.alertOwnership.schemaVersion, 'organization.alert_ownership.v1')
    assertOrganizationTenantIdentity(domainReference.alertOwnership, organization.id)
    assert.equal(domainReference.alertOwnership.ownerOrganizationId, organization.id)
    assert.equal(domainReference.alertOwnership.watchlistItemId, domainReference.watchlistItemId)
    assert.equal(domainReference.alertOwnership.watchlistId, domainReference.watchlistItemId)
    assert.equal(domainReference.alertOwnership.sourceFamily, 'organization_watchlist')
    assert.equal(domainReference.alertOwnership.route, 'organization_watchlist')
    assert.equal(domainReference.alertOwnership.casePath, domainReference.alert.casePath)
    assert.equal(domainReference.alertOwnership.dedupeKey, domainReference.alert.dedupeKey)
    assert.equal(domainReference.alertOwnership.visibilityPolicy, 'admins')
    assert.deepEqual(domainReference.alertOwnership.allowedViewerRoles, ['owner', 'admin'])
    assert.ok(domainReference.alertOwnership.requiredPersistedFields.includes('workflowContext.organizationId'))
    assert.ok(domainReference.alertOwnership.requiredPersistedFields.includes('workflowContext.visibilityDecision'))
    assert.ok(domainReference.alertOwnership.lifecycleBlockers.includes('watchlist_archived'))
    assert.ok(domainReference.alertOwnership.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
    assert.equal(domainReference.alertOwnership.crossTenantCollisionAllowed, false)
    assert.equal(domainReference.ownerContext.schemaVersion, 'organization.alert_reference_owner_context.v1')
    assertOrganizationTenantIdentity(domainReference.ownerContext, organization.id)
    assert.equal(domainReference.ownerContext.ownerOrganizationId, organization.id)
    assert.equal(domainReference.ownerContext.watchlistItemId, domainReference.watchlistItemId)
    assert.equal(domainReference.ownerContext.watchlistId, domainReference.watchlistItemId)
    assert.equal(domainReference.ownerContext.watchlistKind, 'domain')
    assert.equal(domainReference.ownerContext.createdBy, 'org_smoke_owner')
    assert.equal(domainReference.ownerContext.visibilityPolicy, 'admins')
    assert.deepEqual(domainReference.ownerContext.allowedViewerRoles, ['owner', 'admin'])
    assert.equal(domainReference.ownerContext.alertGeneratorKey, domainReference.alert.dedupeKey)
    assert.equal(domainReference.ownerContext.webhookDestinationOrgField, 'destination.org_id')
    assert.equal(domainReference.ownerContext.casePath, domainReference.alert.casePath)
    assert.equal(domainReference.ownerContext.crossTenantCollisionAllowed, false)
    assert.deepEqual(domainReference.alert.alertOwnership, domainReference.alertOwnership)
    assertOrganizationTenantIdentity(domainReference.alert.workflowContext, organization.id)
    assert.equal(domainReference.alert.workflowContext.ownerOrganizationId, organization.id)
    assert.deepEqual(domainReference.alert.workflowContext.watchlistItemIds, [domainReference.watchlistItemId])
    assert.deepEqual(domainReference.alert.workflowContext.alertGeneratorKeys, [domainReference.alert.dedupeKey])
    assert.deepEqual(domainReference.alert.workflowContext.ownerContext, domainReference.ownerContext)
    assert.equal(domainReference.alert.defaultWebhookPolicy, 'manual_selection')
    assert.equal(domainReference.alert.alertVisibilityPolicy, 'admins')
    assert.equal(domainReference.alert.memberCount, 4)
    assert.equal(domainReference.alert.activeMemberCount, 4)
    assert.equal(domainReference.alert.ownerCount, 1)
    assert.deepEqual(domainReference.alert.allowedViewerRoles, ['owner', 'admin'])
    assert.equal(domainReference.alert.removedMemberDenialReason, 'member_removed')
    assert.equal(domainReference.alert.deactivatedMemberDenialReason, 'member_deactivated')
    assert.equal(domainReference.alert.pendingInviteCount, 12)
    assert.equal(domainReference.alert.sharedWatchlistCount, 5)
    assert.equal(domainReference.alert.readinessStatus, 'ready')
    assert.equal(domainReference.webhookContract.orgId, organization.id)
    assert.equal(domainReference.webhookContract.schemaVersion, 'organization.alert_reference_webhook_contract.v1')
    assertOrganizationTenantIdentity(domainReference.webhookContract, organization.id)
    assert.equal(domainReference.webhookContract.watchlistId, domainReference.watchlistItemId)
    assert.equal(domainReference.webhookContract.defaultWebhookPolicy, 'manual_selection')
    assert.equal(domainReference.webhookContract.alertVisibilityPolicy, 'admins')
    assert.deepEqual(domainReference.webhookContract.allowedViewerRoles, ['owner', 'admin'])
    assert.equal(domainReference.webhookContract.requiredDestinationOrgId, organization.id)
    assert.equal(domainReference.webhookContract.selectedDestinationOrgField, 'destination.org_id')
    assert.equal(domainReference.webhookContract.selectedDestinationIdField, 'webhookDestinationIds[]')
    assert.deepEqual(domainReference.webhookContract.ownerContext, domainReference.ownerContext)
    assert.ok(domainReference.webhookContract.noLeakFields.includes('destination.secret'))
    assert.ok(domainReference.webhookContract.noLeakFields.includes('otherOrg.destinationIds'))
    assert.equal(domainReference.organization.defaultWebhookPolicy, 'manual_selection')
    assert.equal(domainReference.organization.alertVisibilityPolicy, 'admins')
    assert.deepEqual(domainReference.organization.allowedViewerRoles, ['owner', 'admin'])
    assert.match(domainReference.alert.casePath, /watchlistItemId=/)
    assert.match(domainReference.alert.dedupeKey, /org:/)
    assert.equal(domainReference.watchlist.termFamily, 'domain')
    assert.equal(domainReference.matchedTerm.termFamily, 'domain')
    assert.equal(domainReference.alert.matchedTerm.termFamily, 'domain')
    assert.deepEqual(domainReference.watchlist.terms, ['acme-shared.example'])

    const viewerReadinessResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-readiness`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    })
    assert.equal(viewerReadinessResponse.statusCode, 200, viewerReadinessResponse.body)
    assert.equal(parseBody(viewerReadinessResponse.body).alertReadiness.watchlistItemCount, 5)

    const viewerAlertTermsDeniedResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-viewer-alert-terms-denied`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    })
    assert.equal(viewerAlertTermsDeniedResponse.statusCode, 403, viewerAlertTermsDeniedResponse.body)
    const viewerAlertTermsDeniedBody = parseBody(viewerAlertTermsDeniedResponse.body)
    assert.equal(viewerAlertTermsDeniedBody.error, 'Organization alert visibility does not allow this member to export alert terms.')
    assert.ok(!('alertTermsExport' in viewerAlertTermsDeniedBody))
    const viewerAlertTermsDenied = viewerAlertTermsDeniedBody.alertTermsExportDenial
    assert.equal(viewerAlertTermsDenied.schemaVersion, 'organization.watchlist_alert_terms_export_denial.v1')
    assertOrganizationTenantIdentity(viewerAlertTermsDenied, organization.id)
    assert.deepEqual(viewerAlertTermsDenied.member, {
        userId: 'org_smoke_viewer',
        role: 'reader',
        status: 'active',
    })
    assert.equal(viewerAlertTermsDenied.visibility.allowed, false)
    assert.equal(viewerAlertTermsDenied.visibility.reason, 'role_not_allowed')
    assert.equal(viewerAlertTermsDenied.visibility.alertVisibilityPolicy, 'admins')
    assert.deepEqual(viewerAlertTermsDenied.visibility.allowedRoles, ['owner', 'admin'])
    assert.deepEqual(viewerAlertTermsDenied.blockerCodes, ['role_not_allowed'])
    assert.equal(viewerAlertTermsDenied.nonmemberEnumeration, false)
    assert.ok(viewerAlertTermsDenied.redactedFields.includes('activeTerms[]'))
    assert.ok(viewerAlertTermsDenied.redactedFields.includes('alertGeneratorKeys[]'))
    assert.ok(!('activeTerms' in viewerAlertTermsDenied))
    assert.ok(!('activeWatchlistTerms' in viewerAlertTermsDenied))
    assert.ok(!JSON.stringify(viewerAlertTermsDenied).includes('acme-shared.example'))
    assert.equal(viewerAlertTermsDenied.routes.alertReadiness, 'GET /api/organizations/:id/alert-readiness')
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.schemaVersion, 'organization.watchlist_alert_generation_consumer_denial.v1')
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.member.role, 'reader')
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.canReadSharedWatchlists, true)
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.canExportAlertTerms, false)
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.canMutateWatchlists, false)
    assert.deepEqual(viewerAlertTermsDenied.alertGenerationConsumerDenial.allowedExportRoles, ['owner', 'admin'])
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.denialReason, 'role_not_allowed')
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.nonmemberEnumeration, false)
    assert.ok(viewerAlertTermsDenied.alertGenerationConsumerDenial.noLeakFields.includes('activeTerms[]'))
    assert.ok(viewerAlertTermsDenied.alertGenerationConsumerDenial.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
    assert.ok(!JSON.stringify(viewerAlertTermsDenied.alertGenerationConsumerDenial).includes('acme-shared.example'))
    assert.equal(viewerAlertTermsDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

    const ownerDisablesActorResponse = await app.inject({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/watchlists/${actorWatchlistItem.id}?requestId=smoke-disable-actor`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { reason: 'Retire actor watchlist after proof.' },
    })
    assert.equal(ownerDisablesActorResponse.statusCode, 200, ownerDisablesActorResponse.body)
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

    const archivedActorUpdateDeniedResponse = await app.inject({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/watchlists/${actorWatchlistItem.id}`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: {
            kind: 'actor',
            value: 'retired actor renamed',
            reason: 'Archived watchlists must stay excluded from active alert matching.',
            requestId: 'smoke-archived-watchlist-update-denied',
        },
    })
    assert.equal(archivedActorUpdateDeniedResponse.statusCode, 404, archivedActorUpdateDeniedResponse.body)
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

    const archivedWatchlistsResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists?status=archived`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    })
    assert.equal(archivedWatchlistsResponse.statusCode, 200, archivedWatchlistsResponse.body)
    assert.deepEqual(parseBody(archivedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.id), [actorWatchlistItem.id])
    assert.deepEqual(parseBody(archivedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.enabled), [false])
    assert.deepEqual(parseBody(archivedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.disabledReason), ['watchlist_archived'])
    const archivedActorReadResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/${actorWatchlistItem.id}`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    })
    assert.equal(archivedActorReadResponse.statusCode, 200, archivedActorReadResponse.body)
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

    const alertTermsAfterArchiveResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-alert-terms-after-archive`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    })
    assert.equal(alertTermsAfterArchiveResponse.statusCode, 200, alertTermsAfterArchiveResponse.body)
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
