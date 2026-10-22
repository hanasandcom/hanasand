import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'

export async function assertMemberRemovalCleanup(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, invites, authHeaders, parseBody, assertOrganizationTenantIdentity, nowRow } = ctx
    const { organization } = journey

    const viewerPendingInviteBeforeRemoval = journey.viewerPendingInviteBeforeRemoval = nowRow({
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

    const removeViewerResponse = await apiRequest({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/members/org_smoke_viewer`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
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

    const staleRemovedViewerInvite = journey.staleRemovedViewerInvite = nowRow({
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
}
