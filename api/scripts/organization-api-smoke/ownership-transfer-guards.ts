import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'

export async function assertOwnershipTransferGuards(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody } = ctx
    const { organization } = journey

    const memberRemoveViewerResponse = await apiRequest({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/members/org_smoke_viewer`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 403)
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

    const adminRemoveOwnerResponse = await apiRequest({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/members/org_smoke_owner`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 403)
    const adminRemoveOwnerDenial = parseBody(adminRemoveOwnerResponse.body).memberMutationDenial
    assert.equal(adminRemoveOwnerDenial.actorRole, 'admin')
    assert.equal(adminRemoveOwnerDenial.targetUserId, 'org_smoke_owner')
    assert.equal(adminRemoveOwnerDenial.targetRole, 'owner')
    assert.equal(adminRemoveOwnerDenial.action, 'remove_member')
    assert.equal(adminRemoveOwnerDenial.adminCanMutateOwners, false)

    await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/ownership-transfer`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
        payload: { targetUserId: 'org_smoke_admin', reason: 'Viewer should not transfer ownership.' },
    }, 403)

    await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/ownership-transfer`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { targetUserId: 'org_smoke_admin' },
    }, 400)

    const transferResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/ownership-transfer`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { targetUserId: 'org_smoke_admin', reason: 'Customer primary owner changed.' },
    }, 200)
    const transfer = parseBody(transferResponse.body)
    assert.equal(transfer.transfer.previousOwnerId, 'org_smoke_owner')
    assert.equal(transfer.transfer.newOwnerId, 'org_smoke_admin')
    assert.equal(transfer.member.role, 'owner')
    assert.equal(transfer.organization.role, 'admin')
    assert.equal(transfer.organization.ownerCount, 1)

    await apiRequest({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/members/org_smoke_admin`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    }, 403)

    const lastOwnerGuardResponse = await apiRequest({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/members/org_smoke_admin`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 409)
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

}
