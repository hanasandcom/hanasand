import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function runInviteListingAndSettings(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody, assertOrganizationTenantIdentity } = ctx
    const { organization } = journey

    const pendingInvitesResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    }, 200)
    const emptyPendingInvitesBody = parseBody(pendingInvitesResponse.body)
    assert.deepEqual(emptyPendingInvitesBody.invites, [])
    assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.schemaVersion, 'organization.invite_list_contract.v1')
    assertOrganizationTenantIdentity(emptyPendingInvitesBody.inviteLifecycleContract, organization.id)
    assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.actor.role, 'owner')
    assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.actor.canCreateInvites, true)
    assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.counts.pendingInviteCount, 0)
    assert.deepEqual(emptyPendingInvitesBody.inviteLifecycleContract.supportedRoles, ['admin', 'editor', 'reader'])
    assert.deepEqual(emptyPendingInvitesBody.inviteLifecycleContract.supportedActions, ['revoke', 'resend'])
    assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.lifecycleDenials.expiredInvite, 'invite_expired')
    assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.lifecycleDenials.nonmemberEnumeration, false)
    assert.ok(emptyPendingInvitesBody.inviteLifecycleContract.audit.eventActions.includes('organization_invite_resent'))
    assert.ok(emptyPendingInvitesBody.inviteLifecycleContract.noLeakFields.includes('otherOrg.invites'))

    const memberListInvitesDeniedResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/invites?requestId=smoke-member-invite-list-denied`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 403)
    const memberListInvitesDenied = parseBody(memberListInvitesDeniedResponse.body).inviteManagementDenial
    assert.equal(memberListInvitesDenied.schemaVersion, 'organization.invite_management_denial.v1')
    assertOrganizationTenantIdentity(memberListInvitesDenied, organization.id)
    assert.equal(memberListInvitesDenied.actorId, 'org_smoke_member')
    assert.equal(memberListInvitesDenied.actorRole, 'reader')
    assert.equal(memberListInvitesDenied.action, 'list_invites')
    assert.equal(memberListInvitesDenied.inviteId, null)
    assert.equal(memberListInvitesDenied.denialReason, 'role_not_allowed')
    assert.deepEqual(memberListInvitesDenied.allowedRoles, ['owner', 'admin'])
    assert.deepEqual(memberListInvitesDenied.readRoles, ['owner', 'admin'])
    assert.equal(memberListInvitesDenied.memberCanListInvites, false)
    assert.equal(memberListInvitesDenied.memberCanCreateInvites, false)
    assert.equal(memberListInvitesDenied.nonmemberEnumeration, false)
    assert.ok(memberListInvitesDenied.safeFields.includes('action'))
    assert.ok(memberListInvitesDenied.noLeakFields.includes('pendingInvites[]'))
    assert.equal(memberListInvitesDenied.serviceLogAction, 'organization_invite_management_denied')
    assert.equal(memberListInvitesDenied.requestId, 'smoke-member-invite-list-denied')

    const existingMemberInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { email: 'member@example.test', role: 'viewer', requestId: 'smoke-existing-member' },
    }, 201)
    const existingMemberInviteWorkflow = parseBody(existingMemberInviteResponse.body).workflow
    assert.equal(existingMemberInviteWorkflow.invitedCount, 0)
    assert.equal(existingMemberInviteWorkflow.skippedCount, 1)
    assert.equal(existingMemberInviteWorkflow.results[0].outcome, 'already_member')
    assert.equal(existingMemberInviteWorkflow.results[0].memberRole, 'reader')

    const duplicateRecipientInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: {
            emails: ['member@example.test', 'MEMBER@example.test'],
            role: 'viewer',
            requestId: 'smoke-duplicate-recipient-dedupe',
        },
    }, 201)
    const duplicateRecipientWorkflow = parseBody(duplicateRecipientInviteResponse.body).workflow
    assert.equal(duplicateRecipientWorkflow.schemaVersion, 'organization.bulk_invite.v1')
    assert.equal(duplicateRecipientWorkflow.submittedRecipientCount, 2)
    assert.equal(duplicateRecipientWorkflow.recipientCount, 1)
    assert.equal(duplicateRecipientWorkflow.normalizedRecipientCount, 1)
    assert.equal(duplicateRecipientWorkflow.duplicateRecipientCount, 1)
    assert.equal(duplicateRecipientWorkflow.invitedCount, 0)
    assert.equal(duplicateRecipientWorkflow.skippedCount, 1)
    assert.equal(duplicateRecipientWorkflow.results[0].email, 'member@example.test')
    assert.equal(duplicateRecipientWorkflow.results[0].outcome, 'already_member')

    const memberInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_member', 'member-token'),
        payload: { email: 'blocked-by-member@example.test', role: 'member', requestId: 'smoke-member-invite-create-denied' },
    }, 403)
    const memberInviteDenied = parseBody(memberInviteResponse.body).inviteManagementDenial
    assert.equal(memberInviteDenied.schemaVersion, 'organization.invite_management_denial.v1')
    assertOrganizationTenantIdentity(memberInviteDenied, organization.id)
    assert.equal(memberInviteDenied.actorId, 'org_smoke_member')
    assert.equal(memberInviteDenied.actorRole, 'reader')
    assert.equal(memberInviteDenied.action, 'create_invite')
    assert.equal(memberInviteDenied.inviteId, null)
    assert.equal(memberInviteDenied.denialReason, 'role_not_allowed')
    assert.deepEqual(memberInviteDenied.allowedRoles, ['owner', 'admin'])
    assert.deepEqual(memberInviteDenied.readRoles, ['owner', 'admin'])
    assert.equal(memberInviteDenied.memberCanListInvites, false)
    assert.equal(memberInviteDenied.memberCanCreateInvites, false)
    assert.equal(memberInviteDenied.viewerCanListInvites, false)
    assert.equal(memberInviteDenied.viewerCanCreateInvites, false)
    assert.equal(memberInviteDenied.nonmemberEnumeration, false)
    assert.ok(memberInviteDenied.safeFields.includes('actorRole'))
    assert.ok(memberInviteDenied.noLeakFields.includes('pendingInvites[]'))
    assert.equal(memberInviteDenied.serviceLogAction, 'organization_invite_management_denied')
    assert.equal(memberInviteDenied.requestId, 'smoke-member-invite-create-denied')
    assert.equal(memberInviteDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

    const adminInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { email: 'admin@example.test', role: 'admin' },
    }, 201)
    const adminInvite = parseBody(adminInviteResponse.body).invites[0]

    const adminAcceptResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/invites/${adminInvite.id}/accept`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    assert.equal(parseBody(adminAcceptResponse.body).membership.role, 'admin')
    assert.equal(parseBody(adminAcceptResponse.body).inviteAcceptance.inviteRole, 'admin')
    assert.equal(parseBody(adminAcceptResponse.body).inviteAcceptance.appliedRole, 'admin')

    const lastOwnerRoleChangeDeniedResponse = await apiRequest({
        method: 'PATCH',
        url: `/api/organizations/${organization.id}/members/org_smoke_owner/role`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { role: 'admin', reason: 'Cannot demote the only owner.', requestId: 'smoke-last-owner-role-denied' },
    }, 409)
    const lastOwnerRoleGuard = parseBody(lastOwnerRoleChangeDeniedResponse.body).lastOwnerGuard
    assert.equal(lastOwnerRoleGuard.schemaVersion, 'organization.last_owner_guard.v1')
    assert.equal(lastOwnerRoleGuard.organizationId, organization.id)
    assert.equal(lastOwnerRoleGuard.actorId, 'org_smoke_owner')
    assert.equal(lastOwnerRoleGuard.actorRole, 'owner')
    assert.equal(lastOwnerRoleGuard.targetUserId, 'org_smoke_owner')
    assert.equal(lastOwnerRoleGuard.action, 'change_owner_role')
    assert.equal(lastOwnerRoleGuard.requestedRole, 'admin')
    assert.equal(lastOwnerRoleGuard.ownerCount, 1)
    assert.equal(lastOwnerRoleGuard.blockerCode, 'last_owner_guard')
    assert.equal(lastOwnerRoleGuard.transferOwnershipRoute, 'POST /api/organizations/:id/ownership-transfer')
    assert.equal(lastOwnerRoleGuard.transferOwnershipRequired, true)
    assert.equal(lastOwnerRoleGuard.noOrphanedOrganization, true)
    assert.equal(lastOwnerRoleGuard.serviceLogAction, 'organization_last_owner_guard_blocked')
    assert.equal(lastOwnerRoleGuard.requestId, 'smoke-last-owner-role-denied')

    const viewerInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { email: 'viewer@example.test', role: 'viewer' },
    }, 201)
    const viewerInvite = parseBody(viewerInviteResponse.body).invites[0]
    assert.equal(viewerInvite.role, 'reader')

    for (const [userId, token] of [['org_smoke_owner', 'owner-token'], ['org_smoke_admin', 'admin-token']] as const) {
        const pendingForManager = await apiRequest({
            method: 'GET',
            url: `/api/organizations/${organization.id}/invites`,
            headers: authHeaders(userId, token),
        }, 200)
        const pendingForManagerBody = parseBody(pendingForManager.body)
        assert.deepEqual(pendingForManagerBody.invites.map((pendingInvite: Row) => pendingInvite.id), [viewerInvite.id])
        assert.equal(pendingForManagerBody.inviteLifecycleContract.actor.role, userId === 'org_smoke_owner' ? 'owner' : 'admin')
        assert.equal(pendingForManagerBody.inviteLifecycleContract.actor.canListPendingInvites, true)
        assert.equal(pendingForManagerBody.inviteLifecycleContract.actor.canRevokeInvites, true)
        assert.equal(pendingForManagerBody.inviteLifecycleContract.counts.pendingInviteCount, 1)
        assert.equal(pendingForManagerBody.inviteLifecycleContract.counts.pendingViewerCount, 0)
        assert.equal(pendingForManagerBody.inviteLifecycleContract.routes.acceptInvite, 'POST /api/organizations/invites/:inviteId/accept')
        assert.equal(pendingForManagerBody.inviteLifecycleContract.acceptanceTokenField, 'invite.acceptanceToken')
    }

    const viewerAcceptResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/invites/${viewerInvite.id}/accept`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    }, 200)
    assert.equal(parseBody(viewerAcceptResponse.body).membership.role, 'reader')
    assert.equal(parseBody(viewerAcceptResponse.body).inviteAcceptance.inviteRole, 'reader')
    assert.equal(parseBody(viewerAcceptResponse.body).inviteAcceptance.appliedRole, 'reader')

    await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
        payload: { email: 'blocked-by-viewer@example.test', role: 'member' },
    }, 403)

    await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/settings`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { name: '', defaultWebhookPolicy: 'everything' },
    }, 400)

    const memberSettingsUpdateResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/settings`,
        headers: { ...authHeaders('org_smoke_member', 'member-token'), 'x-request-id': 'smoke-member-settings-denied' },
        payload: { alertVisibilityPolicy: 'admins' },
    }, 403)
    const memberSettingsDenied = parseBody(memberSettingsUpdateResponse.body).settingsMutationDenial
    assert.equal(memberSettingsDenied.schemaVersion, 'organization.settings_mutation_denial.v1')
    assertOrganizationTenantIdentity(memberSettingsDenied, organization.id)
    assert.equal(memberSettingsDenied.actorId, 'org_smoke_member')
    assert.equal(memberSettingsDenied.actorRole, 'reader')
    assert.deepEqual(memberSettingsDenied.attemptedFields, ['alertVisibilityPolicy'])
    assert.equal(memberSettingsDenied.denialReason, 'role_not_allowed')
    assert.deepEqual(memberSettingsDenied.allowedRoles, ['owner', 'admin'])
    assert.deepEqual(memberSettingsDenied.readableRoles, ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'])
    assert.ok(memberSettingsDenied.editableFields.includes('defaultWebhookPolicy'))
    assert.ok(memberSettingsDenied.editableFields.includes('alertVisibilityPolicy'))
    assert.equal(memberSettingsDenied.memberCanReadSettings, true)
    assert.equal(memberSettingsDenied.memberCanUpdateSettings, false)
    assert.equal(memberSettingsDenied.viewerCanReadSettings, true)
    assert.equal(memberSettingsDenied.viewerCanUpdateSettings, false)
    assert.equal(memberSettingsDenied.nonmemberEnumeration, false)
    assert.ok(memberSettingsDenied.safeFields.includes('attemptedFields'))
    assert.ok(memberSettingsDenied.noLeakFields.includes('destination.secret'))
    assert.equal(memberSettingsDenied.serviceLogAction, 'organization_settings_mutation_denied')
    assert.equal(memberSettingsDenied.requestId, 'smoke-member-settings-denied')
    assert.equal(memberSettingsDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

    const viewerSettingsUpdateResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/settings`,
        headers: { ...authHeaders('org_smoke_viewer', 'viewer-token'), 'x-request-id': 'smoke-viewer-settings-denied' },
        payload: { defaultWebhookPolicy: 'disabled' },
    }, 403)
    const viewerSettingsDenied = parseBody(viewerSettingsUpdateResponse.body).settingsMutationDenial
    assert.equal(viewerSettingsDenied.schemaVersion, 'organization.settings_mutation_denial.v1')
    assert.equal(viewerSettingsDenied.organizationId, organization.id)
    assert.equal(viewerSettingsDenied.actorId, 'org_smoke_viewer')
    assert.equal(viewerSettingsDenied.actorRole, 'reader')
    assert.deepEqual(viewerSettingsDenied.attemptedFields, ['defaultWebhookPolicy'])
    assert.equal(viewerSettingsDenied.denialReason, 'role_not_allowed')
    assert.equal(viewerSettingsDenied.viewerCanReadSettings, true)
    assert.equal(viewerSettingsDenied.viewerCanUpdateSettings, false)
    assert.equal(viewerSettingsDenied.nonmemberEnumeration, false)
    assert.equal(viewerSettingsDenied.serviceLogAction, 'organization_settings_mutation_denied')
    assert.equal(viewerSettingsDenied.requestId, 'smoke-viewer-settings-denied')

    const adminSettingsResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/settings`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: {
            name: 'Smoke Shared Operations',
            slug: 'shared-ops',
            defaultWebhookPolicy: 'manual_selection',
            alertVisibilityPolicy: 'admins',
            retentionDays: 180,
            auditSafeMetadata: { region: 'EU', plan: 'team' },
        },
    }, 200)
    const adminSettings = parseBody(adminSettingsResponse.body)
    assert.equal(adminSettings.organization.name, 'Smoke Shared Operations')
    assert.equal(adminSettings.organization.slug, 'shared-ops')
    assert.equal(adminSettings.settings.defaultWebhookPolicy, 'manual_selection')
    assert.equal(adminSettings.settings.alertVisibilityPolicy, 'admins')
    assert.equal(adminSettings.settings.lifecycleStatus, 'active')
    assert.equal(adminSettings.settings.retentionDays, 180)
    assert.deepEqual(adminSettings.settings.auditSafeMetadata, { region: 'EU', plan: 'team' })
    assert.equal(adminSettings.permissions.canEdit, true)

    const memberReadUpdatedOrganizationResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 200)
    const memberReadUpdatedOrganization = parseBody(memberReadUpdatedOrganizationResponse.body).organization
    assert.equal(memberReadUpdatedOrganization.name, 'Smoke Shared Operations')
    assert.equal(memberReadUpdatedOrganization.slug, 'shared-ops')
    assert.equal(memberReadUpdatedOrganization.role, 'reader')
    assert.equal(memberReadUpdatedOrganization.settings.defaultWebhookPolicy, 'manual_selection')
    assert.equal(memberReadUpdatedOrganization.settings.alertVisibilityPolicy, 'admins')
    assert.equal(memberReadUpdatedOrganization.settings.lifecycleStatus, 'active')
    const memberReadLifecycle = parseBody(memberReadUpdatedOrganizationResponse.body).lifecycleReadiness
    assert.equal(memberReadLifecycle.actorRole, 'reader')
    assert.equal(memberReadLifecycle.memberRoleReadiness.ownerCanMutate, false)
    assert.equal(memberReadLifecycle.memberRoleReadiness.adminCanMutate, false)
    assert.equal(memberReadLifecycle.memberRoleReadiness.memberCanReadAndExport, true)

    for (const [userId, token, canEdit] of [
        ['org_smoke_member', 'member-token', false],
        ['org_smoke_viewer', 'viewer-token', false],
    ] as const) {
        const readSettingsResponse = await apiRequest({
            method: 'GET',
            url: `/api/organizations/${organization.id}/settings`,
            headers: authHeaders(userId, token),
        }, 200)
        const readableSettings = parseBody(readSettingsResponse.body)
        assert.equal(readableSettings.settings.defaultWebhookPolicy, 'manual_selection')
        assert.equal(readableSettings.settings.alertVisibilityPolicy, 'admins')
        assert.equal(readableSettings.permissions.canEdit, canEdit)
        assert.equal(readableSettings.lifecycleReadiness.supportVisibility.mode, 'redacted_summary_only')
    }

    await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/settings`,
        headers: authHeaders('org_smoke_outsider', 'outsider-token'),
    }, 404)

}
