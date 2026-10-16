import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function runInviteLifecycle(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, invites, authHeaders, parseBody, assertOrganizationTenantIdentity, nowRow } = ctx
    const { organization, invite } = journey

    const pendingOpsInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { email: 'pending-ops@example.test', role: 'viewer' },
    }, 201)
    const pendingOpsInvite = journey.pendingOpsInvite = parseBody(pendingOpsInviteResponse.body).invites[0]

    const viewerRevokeInviteDeniedResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites/${pendingOpsInvite.id}/actions`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
        payload: { action: 'revoke', reason: 'Viewer cannot revoke invites.', requestId: 'smoke-viewer-revoke-denied' },
    }, 403)
    const viewerRevokeInviteDenied = parseBody(viewerRevokeInviteDeniedResponse.body).inviteManagementDenial
    assert.equal(viewerRevokeInviteDenied.schemaVersion, 'organization.invite_management_denial.v1')
    assertOrganizationTenantIdentity(viewerRevokeInviteDenied, organization.id)
    assert.equal(viewerRevokeInviteDenied.actorId, 'org_smoke_viewer')
    assert.equal(viewerRevokeInviteDenied.actorRole, 'reader')
    assert.equal(viewerRevokeInviteDenied.action, 'revoke_invite')
    assert.equal(viewerRevokeInviteDenied.inviteId, pendingOpsInvite.id)
    assert.equal(viewerRevokeInviteDenied.denialReason, 'role_not_allowed')
    assert.deepEqual(viewerRevokeInviteDenied.allowedRoles, ['owner', 'admin'])
    assert.deepEqual(viewerRevokeInviteDenied.readRoles, ['owner', 'admin'])
    assert.equal(viewerRevokeInviteDenied.viewerCanListInvites, false)
    assert.equal(viewerRevokeInviteDenied.viewerCanCreateInvites, false)
    assert.equal(viewerRevokeInviteDenied.nonmemberEnumeration, false)
    assert.ok(viewerRevokeInviteDenied.safeFields.includes('inviteId'))
    assert.ok(viewerRevokeInviteDenied.noLeakFields.includes('invite.email'))
    assert.equal(viewerRevokeInviteDenied.serviceLogAction, 'organization_invite_management_denied')
    assert.equal(viewerRevokeInviteDenied.requestId, 'smoke-viewer-revoke-denied')
    assert.equal(viewerRevokeInviteDenied.reason, 'Viewer cannot revoke invites.')
    assert.equal(viewerRevokeInviteDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

    const revokePendingInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites/${pendingOpsInvite.id}/actions`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { action: 'revoke', reason: 'Duplicate operator invite cleanup.', requestId: 'smoke-revoke-pending-ops' },
    }, 200)
    const revokedInviteAction = parseBody(revokePendingInviteResponse.body).inviteAction
    assert.equal(revokedInviteAction.schemaVersion, 'organization.invite_action.v1')
    assertOrganizationTenantIdentity(revokedInviteAction, organization.id)
    assert.equal(revokedInviteAction.action, 'revoke')
    assert.equal(revokedInviteAction.status, 'revoked')
    assert.equal(revokedInviteAction.previousStatus, 'pending')
    assert.equal(revokedInviteAction.requestId, 'smoke-revoke-pending-ops')
    assert.equal(revokedInviteAction.acceptanceToken, pendingOpsInvite.id)
    assert.equal(revokedInviteAction.actorId, 'org_smoke_admin')
    assert.equal(revokedInviteAction.actorRole, 'admin')
    assert.equal(revokedInviteAction.reason, 'Duplicate operator invite cleanup.')
    assert.equal(revokedInviteAction.serviceLogAction, 'organization_invite_revoked')
    assert.equal(revokedInviteAction.consumerVisibilityReceipt.schemaVersion, 'organization.invite_consumer_visibility_receipt.v1')
    assertOrganizationTenantIdentity(revokedInviteAction.consumerVisibilityReceipt, organization.id)
    assert.equal(revokedInviteAction.consumerVisibilityReceipt.inviteId, pendingOpsInvite.id)
    assert.equal(revokedInviteAction.consumerVisibilityReceipt.inviteStatus, 'revoked')
    assert.equal(revokedInviteAction.consumerVisibilityReceipt.action, 'revoke')
    assert.equal(revokedInviteAction.consumerVisibilityReceipt.grantsConsumerAccess, false)
    assert.equal(revokedInviteAction.consumerVisibilityReceipt.acceptanceRequired, true)
    assert.equal(revokedInviteAction.consumerVisibilityReceipt.blockerCode, 'member_revoked')
    assert.ok(revokedInviteAction.consumerVisibilityReceipt.blockedRoutes.includes('GET /api/organizations/:id/watchlists'))
    assert.ok(revokedInviteAction.consumerVisibilityReceipt.blockedRoutes.includes('GET /api/organizations/:id/watchlists/alert-terms'))
    assert.ok(revokedInviteAction.consumerVisibilityReceipt.blockedRoutes.includes('GET /api/organizations/:id/alert-case-visibility'))
    assert.ok(revokedInviteAction.consumerVisibilityReceipt.blockedConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
    assert.ok(revokedInviteAction.consumerVisibilityReceipt.blockedConsumerContracts.includes('organization.case_visibility_consumer.v1'))
    assert.ok(revokedInviteAction.consumerVisibilityReceipt.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
    assert.equal(revokedInviteAction.consumerVisibilityReceipt.noEnumeration, true)
    assert.equal(revokedInviteAction.downstreamReadinessReceipt.schemaVersion, 'organization.invite_downstream_readiness_receipt.v1')
    assert.equal(revokedInviteAction.downstreamReadinessReceipt.inviteStatus, 'revoked')
    assert.equal(revokedInviteAction.downstreamReadinessReceipt.grantsConsumerAccess, false)
    assert.equal(revokedInviteAction.downstreamReadinessReceipt.blockerReason, 'member_revoked')
    assert.equal(revokedInviteAction.downstreamReadinessReceipt.readiness.alertGenerationReady, false)
    assert.equal(revokedInviteAction.downstreamReadinessReceipt.readiness.webhookDeliveryReady, false)
    assert.ok(revokedInviteAction.downstreamReadinessReceipt.downstreamContracts.includes('organization.webhook_destination_delivery_consumer.v1'))
    assert.ok(revokedInviteAction.downstreamReadinessReceipt.requiredAcceptedMembershipFields.includes('destinationReadiness'))
    assert.equal(revokedInviteAction.downstreamReadinessReceipt.destinationReadiness.deliveryBlockedUntilAccepted, true)
    assert.equal(revokedInviteAction.downstreamReadinessReceipt.lifecycleCleanup.revokedInviteBlocker, 'member_revoked')
    assert.equal(revokedInviteAction.downstreamReadinessReceipt.lifecycleCleanup.noCrossOrgLeakage, true)
    assert.ok(revokedInviteAction.downstreamReadinessReceipt.noLeakFields.includes('otherOrg.watchlistItemIds'))

    const revokePendingInviteRepeatResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites/${pendingOpsInvite.id}/actions`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { action: 'revoke', reason: 'Repeat revoke should be safe.', requestId: 'smoke-revoke-pending-ops-repeat' },
    }, 200)
    const repeatRevokedInviteAction = parseBody(revokePendingInviteRepeatResponse.body).inviteAction
    assert.equal(repeatRevokedInviteAction.previousStatus, 'revoked')
    assert.equal(repeatRevokedInviteAction.status, 'revoked')
    assert.equal(repeatRevokedInviteAction.requestId, 'smoke-revoke-pending-ops-repeat')
    assert.equal(repeatRevokedInviteAction.consumerVisibilityReceipt.grantsConsumerAccess, false)
    assert.equal(repeatRevokedInviteAction.consumerVisibilityReceipt.blockerCode, 'member_revoked')

    const revokedInviteAcceptResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/invites/${pendingOpsInvite.id}/accept`,
        headers: authHeaders('org_smoke_outsider', 'outsider-token'),
    }, 409)
    const revokedInviteAcceptDenial = parseBody(revokedInviteAcceptResponse.body).inviteAcceptanceDenial
    assert.equal(revokedInviteAcceptDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
    assert.equal(revokedInviteAcceptDenial.organizationId, organization.id)
    assert.equal(revokedInviteAcceptDenial.inviteId, pendingOpsInvite.id)
    assert.equal(revokedInviteAcceptDenial.inviteStatus, 'revoked')
    assert.equal(revokedInviteAcceptDenial.blockerCode, 'member_revoked')
    assert.ok(revokedInviteAcceptDenial.blockedRoutes.includes('GET /api/organizations/:id/watchlists/alert-terms'))
    assert.ok(revokedInviteAcceptDenial.blockedRoutes.includes('POST /v1/dwm/webhooks/deliver'))
    assert.ok(revokedInviteAcceptDenial.blockedConsumerContracts.includes('organization.shared_watchlist_readiness_export.v1'))
    assert.ok(revokedInviteAcceptDenial.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
    assert.equal(revokedInviteAcceptDenial.readinessRefs.inviteLifecycle, 'organization.invite_lifecycle_readiness_proof.v1')
    assert.equal(revokedInviteAcceptDenial.readinessRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
    assert.equal(revokedInviteAcceptDenial.ownerlessRecoveryMutationAllowed, false)
    assert.equal(revokedInviteAcceptDenial.accessRequiresAcceptedMembership, true)
    assert.equal(revokedInviteAcceptDenial.nonmemberEnumeration, false)

    const resendPendingInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites/${pendingOpsInvite.id}/actions`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: {
            action: 'resend',
            reason: 'Restore pending operator invite for rollout.',
            requestId: 'smoke-resend-pending-ops',
            expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
    }, 200)
    const resentInviteAction = parseBody(resendPendingInviteResponse.body).inviteAction
    assert.equal(resentInviteAction.action, 'resend')
    assert.equal(resentInviteAction.previousStatus, 'revoked')
    assert.equal(resentInviteAction.status, 'pending')
    assert.equal(resentInviteAction.requestId, 'smoke-resend-pending-ops')
    assert.equal(resentInviteAction.actorId, 'org_smoke_owner')
    assert.equal(resentInviteAction.actorRole, 'owner')
    assert.equal(resentInviteAction.reason, 'Restore pending operator invite for rollout.')
    assert.equal(resentInviteAction.serviceLogAction, 'organization_invite_resent')
    assert.equal(resentInviteAction.downstreamReadinessReceipt.inviteStatus, 'pending')
    assert.equal(resentInviteAction.downstreamReadinessReceipt.blockerReason, 'invite_pending')
    assert.equal(resentInviteAction.downstreamReadinessReceipt.acceptanceRequired, true)
    assert.equal(resentInviteAction.downstreamReadinessReceipt.readiness.sharedWatchlistReadReady, false)
    assert.equal(resentInviteAction.downstreamReadinessReceipt.lifecycleCleanup.resendIdempotent, true)
    assert.equal(resentInviteAction.downstreamReadinessReceipt.destinationReadiness.nonmemberDestinationEnumeration, false)
    assert.equal(parseBody(resendPendingInviteResponse.body).invite.acceptancePath, `/api/organizations/invites/${pendingOpsInvite.id}/accept`)

    const resendPendingInviteRepeatResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites/${pendingOpsInvite.id}/actions`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: {
            action: 'resend',
            reason: 'Repeat resend should keep access pending.',
            requestId: 'smoke-resend-pending-ops-repeat',
        },
    }, 200)
    const repeatResentInviteAction = parseBody(resendPendingInviteRepeatResponse.body).inviteAction
    assert.equal(repeatResentInviteAction.previousStatus, 'pending')
    assert.equal(repeatResentInviteAction.status, 'pending')
    assert.equal(repeatResentInviteAction.requestId, 'smoke-resend-pending-ops-repeat')

    const acceptedInviteRevokeResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites/${invite.id}/actions`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { action: 'revoke', reason: 'Accepted invites must be member-managed.', requestId: 'smoke-accepted-revoke-denied' },
    }, 409)
    const acceptedInviteActionDenial = parseBody(acceptedInviteRevokeResponse.body).inviteActionDenial
    assert.equal(acceptedInviteActionDenial.schemaVersion, 'organization.invite_action_denial.v1')
    assertOrganizationTenantIdentity(acceptedInviteActionDenial, organization.id)
    assert.equal(acceptedInviteActionDenial.actorId, 'org_smoke_owner')
    assert.equal(acceptedInviteActionDenial.actorRole, 'owner')
    assert.equal(acceptedInviteActionDenial.inviteId, invite.id)
    assert.equal(acceptedInviteActionDenial.acceptanceToken, invite.id)
    assert.equal(acceptedInviteActionDenial.inviteStatus, 'accepted')
    assert.equal(acceptedInviteActionDenial.inviteRole, 'reader')
    assert.equal(acceptedInviteActionDenial.action, 'revoke')
    assert.equal(acceptedInviteActionDenial.blockerCode, 'invite_already_accepted')
    assert.equal(acceptedInviteActionDenial.statusCode, 409)
    assert.equal(acceptedInviteActionDenial.memberManagementRoute, 'GET /api/organizations/:id/members')
    assert.deepEqual(acceptedInviteActionDenial.replacementActions, ['update_member_role', 'remove_member'])
    assert.equal(acceptedInviteActionDenial.nonmemberEnumeration, false)
    assert.ok(acceptedInviteActionDenial.safeFields.includes('inviteStatus'))
    assert.ok(acceptedInviteActionDenial.noLeakFields.includes('invite.email'))
    assert.equal(acceptedInviteActionDenial.serviceLogAction, 'organization_invite_action_denied')
    assert.equal(acceptedInviteActionDenial.requestId, 'smoke-accepted-revoke-denied')
    assert.equal(acceptedInviteActionDenial.reason, 'Accepted invites must be member-managed.')
    assert.equal(acceptedInviteActionDenial.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

    const bulkEmails = Array.from({ length: 10 }, (_, index) => `bulk-${index + 1}@example.test`)
    const bulkInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: {
            emails: bulkEmails,
            role: 'member',
            requestId: 'smoke-bulk-10',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
    }, 201)
    const bulkInviteWorkflow = journey.bulkInviteWorkflow = parseBody(bulkInviteResponse.body).workflow
    assert.equal(bulkInviteWorkflow.schemaVersion, 'organization.bulk_invite.v1')
    assert.equal(bulkInviteWorkflow.requestId, 'smoke-bulk-10')
    assert.equal(bulkInviteWorkflow.actorId, 'org_smoke_admin')
    assert.equal(bulkInviteWorkflow.organizationId, organization.id)
    assert.equal(bulkInviteWorkflow.submittedRecipientCount, 10)
    assert.equal(bulkInviteWorkflow.recipientCount, 10)
    assert.equal(bulkInviteWorkflow.normalizedRecipientCount, 10)
    assert.equal(bulkInviteWorkflow.duplicateRecipientCount, 0)
    assert.equal(bulkInviteWorkflow.invitedCount, 10)
    assert.equal(bulkInviteWorkflow.skippedCount, 0)
    assert.equal(bulkInviteWorkflow.expiresAt, parseBody(bulkInviteResponse.body).invites[0].expiresAt)
    assert.deepEqual(bulkInviteWorkflow.results.map((result: Row) => result.outcome), Array(10).fill('invited'))
    assert.ok(bulkInviteWorkflow.results.every((result: Row) => result.acceptanceToken === result.inviteId))
    assert.ok(bulkInviteWorkflow.results.every((result: Row) => result.acceptancePath === `/api/organizations/invites/${result.inviteId}/accept`))

    const duplicateBulkInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { email: bulkEmails[0], role: 'viewer', request_id: 'smoke-duplicate-bulk' },
    }, 201)
    const duplicateInviteWorkflow = parseBody(duplicateBulkInviteResponse.body).workflow
    assert.equal(duplicateInviteWorkflow.duplicateInviteCount, 1)
    assert.equal(duplicateInviteWorkflow.results[0].outcome, 'updated_pending_invite')
    assert.equal(duplicateInviteWorkflow.results[0].email, bulkEmails[0])

    const deactivatedInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { email: 'deactivated@example.test', role: 'member', requestId: 'smoke-deactivated-invite' },
    }, 201)
    const deactivatedWorkflow = parseBody(deactivatedInviteResponse.body).workflow
    assert.equal(deactivatedWorkflow.invitedCount, 0)
    assert.equal(deactivatedWorkflow.skippedCount, 1)
    assert.equal(deactivatedWorkflow.results[0].outcome, 'blocked_deactivated_user')

    const staleDeactivatedInvite = journey.staleDeactivatedInvite = nowRow({
        id: 'stale-deactivated-invite',
        organization_id: organization.id,
        email: 'deactivated@example.test',
        role: 'member',
        invited_by: 'org_smoke_owner',
        status: 'pending',
        accepted_at: null,
        accepted_by: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    invites.set(staleDeactivatedInvite.id, staleDeactivatedInvite)
    const staleDeactivatedAcceptResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/invites/${staleDeactivatedInvite.id}/accept`,
        headers: authHeaders('org_smoke_deactivated', 'deactivated-token'),
    }, 409)
    const staleDeactivatedAcceptDenial = parseBody(staleDeactivatedAcceptResponse.body).inviteAcceptanceDenial
    assert.equal(staleDeactivatedAcceptDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
    assert.equal(staleDeactivatedAcceptDenial.organizationId, organization.id)
    assert.equal(staleDeactivatedAcceptDenial.inviteId, staleDeactivatedInvite.id)
    assert.equal(staleDeactivatedAcceptDenial.inviteStatus, 'pending')
    assert.equal(staleDeactivatedAcceptDenial.userActive, false)
    assert.equal(staleDeactivatedAcceptDenial.blockerCode, 'member_deactivated')
    assert.equal(staleDeactivatedAcceptDenial.deactivatedUserDenied, true)
    assert.equal(staleDeactivatedAcceptDenial.nonmemberEnumeration, false)
    assert.ok(staleDeactivatedAcceptDenial.safeFields.includes('userActive'))

    const unknownUserInvite = journey.unknownUserInvite = nowRow({
        id: 'unknown-user-invite',
        organization_id: organization.id,
        email: 'unknown@example.test',
        role: 'reader',
        invited_by: 'org_smoke_owner',
        status: 'pending',
        accepted_at: null,
        accepted_by: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    invites.set(unknownUserInvite.id, unknownUserInvite)
    const unknownUserAcceptResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/invites/${unknownUserInvite.id}/accept`,
        headers: authHeaders('org_smoke_unknown', 'unknown-token'),
    }, 409)
    const unknownUserAcceptDenial = parseBody(unknownUserAcceptResponse.body).inviteAcceptanceDenial
    assert.equal(unknownUserAcceptDenial.inviteStatus, 'pending')
    assert.equal(unknownUserAcceptDenial.userActive, null)
    assert.equal(unknownUserAcceptDenial.blockerCode, 'invite_not_pending')
    assert.equal(invites.get(unknownUserInvite.id).status, 'pending')
    invites.delete(unknownUserInvite.id)

    const expiredInvite = journey.expiredInvite = nowRow({
        id: 'expired-invite',
        organization_id: organization.id,
        email: 'expired@example.test',
        role: 'member',
        invited_by: 'org_smoke_owner',
        status: 'pending',
        accepted_at: null,
        accepted_by: null,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
    })
    invites.set(expiredInvite.id, expiredInvite)
    const expiredAcceptResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/invites/${expiredInvite.id}/accept`,
        headers: authHeaders('org_smoke_expired', 'expired-token'),
    }, 409)
    const expiredAcceptDenial = parseBody(expiredAcceptResponse.body).inviteAcceptanceDenial
    assert.equal(expiredAcceptDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
    assert.equal(expiredAcceptDenial.organizationId, organization.id)
    assert.equal(expiredAcceptDenial.inviteId, expiredInvite.id)
    assert.equal(expiredAcceptDenial.inviteStatus, 'pending')
    assert.equal(expiredAcceptDenial.blockerCode, 'invite_expired')
    assert.ok(expiredAcceptDenial.blockedRoutes.includes('GET /api/organizations/:id/alert-case-visibility'))
    assert.ok(expiredAcceptDenial.blockedConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
    assert.equal(expiredAcceptDenial.readinessRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
    assert.equal(expiredAcceptDenial.ownerlessRecoveryMutationAllowed, false)
    assert.ok(expiredAcceptDenial.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
    assert.equal(expiredAcceptDenial.nonmemberEnumeration, false)

}
