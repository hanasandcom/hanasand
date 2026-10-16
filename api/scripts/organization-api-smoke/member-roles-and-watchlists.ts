import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function runMemberRolesAndWatchlists(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, members, authHeaders, parseBody, assertOrganizationTenantIdentity, nowRow, memberKey, iso } = ctx
    const { organization } = journey

    const membersResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/members`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    }, 200)
    const membersBody = parseBody(membersResponse.body)
    const memberships = membersBody.members
    assert.deepEqual(
        memberships.map((member: Row) => member.userId).sort(),
        ['org_smoke_admin', 'org_smoke_member', 'org_smoke_owner', 'org_smoke_viewer'].sort()
    )
    assert.equal(memberships.find((member: Row) => member.userId === 'org_smoke_admin').role, 'admin')
    assert.equal(memberships.find((member: Row) => member.userId === 'org_smoke_viewer').role, 'reader')
    assert.equal(membersBody.memberAccessContract.schemaVersion, 'organization.member_access_contract.v1')
    assertOrganizationTenantIdentity(membersBody.memberAccessContract, organization.id)
    assert.equal(membersBody.memberAccessContract.actor.role, 'owner')
    assert.equal(membersBody.memberAccessContract.actor.canManageInvites, true)
    assert.equal(membersBody.memberAccessContract.actor.canManageMembers, true)
    assert.equal(membersBody.memberAccessContract.actor.canManageWatchlists, true)
    assert.equal(membersBody.memberAccessContract.actor.canReadSharedWatchlists, true)
    assert.equal(membersBody.memberAccessContract.actor.canExportAlertTerms, true)
    assert.equal(membersBody.memberAccessContract.counts.activeMemberCount, 4)
    assert.equal(membersBody.memberAccessContract.counts.ownerCount, 1)
    assert.equal(membersBody.memberAccessContract.counts.adminCount, 1)
    assert.equal(membersBody.memberAccessContract.counts.memberCount, 0)
    assert.equal(membersBody.memberAccessContract.counts.readerCount, 2)
    assert.equal(membersBody.memberAccessContract.counts.viewerCount, 0)
    assert.equal(membersBody.memberAccessContract.counts.activeAdminCount, 2)
    assert.deepEqual(membersBody.memberAccessContract.roleGates.createWatchlist, ['owner', 'admin', 'editor'])
    assert.deepEqual(membersBody.memberAccessContract.roleGates.readSharedWatchlists, ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'])
    assert.deepEqual(membersBody.memberAccessContract.roleGates.assignCase, ['owner', 'admin', 'editor', 'analyst'])
    assert.equal(membersBody.memberAccessContract.memberLifecycle.schemaVersion, 'organization.member_lifecycle_contract.v1')
    assert.equal(membersBody.memberAccessContract.memberLifecycle.routes.listMembers, 'GET /api/organizations/:id/members')
    assert.equal(membersBody.memberAccessContract.memberLifecycle.routes.updateRole, 'PATCH /api/organizations/:id/members/:userId/role')
    assert.equal(membersBody.memberAccessContract.memberLifecycle.routes.removeMember, 'DELETE /api/organizations/:id/members/:userId')
    assert.equal(membersBody.memberAccessContract.memberLifecycle.routes.transferOwnership, 'POST /api/organizations/:id/ownership-transfer')
    assert.equal(membersBody.memberAccessContract.memberLifecycle.actorRole, 'owner')
    assert.deepEqual(membersBody.memberAccessContract.memberLifecycle.allowedMutators, ['owner', 'admin'])
    assert.deepEqual(membersBody.memberAccessContract.memberLifecycle.roleTargets, ['admin', 'editor', 'reader'])
    assert.deepEqual(membersBody.memberAccessContract.memberLifecycle.roleChange.ownerCanAssign, ['admin', 'editor', 'reader'])
    assert.deepEqual(membersBody.memberAccessContract.memberLifecycle.roleChange.adminCanAssign, ['editor', 'reader'])
    assert.equal(membersBody.memberAccessContract.memberLifecycle.roleChange.serviceLogAction, 'organization_member_role_updated')
    assert.deepEqual(membersBody.memberAccessContract.memberLifecycle.removal.ownerCanRemove, ['admin', 'editor', 'reader'])
    assert.deepEqual(membersBody.memberAccessContract.memberLifecycle.removal.adminCanRemove, ['editor', 'reader'])
    assert.equal(membersBody.memberAccessContract.memberLifecycle.removal.lastOwnerBlocked, true)
    assert.equal(membersBody.memberAccessContract.memberLifecycle.removal.removedMemberDeniedFromWatchlists, true)
    assert.equal(membersBody.memberAccessContract.memberLifecycle.removal.removedMemberDeniedFromAlertTerms, true)
    assert.equal(membersBody.memberAccessContract.memberLifecycle.ownership.reasonRequired, true)
    assert.equal(membersBody.memberAccessContract.memberLifecycle.ownership.lastOwnerGuard, true)
    assert.ok(membersBody.memberAccessContract.memberLifecycle.audit.requiredMetadataFields.includes('targetUserId'))
    assert.ok(membersBody.memberAccessContract.memberLifecycle.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
    assert.equal(membersBody.memberAccessContract.lifecycleDenials.revokedMember, 'member_revoked')
    assert.equal(membersBody.memberAccessContract.lifecycleDenials.expiredInvite, 'invite_expired')
    assert.equal(membersBody.memberAccessContract.lifecycleDenials.nonmember, 'nonmember_denied')
    assert.equal(membersBody.memberAccessContract.downstreamConsumers.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')

    const memberRoleUpdateDeniedResponse = await apiRequest({
        method: 'PATCH',
        url: `/api/organizations/${organization.id}/members/org_smoke_viewer/role`,
        headers: authHeaders('org_smoke_member', 'member-token'),
        payload: { role: 'member', reason: 'Member should not manage roles.', requestId: 'smoke-member-role-denied' },
    }, 403)
    const memberRoleUpdateDenial = parseBody(memberRoleUpdateDeniedResponse.body).memberMutationDenial
    assert.equal(memberRoleUpdateDenial.schemaVersion, 'organization.member_mutation_denial.v1')
    assert.equal(memberRoleUpdateDenial.organizationId, organization.id)
    assert.equal(memberRoleUpdateDenial.actorId, 'org_smoke_member')
    assert.equal(memberRoleUpdateDenial.actorRole, 'reader')
    assert.equal(memberRoleUpdateDenial.targetUserId, 'org_smoke_viewer')
    assert.equal(memberRoleUpdateDenial.targetRole, 'reader')
    assert.equal(memberRoleUpdateDenial.action, 'change_member_role')
    assert.equal(memberRoleUpdateDenial.requestedRole, 'reader')
    assert.equal(memberRoleUpdateDenial.denialReason, 'role_not_allowed')
    assert.equal(memberRoleUpdateDenial.statusCode, 403)
    assert.deepEqual(memberRoleUpdateDenial.allowedRoles, ['owner', 'admin'])
    assert.deepEqual(memberRoleUpdateDenial.adminAllowedTargetRoles, ['editor', 'reader'])
    assert.equal(memberRoleUpdateDenial.nonmemberEnumeration, false)
    assert.equal(memberRoleUpdateDenial.serviceLogAction, 'organization_member_mutation_denied')
    assert.equal(memberRoleUpdateDenial.requestId, 'smoke-member-role-denied')

    const adminPromotesViewerDeniedResponse = await apiRequest({
        method: 'PATCH',
        url: `/api/organizations/${organization.id}/members/org_smoke_viewer/role`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { role: 'admin', reason: 'Admin cannot promote another admin.', requestId: 'smoke-admin-promote-denied' },
    }, 403)
    const adminPromotesViewerDenial = parseBody(adminPromotesViewerDeniedResponse.body).memberMutationDenial
    assert.equal(adminPromotesViewerDenial.actorRole, 'admin')
    assert.equal(adminPromotesViewerDenial.targetRole, 'reader')
    assert.equal(adminPromotesViewerDenial.action, 'change_member_role')
    assert.equal(adminPromotesViewerDenial.requestedRole, 'admin')
    assert.equal(adminPromotesViewerDenial.adminCanMutateOwners, false)
    assert.equal(adminPromotesViewerDenial.requestId, 'smoke-admin-promote-denied')

    const ownerUpdatesViewerRoleResponse = await apiRequest({
        method: 'PATCH',
        url: `/api/organizations/${organization.id}/members/org_smoke_viewer/role`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { role: 'editor', reason: 'Temporary rollout support.', requestId: 'smoke-viewer-role-editor' },
    }, 200)
    const ownerRoleChange = parseBody(ownerUpdatesViewerRoleResponse.body).roleChange
    assert.equal(ownerRoleChange.schemaVersion, 'organization.member_role_change.v1')
    assertOrganizationTenantIdentity(ownerRoleChange, organization.id)
    assert.equal(ownerRoleChange.actorId, 'org_smoke_owner')
    assert.equal(ownerRoleChange.targetUserId, 'org_smoke_viewer')
    assert.equal(ownerRoleChange.previousRole, 'reader')
    assert.equal(ownerRoleChange.newRole, 'editor')
    assert.equal(ownerRoleChange.reason, 'Temporary rollout support.')
    assert.equal(ownerRoleChange.requestId, 'smoke-viewer-role-editor')
    assert.equal(ownerRoleChange.serviceLogAction, 'organization_member_role_updated')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.schemaVersion, 'organization.member_role_consumer_visibility_receipt.v1')
    assertOrganizationTenantIdentity(ownerRoleChange.consumerVisibilityReceipt, organization.id)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.actorId, 'org_smoke_owner')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.targetUserId, 'org_smoke_viewer')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.previousRole, 'reader')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.newRole, 'editor')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.membershipStatus, 'active')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.routes.sharedWatchlists, 'GET /api/organizations/:id/watchlists')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.routes.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.routes.alertCaseVisibility, 'GET /api/organizations/:id/alert-case-visibility')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.routes.webhookDelivery, 'POST /v1/dwm/webhooks/deliver')
    assert.ok(ownerRoleChange.consumerVisibilityReceipt.consumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
    assert.ok(ownerRoleChange.consumerVisibilityReceipt.consumerContracts.includes('organization.case_visibility_consumer.v1'))
    assert.ok(ownerRoleChange.consumerVisibilityReceipt.consumerContracts.includes('organization.webhook_destination_access_decision.v1'))
    assert.ok(ownerRoleChange.consumerVisibilityReceipt.consumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.before.role, 'reader')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.before.canReadSharedWatchlists, true)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.before.canMutateSharedWatchlists, false)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.before.canDryRunWebhookDelivery, false)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.before.canReadWebhookDeliverySummary, true)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.after.role, 'editor')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.after.canReadSharedWatchlists, true)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.after.canExportAlertTerms, false)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.after.canMutateSharedWatchlists, true)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.after.canDryRunWebhookDelivery, false)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.after.canReadWebhookDeliverySummary, true)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.deliveryReadiness.schemaVersion, 'organization.member_role_delivery_readiness.v1')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.deliveryReadiness.contract, 'organization.webhook_alert_delivery_readiness.v1')
    assert.deepEqual(ownerRoleChange.consumerVisibilityReceipt.deliveryReadiness.allowedRoles, ['owner', 'admin'])
    assert.deepEqual(ownerRoleChange.consumerVisibilityReceipt.deliveryReadiness.deniedRoles, ['member', 'viewer'])
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.deliveryReadiness.destinationOrgField, 'destination.org_id')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.deliveryReadiness.nonmemberDestinationEnumeration, false)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.blockerCodes.removedMember, 'member_revoked')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.blockerCodes.alertVisibility, 'role_not_allowed')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.blockerCodes.webhookDelivery, 'role_not_allowed')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.schemaVersion, 'organization.member_role_downstream_readiness_receipt.v1')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.organizationId, organization.id)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.targetUserId, 'org_smoke_viewer')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.previousRole, 'reader')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.newRole, 'editor')
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.roleChanged, true)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.before.sharedWatchlistReadReady, true)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.before.alertGenerationExportReady, false)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.after.sharedWatchlistReadReady, true)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.after.alertGenerationExportReady, false)
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.after.webhookDeliveryReady, false)
    assert.ok(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.downstreamContracts.includes('organization.webhook_destination_delivery_consumer.v1'))
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.destinationReadiness.destinationOwnerField, 'destination.org_id')
    assert.deepEqual(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.roleGates.webhookDelivery, ['owner', 'admin'])
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.lifecycleBlockers.roleNotAllowed, 'role_not_allowed')
    assert.ok(ownerRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
    assert.equal(ownerRoleChange.consumerVisibilityReceipt.noEnumeration, true)

    const ownerRestoresViewerRoleResponse = await apiRequest({
        method: 'PATCH',
        url: `/api/organizations/${organization.id}/members/org_smoke_viewer/role`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { role: 'reader', reason: 'Restore least privilege after rollout.', requestId: 'smoke-viewer-role-restore' },
    }, 200)
    assert.equal(parseBody(ownerRestoresViewerRoleResponse.body).member.role, 'reader')
    const restoreRoleChange = parseBody(ownerRestoresViewerRoleResponse.body).roleChange
    assert.equal(restoreRoleChange.previousRole, 'editor')
    assert.equal(restoreRoleChange.newRole, 'reader')
    assert.equal(restoreRoleChange.reason, 'Restore least privilege after rollout.')
    assert.equal(restoreRoleChange.requestId, 'smoke-viewer-role-restore')
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.previousRole, 'editor')
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.newRole, 'reader')
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.before.canReadSharedWatchlists, true)
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.before.canMutateSharedWatchlists, true)
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.after.canReadSharedWatchlists, true)
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.after.canExportAlertTerms, false)
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.after.canMutateSharedWatchlists, false)
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.after.canDryRunWebhookDelivery, false)
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.deliveryReadiness.contract, 'organization.webhook_alert_delivery_readiness.v1')
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.previousRole, 'editor')
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.newRole, 'reader')
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.after.alertGenerationExportReady, false)
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.after.watchlistMutationReady, false)
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.after.deliverySummaryReady, true)
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.downstreamReadinessReceipt.destinationReadiness.nonmemberDestinationEnumeration, false)
    assert.equal(restoreRoleChange.consumerVisibilityReceipt.noEnumeration, true)

    const ownerWatchlistResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { kind: 'domain', value: 'https://www.acme-shared.example/login', notes: 'Customer domain', reason: 'Live proof domain seed.', requestId: 'smoke-domain-create' },
    }, 201)
    const ownerWatchlistItem = journey.ownerWatchlistItem = parseBody(ownerWatchlistResponse.body).watchlistItem
    assert.equal(ownerWatchlistItem.status, 'active')
    assert.equal(ownerWatchlistItem.enabled, true)
    assert.equal(ownerWatchlistItem.disabledReason, null)
    assert.equal(ownerWatchlistItem.createdBy, 'org_smoke_owner')
    assert.equal(ownerWatchlistItem.updatedBy, 'org_smoke_owner')
    assert.equal(ownerWatchlistItem.lifecycleReason, 'Live proof domain seed.')
    assert.equal(ownerWatchlistItem.lifecycleRequestId, 'smoke-domain-create')
    assert.equal(ownerWatchlistItem.alertGenerationReference.watchlistItemId, ownerWatchlistItem.id)
    assert.equal(ownerWatchlistItem.alertGenerationReference.category, 'domain')
    assert.equal(ownerWatchlistItem.alertGenerationReference.enabled, true)
    assert.equal(ownerWatchlistItem.alertGenerationReference.disabledReason, null)
    const ownerWatchlistOperation = parseBody(ownerWatchlistResponse.body).operation
    assert.equal(ownerWatchlistOperation.actorId, 'org_smoke_owner')
    assert.equal(ownerWatchlistOperation.requestId, 'smoke-domain-create')
    assert.equal(ownerWatchlistOperation.serviceLogAction, 'organization_watchlist_upserted')
    assert.equal(ownerWatchlistOperation.reason, 'Live proof domain seed.')
    assert.equal(ownerWatchlistOperation.duplicateTermScope, 'organization')
    assert.equal(ownerWatchlistOperation.watchlistItemId, ownerWatchlistItem.id)
    assert.equal(ownerWatchlistOperation.watchlistId, ownerWatchlistItem.id)
    assert.equal(ownerWatchlistOperation.ownerContext.schemaVersion, 'organization.watchlist_owner_context.v1')
    assertOrganizationTenantIdentity(ownerWatchlistOperation.ownerContext, organization.id)
    assert.equal(ownerWatchlistOperation.ownerContext.ownerOrganizationId, organization.id)
    assert.equal(ownerWatchlistOperation.ownerContext.watchlistItemId, ownerWatchlistItem.id)
    assert.equal(ownerWatchlistOperation.ownerContext.watchlistId, ownerWatchlistItem.id)
    assert.equal(ownerWatchlistOperation.ownerContext.actorId, 'org_smoke_owner')
    assert.equal(ownerWatchlistOperation.ownerContext.actorRole, 'owner')
    assert.equal(ownerWatchlistOperation.ownerContext.sourceFamily, 'organization_watchlist')
    assert.equal(ownerWatchlistOperation.ownerContext.route, 'organization_watchlist')
    assert.ok(ownerWatchlistOperation.ownerContext.alertBridgeFields.includes('workflowContext.alertGeneratorKeys'))
    assert.ok(ownerWatchlistOperation.ownerContext.webhookBridgeFields.includes('destination.org_id'))
    assert.equal(ownerWatchlistOperation.ownerContext.crossTenantCollisionAllowed, false)
    assert.equal(ownerWatchlistOperation.ownerContext.nonmemberEnumeration, false)
    assert.equal(ownerWatchlistOperation.upsert.schemaVersion, 'organization.watchlist_upsert.v1')
    assert.equal(ownerWatchlistOperation.upsert.watchlistItemId, ownerWatchlistItem.id)
    assert.equal(ownerWatchlistOperation.upsert.ownerOrganizationId, organization.id)
    assert.equal(ownerWatchlistOperation.upsert.idempotent, true)
    assert.equal(ownerWatchlistOperation.upsert.duplicateTermMatched, false)
    assert.equal(ownerWatchlistOperation.upsert.existingItemId, null)
    assert.equal(ownerWatchlistOperation.upsert.actionTaken, 'created_new_item')
    assert.equal(ownerWatchlistOperation.upsert.crossOrganizationDuplicateAllowed, true)
    assert.equal(ownerWatchlistOperation.upsert.sameOrganizationDuplicateCreatesNewItem, false)
    assert.deepEqual(ownerWatchlistOperation.upsert.duplicateScopeKeyFields, ['organizationId', 'kind', 'normalizedValue'])
    assert.deepEqual(ownerWatchlistOperation.upsert.alertDedupeKeyFields, ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'])
    assert.equal(ownerWatchlistOperation.upsert.webhookDestinationOrgField, 'destination.org_id')
    assert.equal(ownerWatchlistOperation.lifecycleTransition.schemaVersion, 'organization.watchlist_lifecycle_transition.v1')
    assert.equal(ownerWatchlistOperation.lifecycleTransition.statusAfter, 'active')
    assert.equal(ownerWatchlistOperation.lifecycleTransition.enabledAfter, true)
    assert.equal(ownerWatchlistOperation.lifecycleTransition.disabledReasonAfter, null)
    assert.equal(ownerWatchlistOperation.lifecycleTransition.alertGenerationEligibleAfter, true)
    assert.equal(ownerWatchlistOperation.lifecycleTransition.activeTermsExportRoute, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.equal(ownerWatchlistOperation.mutationReceipt.schemaVersion, 'organization.watchlist_mutation_receipt.v1')
    assertOrganizationTenantIdentity(ownerWatchlistOperation.mutationReceipt, organization.id)
    assert.equal(ownerWatchlistOperation.mutationReceipt.ownerOrganizationId, organization.id)
    assert.equal(ownerWatchlistOperation.mutationReceipt.watchlistItemId, ownerWatchlistItem.id)
    assert.equal(ownerWatchlistOperation.mutationReceipt.watchlistId, ownerWatchlistItem.id)
    assert.equal(ownerWatchlistOperation.mutationReceipt.action, 'created')
    assert.equal(ownerWatchlistOperation.mutationReceipt.actorId, 'org_smoke_owner')
    assert.equal(ownerWatchlistOperation.mutationReceipt.actorRole, 'owner')
    assert.equal(ownerWatchlistOperation.mutationReceipt.requestId, 'smoke-domain-create')
    assert.equal(ownerWatchlistOperation.mutationReceipt.statusAfter, 'active')
    assert.equal(ownerWatchlistOperation.mutationReceipt.enabledAfter, true)
    assert.equal(ownerWatchlistOperation.mutationReceipt.disabledReasonAfter, null)
    assert.deepEqual(ownerWatchlistOperation.mutationReceipt.roleGates.mutateWatchlists, ['owner', 'admin'])
    assert.deepEqual(ownerWatchlistOperation.mutationReceipt.roleGates.readSharedWatchlists, ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'])
    assert.equal(ownerWatchlistOperation.mutationReceipt.downstreamRoutes.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.equal(ownerWatchlistOperation.mutationReceipt.downstreamRoutes.alertCaseVisibility, 'GET /api/organizations/:id/alert-case-visibility')
    assert.equal(ownerWatchlistOperation.mutationReceipt.downstreamRefs.alertGeneration, 'organization.watchlist_alert_generation_consumer.v1')
    assert.equal(ownerWatchlistOperation.mutationReceipt.downstreamRefs.caseVisibility, 'organization.case_visibility_consumer.v1')
    assert.equal(ownerWatchlistOperation.mutationReceipt.downstreamRefs.webhookOwnership, 'organization.shared_watchlist_webhook_ownership_hint.v1')
    assert.equal(ownerWatchlistOperation.mutationReceipt.activeTermsIncludedInExport, true)
    assert.equal(ownerWatchlistOperation.mutationReceipt.archivedMutationDeniedByLookup, false)
    assert.equal(ownerWatchlistOperation.mutationReceipt.duplicateTermMatched, false)
    assert.equal(ownerWatchlistOperation.mutationReceipt.noEnumeration, true)

    const duplicateOwnerWatchlistResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { kind: 'domain', value: 'acme-shared.example', notes: 'Repeat proof should update existing item.', reason: 'Repeat live proof seed.', requestId: 'smoke-domain-duplicate-upsert' },
    }, 201)
    const duplicateOwnerWatchlistItem = parseBody(duplicateOwnerWatchlistResponse.body).watchlistItem
    assert.equal(duplicateOwnerWatchlistItem.id, ownerWatchlistItem.id)
    assert.equal(duplicateOwnerWatchlistItem.lifecycleReason, 'Repeat live proof seed.')
    assert.equal(duplicateOwnerWatchlistItem.lifecycleRequestId, 'smoke-domain-duplicate-upsert')
    const duplicateOwnerWatchlistOperation = parseBody(duplicateOwnerWatchlistResponse.body).operation
    assert.equal(duplicateOwnerWatchlistOperation.action, 'updated')
    assert.equal(duplicateOwnerWatchlistOperation.duplicateTermScope, 'organization')
    assert.equal(duplicateOwnerWatchlistOperation.watchlistItemId, ownerWatchlistItem.id)
    assert.equal(duplicateOwnerWatchlistOperation.ownerContext.watchlistItemId, ownerWatchlistItem.id)
    assert.equal(duplicateOwnerWatchlistOperation.ownerContext.organizationId, organization.id)
    assert.equal(duplicateOwnerWatchlistOperation.mutationReceipt.action, 'updated')
    assert.equal(duplicateOwnerWatchlistOperation.mutationReceipt.watchlistItemId, ownerWatchlistItem.id)
    assert.equal(duplicateOwnerWatchlistOperation.mutationReceipt.duplicateTermMatched, true)
    assert.equal(duplicateOwnerWatchlistOperation.mutationReceipt.existingItemId, ownerWatchlistItem.id)
    assert.equal(duplicateOwnerWatchlistOperation.upsert.duplicateTermMatched, true)
    assert.equal(duplicateOwnerWatchlistOperation.upsert.watchlistItemId, ownerWatchlistItem.id)
    assert.equal(duplicateOwnerWatchlistOperation.upsert.existingItemId, ownerWatchlistItem.id)
    assert.equal(duplicateOwnerWatchlistOperation.upsert.actionTaken, 'updated_existing_item')
    assert.equal(duplicateOwnerWatchlistOperation.upsert.crossOrganizationDuplicateAllowed, true)
    assert.equal(duplicateOwnerWatchlistOperation.upsert.sameOrganizationDuplicateCreatesNewItem, false)
    assert.deepEqual(duplicateOwnerWatchlistOperation.upsert.alertDedupeKeyFields, ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'])
    assert.equal(duplicateOwnerWatchlistOperation.upsert.webhookDestinationOrgField, 'destination.org_id')

    const memberWatchlistResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 200)
    const memberWatchlist = parseBody(memberWatchlistResponse.body).watchlistItems
    assert.equal(memberWatchlist.length, 1)
    assert.ok(memberWatchlist[0].id)
    assert.equal(memberWatchlist[0].organizationId, organization.id)
    assert.equal(memberWatchlist[0].value, 'acme-shared.example')
    assert.equal(memberWatchlist[0].enabled, true)
    assert.equal(memberWatchlist[0].disabledReason, null)
    const memberWatchlistItemResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 200)
    const memberWatchlistItemBody = parseBody(memberWatchlistItemResponse.body)
    assert.equal(memberWatchlistItemBody.watchlistItem.id, ownerWatchlistItem.id)
    assert.equal(memberWatchlistItemBody.watchlistItem.organizationId, organization.id)
    assert.equal(memberWatchlistItemBody.watchlistReadContract.schemaVersion, 'organization.watchlist_item_read.v1')
    assertOrganizationTenantIdentity(memberWatchlistItemBody.watchlistReadContract, organization.id)
    assert.equal(memberWatchlistItemBody.watchlistReadContract.ownerOrganizationId, organization.id)
    assert.equal(memberWatchlistItemBody.watchlistReadContract.watchlistItemId, ownerWatchlistItem.id)
    assert.equal(memberWatchlistItemBody.watchlistReadContract.member.userId, 'org_smoke_member')
    assert.equal(memberWatchlistItemBody.watchlistReadContract.member.role, 'reader')
    assert.equal(memberWatchlistItemBody.watchlistReadContract.visibility.canReadSharedWatchlist, true)
    assert.equal(memberWatchlistItemBody.watchlistReadContract.visibility.alertVisibilityAllowed, false)
    assert.equal(memberWatchlistItemBody.watchlistReadContract.visibility.alertVisibilityDenialReason, 'role_not_allowed')
    assert.deepEqual(memberWatchlistItemBody.watchlistReadContract.ownerContext.alertBridgeFields, ownerWatchlistOperation.ownerContext.alertBridgeFields)
    assert.deepEqual(memberWatchlistItemBody.watchlistReadContract.ownerContext.webhookBridgeFields, ownerWatchlistOperation.ownerContext.webhookBridgeFields)
    assert.equal(memberWatchlistItemBody.watchlistReadContract.alertBridge.alertGenerationReference.watchlistItemId, ownerWatchlistItem.id)
    assert.ok(memberWatchlistItemBody.watchlistReadContract.alertBridge.requiredPersistedFields.includes('workflowContext.alertGeneratorKeys'))
    assert.equal(memberWatchlistItemBody.watchlistReadContract.webhookBridge.requiredDestinationOrgId, organization.id)
    assert.equal(memberWatchlistItemBody.watchlistReadContract.webhookBridge.nonmemberDestinationEnumeration, false)
    assert.ok(memberWatchlistItemBody.watchlistReadContract.noLeakFields.includes('otherOrg.watchlistItemIds'))
    assert.equal(memberWatchlistItemBody.watchlistReadContract.lifecycle.status, 'active')
    assert.equal(memberWatchlistItemBody.watchlistReadContract.lifecycle.alertGenerationEligible, true)
    assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.schemaVersion, 'organization.watchlist_item_term_lifecycle.v1')
    assertOrganizationTenantIdentity(memberWatchlistItemBody.watchlistReadContract.termLifecycle, organization.id)
    assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.watchlistItemId, ownerWatchlistItem.id)
    assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.status, 'active')
    assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.activeForAlertMatching, true)
    assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.deletedByArchive, false)
    assert.deepEqual(memberWatchlistItemBody.watchlistReadContract.termLifecycle.alertMatchingEligibleStatuses, ['active'])
    assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.blockerCode, null)
    assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.lifecycleRequestId, 'smoke-domain-duplicate-upsert')
    assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.downstreamRefs.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.downstreamRefs.webhookDestinationOrgField, 'destination.org_id')
    assert.ok(memberWatchlistItemBody.watchlistReadContract.termLifecycle.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
    const memberSharedWatchlistContract = parseBody(memberWatchlistResponse.body).sharedWatchlistContract
    assert.equal(memberSharedWatchlistContract.schemaVersion, 'organization.shared_watchlist_contract.v1')
    assert.equal(memberSharedWatchlistContract.organizationId, organization.id)
    assert.equal(memberSharedWatchlistContract.permissions.actorRole, 'reader')
    assert.equal(memberSharedWatchlistContract.permissions.canRead, true)
    assert.equal(memberSharedWatchlistContract.permissions.canWrite, false)
    assert.equal(memberSharedWatchlistContract.permissions.nonmemberEnumeration, false)
    assert.deepEqual(memberSharedWatchlistContract.permissions.writeRoles, ['owner', 'admin'])
    assert.deepEqual(memberSharedWatchlistContract.permissions.readRoles, ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'])
    assert.equal(memberSharedWatchlistContract.ownership.crossOrgEnumerationAllowed, false)
    assert.deepEqual(memberSharedWatchlistContract.ownership.activeItemIds, [ownerWatchlistItem.id])
    assert.deepEqual(memberSharedWatchlistContract.ownership.creatorUserIds, ['org_smoke_owner'])
    assert.equal(memberSharedWatchlistContract.lifecycle.activeCount, 1)
    assert.equal(memberSharedWatchlistContract.lifecycle.cleanupRequired, false)
    assert.equal(memberSharedWatchlistContract.alertExportBridge.route, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.deepEqual(memberSharedWatchlistContract.alertExportBridge.watchlistItemIds, [ownerWatchlistItem.id])
    assert.ok(memberSharedWatchlistContract.alertExportBridge.requiredFields.includes('ownerOrganizationId'))
    assert.ok(memberSharedWatchlistContract.alertExportBridge.requiredFields.includes('activeTerms[].ownerOrganizationId'))
    assert.ok(memberSharedWatchlistContract.alertExportBridge.requiredFields.includes('activeTerms[].matchedTerm.termFamily'))
    assert.ok(memberSharedWatchlistContract.alertExportBridge.requiredFields.includes('activeTerms[].alertGenerationRef'))
    assert.ok(memberSharedWatchlistContract.alertExportBridge.ownerContextFields.includes('activeTerms[].createdBy'))
    assert.equal(memberSharedWatchlistContract.alertExportBridge.webhookOwnership.schemaVersion, 'organization.shared_watchlist_webhook_ownership_hint.v1')
    assert.equal(memberSharedWatchlistContract.alertExportBridge.webhookOwnership.requiredDestinationOrgId, organization.id)
    assert.equal(memberSharedWatchlistContract.alertExportBridge.webhookOwnership.selectedDestinationOrgField, 'destination.org_id')
    assert.equal(memberSharedWatchlistContract.alertExportBridge.webhookOwnership.nonmemberDestinationEnumeration, false)

    const viewerWatchlistResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    }, 200)
    assert.equal(parseBody(viewerWatchlistResponse.body).watchlistItems.length, 1)

    members.set(memberKey(organization.id, 'org_smoke_deactivated'), nowRow({
        organization_id: organization.id,
        user_id: 'org_smoke_deactivated',
        role: 'reader',
        status: 'active',
        invited_by: 'org_smoke_admin',
        joined_at: iso(),
    }))
    await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_deactivated', 'deactivated-token'),
    }, 404)

    const viewerAddsWatchlistResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
        payload: { kind: 'company', value: 'Viewer Blocked Holdings', reason: 'Viewer cannot mutate shared terms.', requestId: 'smoke-viewer-watchlist-create-denied' },
    }, 403)
    const viewerAddsWatchlistDenied = parseBody(viewerAddsWatchlistResponse.body).watchlistMutationDenial
    assert.equal(viewerAddsWatchlistDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
    assertOrganizationTenantIdentity(viewerAddsWatchlistDenied, organization.id)
    assert.equal(viewerAddsWatchlistDenied.actorId, 'org_smoke_viewer')
    assert.equal(viewerAddsWatchlistDenied.actorRole, 'reader')
    assert.equal(viewerAddsWatchlistDenied.action, 'create_watchlist')
    assert.equal(viewerAddsWatchlistDenied.itemId, null)
    assert.equal(viewerAddsWatchlistDenied.denialReason, 'role_not_allowed')
    assert.deepEqual(viewerAddsWatchlistDenied.allowedRoles, ['owner', 'admin', 'editor'])
    assert.deepEqual(viewerAddsWatchlistDenied.readRoles, ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'])
    assert.equal(viewerAddsWatchlistDenied.memberCanReadSharedWatchlists, true)
    assert.equal(viewerAddsWatchlistDenied.memberCanMutateSharedWatchlists, false)
    assert.equal(viewerAddsWatchlistDenied.viewerCanReadSharedWatchlists, true)
    assert.equal(viewerAddsWatchlistDenied.viewerCanMutateSharedWatchlists, false)
    assert.equal(viewerAddsWatchlistDenied.downstreamRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
    assert.equal(viewerAddsWatchlistDenied.downstreamRefs.alertGenerationConsumer, 'organization.watchlist_alert_generation_consumer.v1')
    assert.equal(viewerAddsWatchlistDenied.downstreamRefs.alertCasePersistence, 'organization.alert_case_bridge_persistence_receipt.v1')
    assert.equal(viewerAddsWatchlistDenied.downstreamRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
    assert.equal(viewerAddsWatchlistDenied.deniedMutationDoesNotAffectActiveTerms, true)
    assert.equal(viewerAddsWatchlistDenied.activeExportRemainsAvailableToAllowedRoles, true)
    assert.ok(viewerAddsWatchlistDenied.noLeakFields.includes('otherOrg.watchlistItemIds'))
    assert.ok(viewerAddsWatchlistDenied.noLeakFields.includes('destination.secret'))
    assert.equal(viewerAddsWatchlistDenied.nonmemberEnumeration, false)
    assert.equal(viewerAddsWatchlistDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
    assert.equal(viewerAddsWatchlistDenied.requestId, 'smoke-viewer-watchlist-create-denied')
    assert.equal(viewerAddsWatchlistDenied.reason, 'Viewer cannot mutate shared terms.')
    assert.equal(viewerAddsWatchlistDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

    const memberAddsWatchlistDeniedResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_member', 'member-token'),
        payload: { kind: 'keyword', value: 'member should not mutate', reason: 'Member cannot create shared terms.', requestId: 'smoke-member-watchlist-create-denied' },
    }, 403)
    const memberAddsWatchlistDenied = parseBody(memberAddsWatchlistDeniedResponse.body).watchlistMutationDenial
    assert.equal(memberAddsWatchlistDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
    assert.equal(memberAddsWatchlistDenied.organizationId, organization.id)
    assert.equal(memberAddsWatchlistDenied.actorId, 'org_smoke_member')
    assert.equal(memberAddsWatchlistDenied.actorRole, 'reader')
    assert.equal(memberAddsWatchlistDenied.action, 'create_watchlist')
    assert.equal(memberAddsWatchlistDenied.itemId, null)
    assert.equal(memberAddsWatchlistDenied.denialReason, 'role_not_allowed')
    assert.deepEqual(memberAddsWatchlistDenied.allowedRoles, ['owner', 'admin', 'editor'])
    assert.deepEqual(memberAddsWatchlistDenied.readRoles, ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'])
    assert.equal(memberAddsWatchlistDenied.memberCanReadSharedWatchlists, true)
    assert.equal(memberAddsWatchlistDenied.memberCanMutateSharedWatchlists, false)
    assert.equal(memberAddsWatchlistDenied.nonmemberEnumeration, false)
    assert.equal(memberAddsWatchlistDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
    assert.equal(memberAddsWatchlistDenied.requestId, 'smoke-member-watchlist-create-denied')
    assert.equal(memberAddsWatchlistDenied.reason, 'Member cannot create shared terms.')

    const viewerArchiveWatchlistResponse = await apiRequest({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}?requestId=smoke-viewer-watchlist-archive-denied`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
        payload: { reason: 'Viewer cannot archive shared terms.' },
    }, 403)
    const viewerArchiveWatchlistDenied = parseBody(viewerArchiveWatchlistResponse.body).watchlistMutationDenial
    assert.equal(viewerArchiveWatchlistDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
    assert.equal(viewerArchiveWatchlistDenied.organizationId, organization.id)
    assert.equal(viewerArchiveWatchlistDenied.actorId, 'org_smoke_viewer')
    assert.equal(viewerArchiveWatchlistDenied.actorRole, 'reader')
    assert.equal(viewerArchiveWatchlistDenied.action, 'archive_watchlist')
    assert.equal(viewerArchiveWatchlistDenied.itemId, ownerWatchlistItem.id)
    assert.equal(viewerArchiveWatchlistDenied.denialReason, 'role_not_allowed')
    assert.equal(viewerArchiveWatchlistDenied.viewerCanReadSharedWatchlists, true)
    assert.equal(viewerArchiveWatchlistDenied.viewerCanMutateSharedWatchlists, false)
    assert.equal(viewerArchiveWatchlistDenied.nonmemberEnumeration, false)
    assert.equal(viewerArchiveWatchlistDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
    assert.equal(viewerArchiveWatchlistDenied.requestId, 'smoke-viewer-watchlist-archive-denied')
    assert.equal(viewerArchiveWatchlistDenied.reason, 'Viewer cannot archive shared terms.')

    const ownerAddsCompanyResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { kind: 'company', value: 'Acme Shared Holdings', requestId: 'smoke-company-watchlist' },
    }, 201)
    const companyWatchlistItem = parseBody(ownerAddsCompanyResponse.body).watchlistItem

    const ownerPausesCompanyResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists/${companyWatchlistItem.id}/actions`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { action: 'pause', reason: 'Pause during live proof cleanup.', requestId: 'smoke-pause-company' },
    }, 200)
    assert.equal(parseBody(ownerPausesCompanyResponse.body).watchlistItem.status, 'paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).watchlistItem.enabled, false)
    assert.equal(parseBody(ownerPausesCompanyResponse.body).watchlistItem.disabledReason, 'watchlist_paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.action, 'pause')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.statusAfter, 'paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.enabledAfter, false)
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.disabledReasonAfter, 'watchlist_paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.alertGenerationEligibleAfter, false)
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.blockerAfter, 'watchlist_paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.schemaVersion, 'organization.watchlist_mutation_receipt.v1')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.action, 'pause')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.statusAfter, 'paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.enabledAfter, false)
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.lifecycleBlockerAfter, 'watchlist_paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.activeTermsIncludedInExport, false)
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.noEnumeration, true)

    const pausedWatchlistsResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists?status=paused`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 200)
    assert.deepEqual(parseBody(pausedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.id), [companyWatchlistItem.id])
    assert.deepEqual(parseBody(pausedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.enabled), [false])
    assert.deepEqual(parseBody(pausedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.disabledReason), ['watchlist_paused'])

    const readinessWhilePausedResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-readiness`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    assert.equal(parseBody(readinessWhilePausedResponse.body).alertReadiness.sharedWatchlistCount, 1)
    assert.equal(parseBody(readinessWhilePausedResponse.body).alertReadiness.generatedAlertReferences.length, 1)

    const alertTermsWhilePausedResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-alert-terms-paused`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 403)
    const alertTermsWhilePausedDeniedBody = parseBody(alertTermsWhilePausedResponse.body)
    assert.equal(alertTermsWhilePausedDeniedBody.error, 'Organization alert visibility does not allow this member to export alert terms.')
    assert.ok(!('alertTermsExport' in alertTermsWhilePausedDeniedBody))
    const alertTermsWhilePausedDenied = alertTermsWhilePausedDeniedBody.alertTermsExportDenial
    assert.equal(alertTermsWhilePausedDenied.schemaVersion, 'organization.watchlist_alert_terms_export_denial.v1')
    assert.equal(alertTermsWhilePausedDenied.organizationId, organization.id)
    assert.equal(alertTermsWhilePausedDenied.member.userId, 'org_smoke_member')
    assert.equal(alertTermsWhilePausedDenied.member.role, 'reader')
    assert.equal(alertTermsWhilePausedDenied.visibility.allowed, false)
    assert.equal(alertTermsWhilePausedDenied.visibility.reason, 'role_not_allowed')
    assert.ok(alertTermsWhilePausedDenied.redactedFields.includes('activeTerms[]'))
    assert.ok(!('activeTerms' in alertTermsWhilePausedDenied))
    assert.equal(alertTermsWhilePausedDenied.auditProof.schemaVersion, 'organization.watchlist_alert_terms_denial_audit.v1')
    assert.equal(alertTermsWhilePausedDenied.auditProof.serviceLogAction, 'organization_watchlist_alert_terms_export_denied')
    assert.equal(alertTermsWhilePausedDenied.auditProof.requestId, 'smoke-alert-terms-paused')
    assert.ok(alertTermsWhilePausedDenied.auditProof.requiredMetadataFields.includes('allowedRoles'))
    assert.ok(alertTermsWhilePausedDenied.auditProof.requiredMetadataFields.includes('denialReason'))
    assert.ok(alertTermsWhilePausedDenied.auditProof.redactedFields.includes('watchlistScope.alertGeneratorKeys'))
    assert.equal(alertTermsWhilePausedDenied.auditProof.proofLogQuery, 'GET /api/logs?service=api&message=organization_watchlist_alert_terms_export_denied')

    const ownerResumesCompanyResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists/${companyWatchlistItem.id}/actions`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { action: 'resume', reason: 'Resume after cleanup dry run.', request_id: 'smoke-resume-company' },
    }, 200)
    assert.equal(parseBody(ownerResumesCompanyResponse.body).watchlistItem.status, 'active')
    assert.equal(parseBody(ownerResumesCompanyResponse.body).watchlistItem.lifecycleRequestId, 'smoke-resume-company')
    assert.equal(parseBody(ownerResumesCompanyResponse.body).operation.lifecycleTransition.statusAfter, 'active')
    assert.equal(parseBody(ownerResumesCompanyResponse.body).operation.lifecycleTransition.enabledAfter, true)
    assert.equal(parseBody(ownerResumesCompanyResponse.body).operation.lifecycleTransition.disabledReasonAfter, null)

    const adminAddsActorResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { kind: 'actor', value: 'Scattered Spider', notes: 'Actor alias', requestId: 'smoke-actor-watchlist' },
    }, 201)
    const actorWatchlistItem = journey.actorWatchlistItem = parseBody(adminAddsActorResponse.body).watchlistItem
    assert.equal(actorWatchlistItem.value, 'scattered spider')

    const actorFilterResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists?kind=actor`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 200)
    assert.deepEqual(parseBody(actorFilterResponse.body).watchlistItems.map((item: Row) => item.value), ['scattered spider'])

    const memberAddsKeywordResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { kind: 'keyword', value: 'Credential Reset', notes: 'Phishing wording', requestId: 'smoke-keyword-watchlist' },
    }, 201)
    const keywordWatchlistItem = parseBody(memberAddsKeywordResponse.body).watchlistItem
    assert.equal(keywordWatchlistItem.value, 'credential reset')

    const memberUpdatesKeywordDeniedResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/watchlists/${keywordWatchlistItem.id}`,
        headers: authHeaders('org_smoke_member', 'member-token'),
        payload: { kind: 'keyword', value: 'member update denied', reason: 'Member cannot edit shared terms.', requestId: 'smoke-member-watchlist-update-denied' },
    }, 403)
    const memberUpdatesKeywordDenied = parseBody(memberUpdatesKeywordDeniedResponse.body).watchlistMutationDenial
    assert.equal(memberUpdatesKeywordDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
    assert.equal(memberUpdatesKeywordDenied.organizationId, organization.id)
    assert.equal(memberUpdatesKeywordDenied.actorId, 'org_smoke_member')
    assert.equal(memberUpdatesKeywordDenied.actorRole, 'reader')
    assert.equal(memberUpdatesKeywordDenied.action, 'update_watchlist')
    assert.equal(memberUpdatesKeywordDenied.itemId, keywordWatchlistItem.id)
    assert.equal(memberUpdatesKeywordDenied.denialReason, 'role_not_allowed')
    assert.equal(memberUpdatesKeywordDenied.memberCanReadSharedWatchlists, true)
    assert.equal(memberUpdatesKeywordDenied.memberCanMutateSharedWatchlists, false)
    assert.equal(memberUpdatesKeywordDenied.downstreamRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
    assert.equal(memberUpdatesKeywordDenied.deniedMutationDoesNotAffectActiveTerms, true)
    assert.ok(memberUpdatesKeywordDenied.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
    assert.equal(memberUpdatesKeywordDenied.nonmemberEnumeration, false)
    assert.equal(memberUpdatesKeywordDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
    assert.equal(memberUpdatesKeywordDenied.requestId, 'smoke-member-watchlist-update-denied')
    assert.equal(memberUpdatesKeywordDenied.reason, 'Member cannot edit shared terms.')

    const memberUpdatesKeywordResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/watchlists/${keywordWatchlistItem.id}`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { kind: 'keyword', value: 'Credential Reset Lures', notes: 'Updated wording', reason: 'Refine live proof keyword.', requestId: 'smoke-keyword-update' },
    }, 200)
    assert.equal(parseBody(memberUpdatesKeywordResponse.body).watchlistItem.value, 'credential reset lures')
    assert.equal(parseBody(memberUpdatesKeywordResponse.body).operation.action, 'updated')

    await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { kind: 'vendor', value: 'Acme Payroll Vendor' },
    }, 201)

    const ownerSeesAllResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    }, 200)
    assert.deepEqual(
        parseBody(ownerSeesAllResponse.body).watchlistItems.map((item: Row) => item.value).sort(),
        ['Acme Payroll Vendor', 'Acme Shared Holdings', 'acme-shared.example', 'credential reset lures', 'scattered spider'].sort()
    )
    const ownerSharedWatchlistContract = parseBody(ownerSeesAllResponse.body).sharedWatchlistContract
    assert.deepEqual(ownerSharedWatchlistContract.termFamilies, ['actor', 'company', 'domain', 'keyword', 'vendor'])
    assert.equal(ownerSharedWatchlistContract.permissions.actorRole, 'owner')
    assert.equal(ownerSharedWatchlistContract.permissions.canWrite, true)
    assert.equal(ownerSharedWatchlistContract.permissions.canArchive, true)
    assert.equal(ownerSharedWatchlistContract.permissions.canCleanup, true)
    assert.equal(ownerSharedWatchlistContract.ownership.duplicateTermScope, 'organization')
    assert.equal(ownerSharedWatchlistContract.ownership.crossOrgEnumerationAllowed, false)
    assert.equal(ownerSharedWatchlistContract.ownership.activeItemIds.length, 5)
    assert.ok(ownerSharedWatchlistContract.ownership.itemIds.includes(ownerWatchlistItem.id))
    assert.deepEqual(ownerSharedWatchlistContract.ownership.creatorUserIds.sort(), ['org_smoke_admin', 'org_smoke_owner'].sort())
    assert.equal(ownerSharedWatchlistContract.lifecycle.activeCount, 5)
    assert.equal(ownerSharedWatchlistContract.lifecycle.pausedCount, 0)
    assert.equal(ownerSharedWatchlistContract.lifecycle.archivedCount, 0)
    assert.equal(ownerSharedWatchlistContract.lifecycle.cleanupRoute, 'POST /api/organizations/:id/watchlists/cleanup')
    assert.equal(ownerSharedWatchlistContract.lifecycle.archiveRoute, 'DELETE /api/organizations/:organizationId/watchlists/:itemId')
    assert.deepEqual(ownerSharedWatchlistContract.alertExportBridge.watchlistItemIds.sort(), ownerSharedWatchlistContract.ownership.activeItemIds.sort())
    assert.deepEqual(ownerSharedWatchlistContract.alertExportBridge.termFamilies, ['actor', 'company', 'domain', 'keyword', 'vendor'])
    assert.ok(ownerSharedWatchlistContract.alertExportBridge.ownerContextFields.includes('activeTerms[].lifecycleRequestId'))
    assert.ok(ownerSharedWatchlistContract.alertExportBridge.webhookOwnership.requiredAlertFields.includes('alert.ownerOrganizationId'))
    assert.ok(ownerSharedWatchlistContract.alertExportBridge.webhookOwnership.redactedFields.includes('destination.secret'))
    assert.deepEqual(ownerSharedWatchlistContract.alertExportBridge.blockedReasons, [])

}
