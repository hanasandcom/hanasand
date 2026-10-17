import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function runInviteAcceptanceListing(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody } = ctx
    const { organization } = journey

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

}
