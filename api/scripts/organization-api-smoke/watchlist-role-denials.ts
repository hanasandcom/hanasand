import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'

export async function runWatchlistRoleDenials(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, members, authHeaders, parseBody, assertOrganizationTenantIdentity, nowRow, memberKey, iso } = ctx
    const { organization } = journey
    const ownerWatchlistItem = journey.ownerWatchlistItem!

    const viewerWatchlistResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    }, 200)
    assert.equal(parseBody(viewerWatchlistResponse.body).watchlistItems.length, 1)

    members.set(memberKey(organization.id, 'org_smoke_deactivated'), nowRow({
        organization_id: organization.id,
        user_id: 'org_smoke_deactivated',
        role: 'reader',
        status: 'active',
        invited_by: 'org_smoke_admin',
        joined_at: iso(),
    }))
    await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_deactivated', 'deactivated-token'),
    }, 404)

    const viewerAddsWatchlistResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
        payload: { kind: 'company', value: 'Viewer Blocked Holdings', reason: 'Viewer cannot mutate shared terms.', requestId: 'smoke-viewer-watchlist-create-denied' },
    }, 403)
    const viewerAddsWatchlistDenied = parseBody(viewerAddsWatchlistResponse.body).watchlistMutationDenial
    assert.equal(viewerAddsWatchlistDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
    assertOrganizationTenantIdentity(viewerAddsWatchlistDenied, organization.id)
    assert.equal(viewerAddsWatchlistDenied.actorId, 'org_smoke_viewer')
    assert.equal(viewerAddsWatchlistDenied.actorRole, 'reader')
    assert.equal(viewerAddsWatchlistDenied.action, 'create_watchlist')
    assert.equal(viewerAddsWatchlistDenied.itemId, null)
    assert.equal(viewerAddsWatchlistDenied.denialReason, 'role_not_allowed')
    assert.deepEqual(viewerAddsWatchlistDenied.allowedRoles, ['owner', 'admin', 'editor'])
    assert.deepEqual(viewerAddsWatchlistDenied.readRoles, ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'])
    assert.equal(viewerAddsWatchlistDenied.memberCanReadSharedWatchlists, true)
    assert.equal(viewerAddsWatchlistDenied.memberCanMutateSharedWatchlists, false)
    assert.equal(viewerAddsWatchlistDenied.viewerCanReadSharedWatchlists, true)
    assert.equal(viewerAddsWatchlistDenied.viewerCanMutateSharedWatchlists, false)
    assert.equal(viewerAddsWatchlistDenied.downstreamRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
    assert.equal(viewerAddsWatchlistDenied.downstreamRefs.alertGenerationConsumer, 'organization.watchlist_alert_generation_consumer.v1')
    assert.equal(viewerAddsWatchlistDenied.downstreamRefs.alertCasePersistence, 'organization.alert_case_bridge_persistence_receipt.v1')
    assert.equal(viewerAddsWatchlistDenied.downstreamRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
    assert.equal(viewerAddsWatchlistDenied.deniedMutationDoesNotAffectActiveTerms, true)
    assert.equal(viewerAddsWatchlistDenied.activeExportRemainsAvailableToAllowedRoles, true)
    assert.ok(viewerAddsWatchlistDenied.noLeakFields.includes('otherOrg.watchlistItemIds'))
    assert.ok(viewerAddsWatchlistDenied.noLeakFields.includes('destination.secret'))
    assert.equal(viewerAddsWatchlistDenied.nonmemberEnumeration, false)
    assert.equal(viewerAddsWatchlistDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
    assert.equal(viewerAddsWatchlistDenied.requestId, 'smoke-viewer-watchlist-create-denied')
    assert.equal(viewerAddsWatchlistDenied.reason, 'Viewer cannot mutate shared terms.')
    assert.equal(viewerAddsWatchlistDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

    const memberAddsWatchlistDeniedResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_member', 'member-token'),
        payload: { kind: 'keyword', value: 'member should not mutate', reason: 'Member cannot create shared terms.', requestId: 'smoke-member-watchlist-create-denied' },
    }, 403)
    const memberAddsWatchlistDenied = parseBody(memberAddsWatchlistDeniedResponse.body).watchlistMutationDenial
    assert.equal(memberAddsWatchlistDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
    assert.equal(memberAddsWatchlistDenied.organizationId, organization.id)
    assert.equal(memberAddsWatchlistDenied.actorId, 'org_smoke_member')
    assert.equal(memberAddsWatchlistDenied.actorRole, 'reader')
    assert.equal(memberAddsWatchlistDenied.action, 'create_watchlist')
    assert.equal(memberAddsWatchlistDenied.itemId, null)
    assert.equal(memberAddsWatchlistDenied.denialReason, 'role_not_allowed')
    assert.deepEqual(memberAddsWatchlistDenied.allowedRoles, ['owner', 'admin', 'editor'])
    assert.deepEqual(memberAddsWatchlistDenied.readRoles, ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'])
    assert.equal(memberAddsWatchlistDenied.memberCanReadSharedWatchlists, true)
    assert.equal(memberAddsWatchlistDenied.memberCanMutateSharedWatchlists, false)
    assert.equal(memberAddsWatchlistDenied.nonmemberEnumeration, false)
    assert.equal(memberAddsWatchlistDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
    assert.equal(memberAddsWatchlistDenied.requestId, 'smoke-member-watchlist-create-denied')
    assert.equal(memberAddsWatchlistDenied.reason, 'Member cannot create shared terms.')

    const viewerArchiveWatchlistResponse = await apiRequest({
        method: 'DELETE',
        url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}?requestId=smoke-viewer-watchlist-archive-denied`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
        payload: { reason: 'Viewer cannot archive shared terms.' },
    }, 403)
    const viewerArchiveWatchlistDenied = parseBody(viewerArchiveWatchlistResponse.body).watchlistMutationDenial
    assert.equal(viewerArchiveWatchlistDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
    assert.equal(viewerArchiveWatchlistDenied.organizationId, organization.id)
    assert.equal(viewerArchiveWatchlistDenied.actorId, 'org_smoke_viewer')
    assert.equal(viewerArchiveWatchlistDenied.actorRole, 'reader')
    assert.equal(viewerArchiveWatchlistDenied.action, 'archive_watchlist')
    assert.equal(viewerArchiveWatchlistDenied.itemId, ownerWatchlistItem.id)
    assert.equal(viewerArchiveWatchlistDenied.denialReason, 'role_not_allowed')
    assert.equal(viewerArchiveWatchlistDenied.viewerCanReadSharedWatchlists, true)
    assert.equal(viewerArchiveWatchlistDenied.viewerCanMutateSharedWatchlists, false)
    assert.equal(viewerArchiveWatchlistDenied.nonmemberEnumeration, false)
    assert.equal(viewerArchiveWatchlistDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
    assert.equal(viewerArchiveWatchlistDenied.requestId, 'smoke-viewer-watchlist-archive-denied')
    assert.equal(viewerArchiveWatchlistDenied.reason, 'Viewer cannot archive shared terms.')


}
