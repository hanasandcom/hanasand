import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'

export async function runOwnershipRemovalAndOutsiderIsolation(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { app, invites, serviceLogs, authHeaders, parseBody, assertOrganizationTenantIdentity, nowRow } = ctx
    const { organization, invite } = journey
    const pendingOpsInvite = journey.pendingOpsInvite!
    const staleDeactivatedInvite = journey.staleDeactivatedInvite!
    const unknownUserInvite = journey.unknownUserInvite!
    const expiredInvite = journey.expiredInvite!
    const ownerWatchlistItem = journey.ownerWatchlistItem!
    const readiness = journey.readiness!

    const memberRemoveViewerResponse = await app.inject({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/members/org_smoke_viewer`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    })
    assert.equal(memberRemoveViewerResponse.statusCode, 403, memberRemoveViewerResponse.body)
    const memberRemoveViewerDenial = parseBody(memberRemoveViewerResponse.body).memberMutationDenial
    assert.equal(memberRemoveViewerDenial.schemaVersion, 'organization.member_mutation_denial.v1')
    assert.equal(memberRemoveViewerDenial.organizationId, organization.id)
    assert.equal(memberRemoveViewerDenial.actorId, 'org_smoke_member')
    assert.equal(memberRemoveViewerDenial.actorRole, 'reader')
    assert.equal(memberRemoveViewerDenial.targetUserId, 'org_smoke_viewer')
    assert.equal(memberRemoveViewerDenial.targetRole, 'reader')
    assert.equal(memberRemoveViewerDenial.action, 'remove_member')
    assert.equal(memberRemoveViewerDenial.requestedRole, null)
    assert.equal(memberRemoveViewerDenial.denialReason, 'role_not_allowed')
    assert.deepEqual(memberRemoveViewerDenial.allowedRoles, ['owner', 'admin'])
    assert.deepEqual(memberRemoveViewerDenial.allowedTargetRoles, ['admin', 'editor', 'reader'])
    assert.equal(memberRemoveViewerDenial.nonmemberEnumeration, false)
    assert.equal(memberRemoveViewerDenial.serviceLogAction, 'organization_member_mutation_denied')

    const adminRemoveOwnerResponse = await app.inject({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/members/org_smoke_owner`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    })
    assert.equal(adminRemoveOwnerResponse.statusCode, 403, adminRemoveOwnerResponse.body)
    const adminRemoveOwnerDenial = parseBody(adminRemoveOwnerResponse.body).memberMutationDenial
    assert.equal(adminRemoveOwnerDenial.actorRole, 'admin')
    assert.equal(adminRemoveOwnerDenial.targetUserId, 'org_smoke_owner')
    assert.equal(adminRemoveOwnerDenial.targetRole, 'owner')
    assert.equal(adminRemoveOwnerDenial.action, 'remove_member')
    assert.equal(adminRemoveOwnerDenial.adminCanMutateOwners, false)

    const viewerTransferResponse = await app.inject({
        method: 'POST',
        url: `/api/organizations/${organization.id}/ownership-transfer`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
        payload: { targetUserId: 'org_smoke_admin', reason: 'Viewer should not transfer ownership.' },
    })
    assert.equal(viewerTransferResponse.statusCode, 403, viewerTransferResponse.body)

    const invalidTransferResponse = await app.inject({
        method: 'POST',
        url: `/api/organizations/${organization.id}/ownership-transfer`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { targetUserId: 'org_smoke_admin' },
    })
    assert.equal(invalidTransferResponse.statusCode, 400, invalidTransferResponse.body)

    const transferResponse = await app.inject({
        method: 'POST',
        url: `/api/organizations/${organization.id}/ownership-transfer`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { targetUserId: 'org_smoke_admin', reason: 'Customer primary owner changed.' },
    })
    assert.equal(transferResponse.statusCode, 200, transferResponse.body)
    const transfer = parseBody(transferResponse.body)
    assert.equal(transfer.transfer.previousOwnerId, 'org_smoke_owner')
    assert.equal(transfer.transfer.newOwnerId, 'org_smoke_admin')
    assert.equal(transfer.member.role, 'owner')
    assert.equal(transfer.organization.role, 'admin')
    assert.equal(transfer.organization.ownerCount, 1)

    const formerOwnerRemovesNewOwnerResponse = await app.inject({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/members/org_smoke_admin`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    })
    assert.equal(formerOwnerRemovesNewOwnerResponse.statusCode, 403, formerOwnerRemovesNewOwnerResponse.body)

    const lastOwnerGuardResponse = await app.inject({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/members/org_smoke_admin`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    })
    assert.equal(lastOwnerGuardResponse.statusCode, 409, lastOwnerGuardResponse.body)
    const lastOwnerRemoveGuard = parseBody(lastOwnerGuardResponse.body).lastOwnerGuard
    assert.equal(lastOwnerRemoveGuard.schemaVersion, 'organization.last_owner_guard.v1')
    assert.equal(lastOwnerRemoveGuard.organizationId, organization.id)
    assert.equal(lastOwnerRemoveGuard.actorId, 'org_smoke_admin')
    assert.equal(lastOwnerRemoveGuard.actorRole, 'owner')
    assert.equal(lastOwnerRemoveGuard.targetUserId, 'org_smoke_admin')
    assert.equal(lastOwnerRemoveGuard.action, 'remove_owner')
    assert.equal(lastOwnerRemoveGuard.requestedRole, null)
    assert.equal(lastOwnerRemoveGuard.ownerCount, 1)
    assert.equal(lastOwnerRemoveGuard.blockerCode, 'last_owner_guard')
    assert.equal(lastOwnerRemoveGuard.destructiveMutationBlocked, true)
    assert.equal(lastOwnerRemoveGuard.noOrphanedOrganization, true)
    assert.equal(lastOwnerRemoveGuard.serviceLogAction, 'organization_last_owner_guard_blocked')

    const viewerPendingInviteBeforeRemoval = nowRow({
        id: 'viewer-pending-before-removal',
        organization_id: organization.id,
        email: 'viewer@example.test',
        role: 'viewer',
        invited_by: 'org_smoke_owner',
        status: 'pending',
        accepted_at: null,
        accepted_by: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    invites.set(viewerPendingInviteBeforeRemoval.id, viewerPendingInviteBeforeRemoval)
    const removeViewerResponse = await app.inject({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/members/org_smoke_viewer`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    })
    assert.equal(removeViewerResponse.statusCode, 200, removeViewerResponse.body)
    assert.equal(parseBody(removeViewerResponse.body).member.status, 'removed')
    const removeViewerCleanup = parseBody(removeViewerResponse.body).memberRemovalCleanup
    assert.equal(removeViewerCleanup.schemaVersion, 'organization.member_removal_cleanup.v1')
    assertOrganizationTenantIdentity(removeViewerCleanup, organization.id)
    assert.equal(removeViewerCleanup.targetUserId, 'org_smoke_viewer')
    assert.equal(removeViewerCleanup.targetRole, 'reader')
    assert.deepEqual(removeViewerCleanup.revokedInviteIds, [viewerPendingInviteBeforeRemoval.id])
    assert.equal(removeViewerCleanup.revokedInviteCount, 1)
    assert.equal(removeViewerCleanup.revokedInviteStatus, 'revoked')
    assert.equal(removeViewerCleanup.staleInviteAcceptanceBlocker, 'member_revoked')
    assert.equal(removeViewerCleanup.noOrphanedInviteTokens, true)
    assert.equal(removeViewerCleanup.consumerAccessRevocation.schemaVersion, 'organization.member_consumer_access_revocation.v1')
    assertOrganizationTenantIdentity(removeViewerCleanup.consumerAccessRevocation, organization.id)
    assert.equal(removeViewerCleanup.consumerAccessRevocation.targetUserId, 'org_smoke_viewer')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.targetRole, 'reader')
    assert.deepEqual(removeViewerCleanup.consumerAccessRevocation.revokedInviteIds, [viewerPendingInviteBeforeRemoval.id])
    assert.equal(removeViewerCleanup.consumerAccessRevocation.revokedInviteCount, 1)
    assert.equal(removeViewerCleanup.consumerAccessRevocation.blockerCode, 'member_revoked')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.noEnumeration, true)
    assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedRoutes.includes('GET /api/organizations/:id/watchlists'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedRoutes.includes('GET /api/organizations/:id/watchlists/alert-terms'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedRoutes.includes('GET /api/organizations/:id/alert-case-visibility'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedRoutes.includes('POST /v1/dwm/webhooks/deliver'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedConsumerContracts.includes('organization.case_visibility_consumer.v1'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedConsumerContracts.includes('organization.shared_watchlist_readiness_export.v1'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedConsumerContracts.includes('organization.webhook_destination_access_decision.v1'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.denialContracts.includes('organization.access_denial.v1'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.noLeakFields.includes('activeTerms'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.noLeakFields.includes('otherOrg.watchlistItemIds'))
    assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.schemaVersion, 'organization.member_webhook_destination_access_revocation.v1')
    assertOrganizationTenantIdentity(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation, organization.id)
    assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.targetUserId, 'org_smoke_viewer')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.targetRole, 'reader')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.blockedRoute, 'POST /v1/dwm/webhooks/deliver')
    assert.ok(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.blockedContracts.includes('organization.webhook_destination_ownership.v1'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.blockedContracts.includes('organization.webhook_destination_access_decision.v1'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.blockedContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.blockedContracts.includes('organization.shared_watchlist_readiness_export.v1'))
    assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.requiredMembershipStatus, 'active')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.removedMemberBlocker, 'member_revoked')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.revokedInviteBlocker, 'member_revoked')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.nonmemberDestinationEnumeration, false)
    assert.ok(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.noLeakFields.includes('destination.secret'))
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.schemaVersion, 'organization.member_downstream_readiness_revocation.v1')
    assertOrganizationTenantIdentity(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation, organization.id)
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.targetUserId, 'org_smoke_viewer')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.targetRole, 'reader')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.membershipStatusAfter, 'removed')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.blockerCode, 'member_revoked')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.ownerlessRecoveryMutationAllowed, false)
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.readiness.sharedWatchlistExportReady, false)
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.readiness.alertGenerationReady, false)
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.readiness.caseVisibilityReady, false)
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.readiness.webhookDeliveryReady, false)
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.readiness.supportRedactedReadReady, true)
    assert.ok(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.requiredDownstreamFields.includes('provenanceHash'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.requiredDownstreamFields.includes('destinationReadiness'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.blockedConsumerContracts.includes('organization.alert_case_bridge_persistence_receipt.v1'))
    assert.ok(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.downstreamRoutes.alertCaseVisibility, 'GET /api/organizations/:id/alert-case-visibility')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.downstreamRoutes.webhookDelivery, 'POST /v1/dwm/webhooks/deliver')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.destinationReadiness.destinationOwnerField, 'destination.org_id')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.destinationReadiness.deliveryBlockedByLifecycle, true)
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.destinationReadiness.blockerReason, 'member_revoked')
    assert.deepEqual(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.lifecycleCleanup.revokedInviteIds, [viewerPendingInviteBeforeRemoval.id])
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.lifecycleCleanup.staleInviteAcceptanceBlocker, 'member_revoked')
    assert.equal(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.lifecycleCleanup.noCrossOrgLeakage, true)
    assert.ok(removeViewerCleanup.consumerAccessRevocation.downstreamReadinessRevocation.noLeakFields.includes('otherOrg.destinationIds'))
    assert.equal(removeViewerCleanup.consumerAccessRecovery.schemaVersion, 'organization.member_consumer_access_recovery.v1')
    assertOrganizationTenantIdentity(removeViewerCleanup.consumerAccessRecovery, organization.id)
    assert.equal(removeViewerCleanup.consumerAccessRecovery.targetUserId, 'org_smoke_viewer')
    assert.equal(removeViewerCleanup.consumerAccessRecovery.targetRoleBeforeRemoval, 'reader')
    assert.equal(removeViewerCleanup.consumerAccessRecovery.currentMemberStatus, 'removed')
    assert.equal(removeViewerCleanup.consumerAccessRecovery.automaticRegrantAllowed, false)
    assert.equal(removeViewerCleanup.consumerAccessRecovery.ownerlessRecoveryMutationAllowed, false)
    assert.equal(removeViewerCleanup.consumerAccessRecovery.directMembershipMutationAllowed, false)
    assert.equal(removeViewerCleanup.consumerAccessRecovery.requiresOwnerAdminReview, true)
    assert.equal(removeViewerCleanup.consumerAccessRecovery.requiresAcceptedInvite, true)
    assert.deepEqual(removeViewerCleanup.consumerAccessRecovery.recoveryActorRoles, ['owner', 'admin'])
    assert.deepEqual(removeViewerCleanup.consumerAccessRecovery.requiredSteps, [
        'owner_or_admin_review',
        'create_new_invite',
        'target_accepts_invite',
        'new_membership_role_applied',
    ])
    assert.ok(removeViewerCleanup.consumerAccessRecovery.blockedUntilAcceptedMembership.includes('GET /api/organizations/:id/watchlists/alert-terms'))
    assert.ok(removeViewerCleanup.consumerAccessRecovery.blockedUntilAcceptedMembership.includes('GET /api/organizations/:id/alert-case-visibility'))
    assert.ok(removeViewerCleanup.consumerAccessRecovery.blockedUntilAcceptedMembership.includes('POST /v1/dwm/webhooks/deliver'))
    assert.equal(removeViewerCleanup.consumerAccessRecovery.recoveryRoutes.createInvite, 'POST /api/organizations/:id/invites')
    assert.equal(removeViewerCleanup.consumerAccessRecovery.recoveryRoutes.acceptInvite, 'POST /api/organizations/invites/:inviteId/accept')
    assert.ok(removeViewerCleanup.consumerAccessRecovery.recoveryReceipts.includes('organization.invite_consumer_visibility_receipt.v1'))
    assert.ok(removeViewerCleanup.consumerAccessRecovery.recoveryReceipts.includes('organization.member_role_consumer_visibility_receipt.v1'))
    assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.schemaVersion, 'organization.member_support_assisted_recovery_receipt.v1')
    assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.supportActionHistoryBridge, 'organization.member_recovery_support_history_bridge.v1')
    assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.allowedOutcome, 'invite_required')
    assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.directMembershipMutationAllowed, false)
    assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.ownerlessRecoveryMutationAllowed, false)
    assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.requiresAcceptedInvite, true)
    assert.ok(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.requiredAuditFields.includes('supportSessionId'))
    assert.ok(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.blockedRoutesUntilAcceptedMembership.includes('POST /v1/dwm/webhooks/deliver'))
    assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.nonmemberEnumeration, false)
    assert.equal(removeViewerCleanup.consumerAccessRecovery.blockerCode, 'member_revoked')
    assert.equal(removeViewerCleanup.consumerAccessRecovery.nonmemberEnumeration, false)
    assert.equal(invites.get(viewerPendingInviteBeforeRemoval.id)?.status, 'revoked')

    const staleRemovedViewerInvite = nowRow({
        id: 'stale-removed-viewer-invite',
        organization_id: organization.id,
        email: 'viewer@example.test',
        role: 'member',
        invited_by: 'org_smoke_owner',
        status: 'pending',
        accepted_at: null,
        accepted_by: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    invites.set(staleRemovedViewerInvite.id, staleRemovedViewerInvite)
    const staleRemovedViewerAcceptResponse = await app.inject({
        method: 'POST',
        url: `/api/organizations/invites/${staleRemovedViewerInvite.id}/accept`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    })
    assert.equal(staleRemovedViewerAcceptResponse.statusCode, 409, staleRemovedViewerAcceptResponse.body)
    const staleRemovedViewerAcceptDenial = parseBody(staleRemovedViewerAcceptResponse.body).inviteAcceptanceDenial
    assert.equal(staleRemovedViewerAcceptDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
    assert.equal(staleRemovedViewerAcceptDenial.organizationId, organization.id)
    assert.equal(staleRemovedViewerAcceptDenial.inviteId, staleRemovedViewerInvite.id)
    assert.equal(staleRemovedViewerAcceptDenial.inviteStatus, 'pending')
    assert.equal(staleRemovedViewerAcceptDenial.memberStatus, 'removed')
    assert.equal(staleRemovedViewerAcceptDenial.blockerCode, 'member_revoked')
    assert.equal(staleRemovedViewerAcceptDenial.removedMemberDenied, true)
    assert.equal(staleRemovedViewerAcceptDenial.nonmemberEnumeration, false)
    assert.ok(staleRemovedViewerAcceptDenial.safeFields.includes('memberStatus'))
    assert.ok(staleRemovedViewerAcceptDenial.noLeakFields.includes('otherOrg.members'))
    assert.ok(staleRemovedViewerAcceptDenial.noLeakFields.includes('destination.secret'))
    assert.ok(staleRemovedViewerAcceptDenial.blockedConsumerContracts.includes('organization.case_visibility_consumer.v1'))
    assert.ok(staleRemovedViewerAcceptDenial.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
    assert.equal(staleRemovedViewerAcceptDenial.readinessRefs.alertCasePersistence, 'organization.alert_case_bridge_persistence_receipt.v1')
    assert.equal(staleRemovedViewerAcceptDenial.ownerlessRecoveryMutationAllowed, false)
    assert.equal(staleRemovedViewerAcceptDenial.accessRequiresAcceptedMembership, true)

    const removedViewerInviteResponse = await app.inject({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { email: 'viewer@example.test', role: 'viewer', requestId: 'smoke-removed-viewer' },
    })
    assert.equal(removedViewerInviteResponse.statusCode, 201, removedViewerInviteResponse.body)
    const removedViewerInviteWorkflow = parseBody(removedViewerInviteResponse.body).workflow
    assert.equal(removedViewerInviteWorkflow.invitedCount, 0)
    assert.equal(removedViewerInviteWorkflow.skippedCount, 1)
    assert.equal(removedViewerInviteWorkflow.results[0].outcome, 'blocked_removed_member')

    const removedViewerWatchlistResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    })
    assert.equal(removedViewerWatchlistResponse.statusCode, 404, removedViewerWatchlistResponse.body)

    const removedViewerReadinessResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-readiness`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    })
    assert.equal(removedViewerReadinessResponse.statusCode, 404, removedViewerReadinessResponse.body)

    const removedViewerAlertTermsResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-removed-viewer-alert-terms`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    })
    assert.equal(removedViewerAlertTermsResponse.statusCode, 404, removedViewerAlertTermsResponse.body)
    const removedViewerAlertTermsDenial = parseBody(removedViewerAlertTermsResponse.body).organizationAccessDenial
    assert.equal(removedViewerAlertTermsDenial.schemaVersion, 'organization.access_denial.v1')
    assert.equal(removedViewerAlertTermsDenial.organizationId, organization.id)
    assert.equal(removedViewerAlertTermsDenial.actorId, 'org_smoke_viewer')
    assert.equal(removedViewerAlertTermsDenial.route, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.equal(removedViewerAlertTermsDenial.blockerCode, 'nonmember_denied')
    assert.equal(removedViewerAlertTermsDenial.nonmemberEnumeration, false)

    const removedViewerCaseVisibilityResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-case-visibility?requestId=smoke-removed-viewer-case-visibility`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    })
    assert.equal(removedViewerCaseVisibilityResponse.statusCode, 404, removedViewerCaseVisibilityResponse.body)
    const removedViewerCaseVisibilityDenial = parseBody(removedViewerCaseVisibilityResponse.body).organizationAccessDenial
    assert.equal(removedViewerCaseVisibilityDenial.schemaVersion, 'organization.access_denial.v1')
    assert.equal(removedViewerCaseVisibilityDenial.organizationId, organization.id)
    assert.equal(removedViewerCaseVisibilityDenial.actorId, 'org_smoke_viewer')
    assert.equal(removedViewerCaseVisibilityDenial.route, 'GET /api/organizations/:id/alert-case-visibility')
    assert.equal(removedViewerCaseVisibilityDenial.blockerCode, 'nonmember_denied')
    assert.equal(removedViewerCaseVisibilityDenial.nonmemberEnumeration, false)
    assert.equal(removedViewerCaseVisibilityDenial.downstreamRoutes.alertCaseVisibility, 'GET /api/organizations/:id/alert-case-visibility')
    assert.equal(removedViewerCaseVisibilityDenial.downstreamRoutes.webhookDelivery, 'POST /v1/dwm/webhooks/deliver')
    assert.equal(removedViewerCaseVisibilityDenial.downstreamRefs.caseVisibilityConsumer, 'organization.case_visibility_consumer.v1')
    assert.equal(removedViewerCaseVisibilityDenial.downstreamRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
    assert.ok(removedViewerCaseVisibilityDenial.noLeakFields.includes('otherOrg.caseIds'))
    assert.ok(removedViewerCaseVisibilityDenial.noLeakFields.includes('destination.secret'))
    assert.equal(readiness.readinessProof.memberLifecycleProof.denialReasons.removedMember, 'member_removed')
    assert.equal(readiness.readinessProof.memberLifecycleProof.denialReasons.expiredInvite, 'invite_expired')

    const outsiderResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: { ...authHeaders('org_smoke_outsider', 'outsider-token'), 'x-request-id': 'smoke-outsider-watchlists-denied' },
    })
    assert.equal(outsiderResponse.statusCode, 404, outsiderResponse.body)
    const outsiderWatchlistsAccessDenial = parseBody(outsiderResponse.body).organizationAccessDenial
    assert.equal(outsiderWatchlistsAccessDenial.schemaVersion, 'organization.access_denial.v1')
    assert.equal(outsiderWatchlistsAccessDenial.organizationId, organization.id)
    assert.equal(outsiderWatchlistsAccessDenial.actorId, 'org_smoke_outsider')
    assert.equal(outsiderWatchlistsAccessDenial.route, 'GET /api/organizations/:id/watchlists')
    assert.equal(outsiderWatchlistsAccessDenial.blockerCode, 'nonmember_denied')
    assert.equal(outsiderWatchlistsAccessDenial.nonmemberEnumeration, false)
    assert.ok(outsiderWatchlistsAccessDenial.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
    assert.equal(outsiderWatchlistsAccessDenial.requestId, 'smoke-outsider-watchlists-denied')
    const outsiderOrganizationReadResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}`,
        headers: { ...authHeaders('org_smoke_outsider', 'outsider-token'), 'x-request-id': 'smoke-outsider-org-read-denied' },
    })
    assert.equal(outsiderOrganizationReadResponse.statusCode, 404, outsiderOrganizationReadResponse.body)
    const outsiderOrganizationAccessDenial = parseBody(outsiderOrganizationReadResponse.body).organizationAccessDenial
    assert.equal(outsiderOrganizationAccessDenial.schemaVersion, 'organization.access_denial.v1')
    assertOrganizationTenantIdentity(outsiderOrganizationAccessDenial, organization.id)
    assert.equal(outsiderOrganizationAccessDenial.actorId, 'org_smoke_outsider')
    assert.equal(outsiderOrganizationAccessDenial.route, 'GET /api/organizations/:id')
    assert.equal(outsiderOrganizationAccessDenial.blockerCode, 'nonmember_denied')
    assert.equal(outsiderOrganizationAccessDenial.denialReason, 'not_member')
    assert.equal(outsiderOrganizationAccessDenial.nonmemberEnumeration, false)
    assert.ok(outsiderOrganizationAccessDenial.noLeakFields.includes('activeTerms[]'))
    assert.ok(outsiderOrganizationAccessDenial.downstreamRoutes.alertTermsExport.includes('watchlists/alert-terms'))
    assert.equal(outsiderOrganizationAccessDenial.serviceLogAction, 'organization_access_denied')
    assert.equal(outsiderOrganizationAccessDenial.requestId, 'smoke-outsider-org-read-denied')
    const outsiderReadinessResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-readiness`,
        headers: { ...authHeaders('org_smoke_outsider', 'outsider-token'), 'x-request-id': 'smoke-outsider-alert-readiness-denied' },
    })
    assert.equal(outsiderReadinessResponse.statusCode, 404, outsiderReadinessResponse.body)
    const outsiderReadinessAccessDenial = parseBody(outsiderReadinessResponse.body).organizationAccessDenial
    assert.equal(outsiderReadinessAccessDenial.schemaVersion, 'organization.access_denial.v1')
    assert.equal(outsiderReadinessAccessDenial.route, 'GET /api/organizations/:id/alert-readiness')
    assert.equal(outsiderReadinessAccessDenial.blockerCode, 'nonmember_denied')
    assert.equal(outsiderReadinessAccessDenial.nonmemberEnumeration, false)
    assert.ok(outsiderReadinessAccessDenial.noLeakFields.includes('activeTerms[]'))
    assert.equal(outsiderReadinessAccessDenial.requestId, 'smoke-outsider-alert-readiness-denied')
    const outsiderAlertTermsResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms`,
        headers: { ...authHeaders('org_smoke_outsider', 'outsider-token'), 'x-request-id': 'smoke-outsider-alert-terms-denied' },
    })
    assert.equal(outsiderAlertTermsResponse.statusCode, 404, outsiderAlertTermsResponse.body)
    const outsiderAlertTermsAccessDenial = parseBody(outsiderAlertTermsResponse.body).organizationAccessDenial
    assert.equal(outsiderAlertTermsAccessDenial.schemaVersion, 'organization.access_denial.v1')
    assert.equal(outsiderAlertTermsAccessDenial.route, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.equal(outsiderAlertTermsAccessDenial.blockerCode, 'nonmember_denied')
    assert.equal(outsiderAlertTermsAccessDenial.nonmemberEnumeration, false)
    assert.ok(outsiderAlertTermsAccessDenial.noLeakFields.includes('activeTerms[]'))
    assert.ok(!('alertTermsExport' in parseBody(outsiderAlertTermsResponse.body)))
    assert.equal(outsiderAlertTermsAccessDenial.requestId, 'smoke-outsider-alert-terms-denied')
    const outsiderWatchlistItemResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}`,
        headers: authHeaders('org_smoke_outsider', 'outsider-token'),
    })
    assert.equal(outsiderWatchlistItemResponse.statusCode, 404, outsiderWatchlistItemResponse.body)
    const outsiderCleanupResponse = await app.inject({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists/cleanup`,
        headers: authHeaders('org_smoke_outsider', 'outsider-token'),
        payload: { itemIds: [ownerWatchlistItem.id], reason: 'Outsider cannot clean up.', requestId: 'smoke-outsider-cleanup-denied' },
    })
    assert.equal(outsiderCleanupResponse.statusCode, 404, outsiderCleanupResponse.body)
    assert.ok(serviceLogs.some(log => log.message === 'organization_invites_created'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_accepted'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_upserted'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_updated' && log.metadata.requestId === 'smoke-keyword-update'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_paused' && log.metadata.requestId === 'smoke-pause-company'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_resumed' && log.metadata.requestId === 'smoke-resume-company'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_archived' && log.metadata.requestId === 'smoke-disable-actor'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_restored' && log.metadata.requestId === 'smoke-restore-cleanup-keyword'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-viewer-watchlist-create-denied' && log.metadata.action === 'create_watchlist' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-member-watchlist-create-denied' && log.metadata.action === 'create_watchlist' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-viewer-watchlist-archive-denied' && log.metadata.action === 'archive_watchlist' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-member-watchlist-update-denied' && log.metadata.action === 'update_watchlist' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-member-cleanup-denied' && log.metadata.action === 'cleanup_watchlists' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_lookup_denied' && log.metadata.action === 'read_watchlist' && log.metadata.itemId === ownerWatchlistItem.id && log.metadata.blockerCode === 'watchlist_not_found_or_cross_org'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_lookup_denied' && log.metadata.requestId === 'smoke-wrong-org-watchlist-update-denied' && log.metadata.action === 'update_watchlist' && log.metadata.blockerCode === 'watchlist_not_found_or_cross_org'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_lookup_denied' && log.metadata.requestId === 'smoke-archived-watchlist-update-denied' && log.metadata.action === 'update_watchlist' && log.metadata.blockerCode === 'watchlist_not_found_or_cross_org'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_access_denied' && log.metadata.requestId === 'smoke-outsider-org-read-denied' && log.metadata.blockerCode === 'nonmember_denied'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_access_denied' && log.metadata.requestId === 'smoke-outsider-watchlists-denied' && log.metadata.route === 'GET /api/organizations/:id/watchlists' && log.metadata.blockerCode === 'nonmember_denied'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_access_denied' && log.metadata.requestId === 'smoke-outsider-alert-readiness-denied' && log.metadata.route === 'GET /api/organizations/:id/alert-readiness' && log.metadata.blockerCode === 'nonmember_denied'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_access_denied' && log.metadata.requestId === 'smoke-outsider-alert-terms-denied' && log.metadata.route === 'GET /api/organizations/:id/watchlists/alert-terms' && log.metadata.blockerCode === 'nonmember_denied'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_exported' && log.metadata.requestId === 'smoke-alert-terms-ready'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_export_denied' && log.metadata.requestId === 'smoke-viewer-alert-terms-denied' && log.metadata.denialReason === 'role_not_allowed'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_export_denied' && log.metadata.requestId === 'smoke-alert-terms-paused' && log.metadata.role === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_export_denied' && log.metadata.requestId === 'smoke-member-alert-terms-ready' && log.metadata.allowedRoles.includes('admin')))
    assert.ok(serviceLogs.some(log => log.message === 'organization_alert_case_visibility_denied' && log.metadata.requestId === 'smoke-member-alert-case-denied' && log.metadata.denialReason === 'role_not_allowed' && log.metadata.allowedRoles.includes('admin')))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_cleanup_archived' && log.metadata.requestId === 'smoke-proof-cleanup'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invites_created' && log.metadata.role === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invites_created' && log.metadata.requestId === 'smoke-duplicate-recipient-dedupe' && log.metadata.submittedRecipientCount === 2 && log.metadata.recipientCount === 1 && log.metadata.duplicateRecipientCount === 1))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_accepted' && log.metadata.role === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === invite.id && log.metadata.blockerCode === 'invite_already_accepted'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === pendingOpsInvite.id && log.metadata.blockerCode === 'member_revoked'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === staleDeactivatedInvite.id && log.metadata.blockerCode === 'member_deactivated'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === unknownUserInvite.id && log.metadata.blockerCode === 'invite_not_pending'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === expiredInvite.id && log.metadata.blockerCode === 'invite_expired'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === staleRemovedViewerInvite.id && log.metadata.blockerCode === 'member_revoked'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_action_denied' && log.metadata.inviteId === invite.id && log.metadata.requestId === 'smoke-accepted-revoke-denied' && log.metadata.blockerCode === 'invite_already_accepted'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_management_denied' && log.metadata.requestId === 'smoke-member-invite-list-denied' && log.metadata.action === 'list_invites' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_management_denied' && log.metadata.requestId === 'smoke-member-invite-create-denied' && log.metadata.action === 'create_invite' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_management_denied' && log.metadata.requestId === 'smoke-viewer-revoke-denied' && log.metadata.action === 'revoke_invite' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_revoked' && log.metadata.requestId === 'smoke-revoke-pending-ops'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_resent' && log.metadata.requestId === 'smoke-resend-pending-ops'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_settings_mutation_denied' && log.metadata.requestId === 'smoke-member-settings-denied' && log.metadata.actorRole === 'reader' && log.metadata.attemptedFields.includes('alertVisibilityPolicy')))
    assert.ok(serviceLogs.some(log => log.message === 'organization_settings_mutation_denied' && log.metadata.requestId === 'smoke-viewer-settings-denied' && log.metadata.actorRole === 'reader' && log.metadata.attemptedFields.includes('defaultWebhookPolicy')))
    assert.ok(serviceLogs.some(log => log.message === 'organization_settings_updated' && log.metadata.fields.includes('defaultWebhookPolicy')))
    assert.ok(serviceLogs.some(log => log.message === 'organization_ownership_transferred' && log.metadata.targetUserId === 'org_smoke_admin'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_member_removed' && log.metadata.targetUserId === 'org_smoke_viewer'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_member_removed' && log.metadata.targetUserId === 'org_smoke_viewer' && log.metadata.revokedInviteCount === 1 && log.metadata.revokedInviteIds.includes(viewerPendingInviteBeforeRemoval.id)))
    assert.ok(serviceLogs.some(log => log.message === 'organization_member_role_updated' && log.metadata.requestId === 'smoke-viewer-role-editor'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_member_mutation_denied' && log.metadata.requestId === 'smoke-member-role-denied' && log.metadata.action === 'change_member_role'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_member_mutation_denied' && log.metadata.requestId === 'smoke-admin-promote-denied' && log.metadata.requestedRole === 'admin'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_member_mutation_denied' && log.metadata.action === 'remove_member' && log.metadata.targetUserId === 'org_smoke_owner'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_last_owner_guard_blocked' && log.metadata.requestId === 'smoke-last-owner-role-denied' && log.metadata.action === 'change_owner_role'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_last_owner_guard_blocked' && log.metadata.action === 'remove_owner' && log.metadata.targetUserId === 'org_smoke_admin'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_lifecycle_mutation_blocked' && log.metadata.requestId === 'smoke-archived-invite-denied' && log.metadata.blockerCode === 'org_archived'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_lifecycle_mutation_blocked' && log.metadata.requestId === 'smoke-deleted-watchlist-resume-denied' && log.metadata.blockerCode === 'org_deleted'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_lifecycle_mutation_blocked' && log.metadata.blockedAction === 'change member roles' && log.metadata.actorRole === 'owner'))
}
