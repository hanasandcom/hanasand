import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function runMemberAccessContract(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody, assertOrganizationTenantIdentity } = ctx
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


}
