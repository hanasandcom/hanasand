import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'

export async function runOrganizationCreationAndInitialInvite(ctx: OrganizationApiSmokeContext): Promise<OrganizationSmokeJourney> {
    const { app, authHeaders, parseBody, assertOrganizationTenantIdentity } = ctx
    const journey = {} as OrganizationSmokeJourney

    const organizationResponse = await app.inject({
        method: 'POST',
        url: '/api/organizations',
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { name: 'Smoke Shared Watchlist' },
    })
    assert.equal(organizationResponse.statusCode, 201, organizationResponse.body)
    const organization = journey.organization = parseBody(organizationResponse.body).organization
    assert.equal(organization.role, 'owner')
    assert.equal(organization.memberCount, 1)
    assert.equal(organization.ownerCount, 1)
    assert.equal(organization.activeAdminCount, 1)
    assert.equal(organization.settings.defaultWebhookPolicy, 'active_destinations')
    assert.equal(organization.settings.alertVisibilityPolicy, 'members')
    assert.equal(organization.lifecycleStatus, 'active')
    assert.equal(organization.settings.lifecycleStatus, 'active')
    assert.equal(organization.settings.retentionDays, 365)
    const createdLifecycleReadiness = parseBody(organizationResponse.body).lifecycleReadiness
    assert.equal(createdLifecycleReadiness.schemaVersion, 'organization.lifecycle_readiness.v1')
    assertOrganizationTenantIdentity(createdLifecycleReadiness, organization.id)
    assert.equal(createdLifecycleReadiness.lifecycleStatus, 'active')
    assert.equal(createdLifecycleReadiness.actorRole, 'owner')
    assert.equal(createdLifecycleReadiness.counts.memberCount, 1)
    assert.equal(createdLifecycleReadiness.counts.activeAdminCount, 1)
    assert.equal(createdLifecycleReadiness.watchlistReadiness.ready, false)
    assert.equal(createdLifecycleReadiness.alertExportReadiness.ready, false)
    assert.deepEqual(createdLifecycleReadiness.typedBlockers, ['watchlist_setup_required', 'alert_export_unavailable'])
    assert.equal(createdLifecycleReadiness.memberRoleReadiness.ownerCanMutate, true)
    assert.equal(createdLifecycleReadiness.memberRoleReadiness.supportReadMode, 'redacted_support_contract_only')
    assert.equal(createdLifecycleReadiness.memberRoleReadiness.nonmemberEnumeration, false)
    assert.equal(createdLifecycleReadiness.memberRoleReadiness.revokedMemberDenial, 'member_revoked')
    assert.equal(createdLifecycleReadiness.memberRoleReadiness.expiredInviteDenial, 'invite_expired')
    assert.equal(createdLifecycleReadiness.supportVisibility.redactionBlocker, 'support_redaction_required')
    assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.schemaVersion, 'organization.workspace_boundary_readiness.v1')
    assertOrganizationTenantIdentity(createdLifecycleReadiness.workspaceBoundaryProof, organization.id)
    assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.actorRole, 'owner')
    assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.lifecycleStatus, 'active')
    assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.routes.updateSettings, 'PUT /api/organizations/:id/settings')
    assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.routes.listMembers, 'GET /api/organizations/:id/members')
    assert.deepEqual(createdLifecycleReadiness.workspaceBoundaryProof.roleGates.updateSettings, ['owner', 'admin'])
    assert.deepEqual(createdLifecycleReadiness.workspaceBoundaryProof.roleGates.readSharedWatchlists, ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'])
    assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.actorPermissions.canUpdateSettings, true)
    assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.actorPermissions.canArchiveOrganization, true)
    assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.actorPermissions.canManageInvites, true)
    assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.actorPermissions.canMutateWatchlists, true)
    assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.lifecycleMutationAllowed, true)
    assert.deepEqual(createdLifecycleReadiness.workspaceBoundaryProof.blockedWhenInactive, [])
    assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.blockerCode, null)
    assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.supportInspection.mode, 'redacted_summary_only')
    assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.nonmemberEnumeration, false)
    assert.ok(createdLifecycleReadiness.workspaceBoundaryProof.noLeakFields.includes('otherOrg.members'))
    assert.ok(createdLifecycleReadiness.blockerCatalog.includes('org_missing'))
    assert.ok(createdLifecycleReadiness.blockerCatalog.includes('org_archived'))
    assert.ok(createdLifecycleReadiness.blockerCatalog.includes('org_deleted'))
    assert.ok(createdLifecycleReadiness.blockerCatalog.includes('no_active_admin'))
    assert.ok(createdLifecycleReadiness.blockerCatalog.includes('cleanup_required'))

    const ownerReadOrganizationResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    })
    assert.equal(ownerReadOrganizationResponse.statusCode, 200, ownerReadOrganizationResponse.body)
    const ownerReadOrganization = parseBody(ownerReadOrganizationResponse.body).organization
    assert.equal(ownerReadOrganization.id, organization.id)
    assert.equal(ownerReadOrganization.role, 'owner')
    assert.equal(ownerReadOrganization.memberCount, 1)
    assert.equal(ownerReadOrganization.settings.defaultWebhookPolicy, 'active_destinations')
    assert.deepEqual(parseBody(ownerReadOrganizationResponse.body).lifecycleReadiness.typedBlockers, ['watchlist_setup_required', 'alert_export_unavailable'])
    assert.equal(parseBody(ownerReadOrganizationResponse.body).lifecycleReadiness.workspaceBoundaryProof.actorPermissions.canArchiveOrganization, true)
    assert.equal(parseBody(ownerReadOrganizationResponse.body).lifecycleReadiness.workspaceBoundaryProof.routes.readOrganization, 'GET /api/organizations/:id')

    const ownerDefaultSettingsResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/settings`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    })
    assert.equal(ownerDefaultSettingsResponse.statusCode, 200, ownerDefaultSettingsResponse.body)
    const ownerDefaultSettings = parseBody(ownerDefaultSettingsResponse.body)
    assert.equal(ownerDefaultSettings.permissions.canEdit, true)
    assert.equal(ownerDefaultSettings.settings.defaultWebhookPolicy, 'active_destinations')
    assert.equal(ownerDefaultSettings.lifecycleReadiness.counts.activeAdminCount, 1)

    const inviteResponse = await app.inject({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { email: 'member@example.test', role: 'member' },
    })
    assert.equal(inviteResponse.statusCode, 201, inviteResponse.body)
    const invite = journey.invite = parseBody(inviteResponse.body).invites[0]
    assert.equal(invite.status, 'pending')
    assert.ok(Date.parse(invite.expiresAt) > Date.now())
    assert.equal(invite.acceptanceToken, invite.id)
    assert.equal(invite.acceptancePath, `/api/organizations/invites/${invite.id}/accept`)
    const inviteWorkflow = parseBody(inviteResponse.body).workflow
    assert.equal(inviteWorkflow.results[0].acceptanceToken, invite.id)
    assert.equal(inviteWorkflow.results[0].acceptancePath, `/api/organizations/invites/${invite.id}/accept`)

    const acceptResponse = await app.inject({
        method: 'POST',
        url: `/api/organizations/invites/${invite.id}/accept`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    })
    assert.equal(acceptResponse.statusCode, 200, acceptResponse.body)
    const accepted = parseBody(acceptResponse.body)
    assert.equal(accepted.invite.status, 'accepted')
    assert.equal(accepted.invite.acceptedBy, 'org_smoke_member')
    assert.equal(accepted.invite.expiresAt, invite.expiresAt)
    assert.equal(accepted.membership.userId, 'org_smoke_member')
    assert.equal(accepted.membership.role, 'reader')
    assert.equal(accepted.inviteAcceptance.schemaVersion, 'organization.invite_acceptance.v1')
    assertOrganizationTenantIdentity(accepted.inviteAcceptance, organization.id)
    assert.equal(accepted.inviteAcceptance.inviteId, invite.id)
    assert.equal(accepted.inviteAcceptance.acceptanceToken, invite.id)
    assert.equal(accepted.inviteAcceptance.acceptancePath, `/api/organizations/invites/${invite.id}/accept`)
    assert.equal(accepted.inviteAcceptance.acceptedBy, 'org_smoke_member')
    assert.equal(accepted.inviteAcceptance.invitedBy, 'org_smoke_owner')
    assert.equal(accepted.inviteAcceptance.inviteRole, 'reader')
    assert.equal(accepted.inviteAcceptance.appliedRole, 'reader')
    assert.equal(accepted.inviteAcceptance.membershipStatus, 'active')
    assert.equal(accepted.inviteAcceptance.expiresAt, invite.expiresAt)
    assert.equal(accepted.inviteAcceptance.serviceLogAction, 'organization_invite_accepted')
    assert.deepEqual(accepted.inviteAcceptance.auditMetadataFields, ['inviteId', 'role', 'acceptedBy', 'organizationId'])
    assert.equal(accepted.inviteAcceptance.reusedInviteBlocked, true)
    assert.equal(accepted.inviteAcceptance.expiredInviteDenied, 'invite_expired')
    assert.equal(accepted.inviteAcceptance.revokedInviteDenied, 'member_revoked')
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.schemaVersion, 'organization.invite_consumer_visibility_receipt.v1')
    assertOrganizationTenantIdentity(accepted.inviteAcceptance.consumerVisibilityReceipt, organization.id)
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.inviteId, invite.id)
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.inviteStatus, 'accepted')
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.role, 'reader')
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.action, 'accept')
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.grantsConsumerAccess, true)
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.membershipStatus, 'active')
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.routes.sharedWatchlists, 'GET /api/organizations/:id/watchlists')
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.routes.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.routes.alertCaseVisibility, 'GET /api/organizations/:id/alert-case-visibility')
    assert.ok(accepted.inviteAcceptance.consumerVisibilityReceipt.availableConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
    assert.ok(accepted.inviteAcceptance.consumerVisibilityReceipt.availableConsumerContracts.includes('organization.case_visibility_consumer.v1'))
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.roleGates.canReadSharedWatchlists, true)
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.roleGates.canMutateSharedWatchlists, false)
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.downstreamReadinessGrant.schemaVersion, 'organization.invite_acceptance_downstream_grant.v1')
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.downstreamReadinessGrant.organizationId, organization.id)
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.downstreamReadinessGrant.appliedRole, 'reader')
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.downstreamReadinessGrant.grantsConsumerAccess, true)
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.downstreamReadinessGrant.sharedWatchlistReadReady, true)
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.downstreamReadinessGrant.alertGenerationExportReady, false)
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.downstreamReadinessGrant.caseVisibilityReady, true)
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.downstreamReadinessGrant.webhookDeliveryReady, false)
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.downstreamReadinessGrant.blockerReason, null)
    assert.ok(accepted.inviteAcceptance.consumerVisibilityReceipt.downstreamReadinessGrant.downstreamContracts.includes('organization.webhook_destination_delivery_consumer.v1'))
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.downstreamReadinessGrant.destinationReadiness.destinationOwnerField, 'destination.org_id')
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.downstreamReadinessGrant.destinationReadiness.crossOrgDestinationAllowed, false)
    assert.ok(accepted.inviteAcceptance.consumerVisibilityReceipt.downstreamReadinessGrant.noLeakFields.includes('otherOrg.watchlistItemIds'))
    assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.noEnumeration, true)

    const reusedInviteResponse = await app.inject({
        method: 'POST',
        url: `/api/organizations/invites/${invite.id}/accept`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    })
    assert.equal(reusedInviteResponse.statusCode, 409, reusedInviteResponse.body)
    const reusedInviteDenial = parseBody(reusedInviteResponse.body).inviteAcceptanceDenial
    assert.equal(reusedInviteDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
    assertOrganizationTenantIdentity(reusedInviteDenial, organization.id)
    assert.equal(reusedInviteDenial.inviteId, invite.id)
    assert.equal(reusedInviteDenial.acceptanceToken, invite.id)
    assert.equal(reusedInviteDenial.inviteStatus, 'accepted')
    assert.equal(reusedInviteDenial.blockerCode, 'invite_already_accepted')
    assert.equal(reusedInviteDenial.statusCode, 409)
    assert.equal(reusedInviteDenial.nonmemberEnumeration, false)
    assert.ok(reusedInviteDenial.safeFields.includes('blockerCode'))
    assert.ok(reusedInviteDenial.noLeakFields.includes('invite.email'))
    assert.equal(reusedInviteDenial.serviceLogAction, 'organization_invite_acceptance_denied')
    assert.equal(reusedInviteDenial.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

    return journey
}
