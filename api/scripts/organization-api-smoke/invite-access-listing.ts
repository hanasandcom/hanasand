import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'

export async function runInviteAccessListing(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
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

}
