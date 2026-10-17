import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'

export async function runMemberRoleChanges(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody, assertOrganizationTenantIdentity } = ctx
    const { organization } = journey

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


}
