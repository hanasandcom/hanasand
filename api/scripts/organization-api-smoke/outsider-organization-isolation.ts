import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'

export async function assertOutsiderOrganizationIsolation(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody, assertOrganizationTenantIdentity, serviceLogs } = ctx
    const { organization, invite } = journey
    const ownerWatchlistItem = journey.ownerWatchlistItem!
    const pendingOpsInvite = journey.pendingOpsInvite!
    const staleDeactivatedInvite = journey.staleDeactivatedInvite!
    const unknownUserInvite = journey.unknownUserInvite!
    const expiredInvite = journey.expiredInvite!
    const staleRemovedViewerInvite = journey.staleRemovedViewerInvite!
    const viewerPendingInviteBeforeRemoval = journey.viewerPendingInviteBeforeRemoval!

    const outsiderResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: { ...authHeaders('org_smoke_outsider', 'outsider-token'), 'x-request-id': 'smoke-outsider-watchlists-denied' },
    }, 404)
    const outsiderWatchlistsAccessDenial = parseBody(outsiderResponse.body).organizationAccessDenial
    assert.equal(outsiderWatchlistsAccessDenial.schemaVersion, 'organization.access_denial.v1')
    assert.equal(outsiderWatchlistsAccessDenial.organizationId, organization.id)
    assert.equal(outsiderWatchlistsAccessDenial.actorId, 'org_smoke_outsider')
    assert.equal(outsiderWatchlistsAccessDenial.route, 'GET /api/organizations/:id/watchlists')
    assert.equal(outsiderWatchlistsAccessDenial.blockerCode, 'nonmember_denied')
    assert.equal(outsiderWatchlistsAccessDenial.nonmemberEnumeration, false)
    assert.ok(outsiderWatchlistsAccessDenial.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
    assert.equal(outsiderWatchlistsAccessDenial.requestId, 'smoke-outsider-watchlists-denied')
    const outsiderOrganizationReadResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}`,
        headers: { ...authHeaders('org_smoke_outsider', 'outsider-token'), 'x-request-id': 'smoke-outsider-org-read-denied' },
    }, 404)
    const outsiderOrganizationAccessDenial = parseBody(outsiderOrganizationReadResponse.body).organizationAccessDenial
    assert.equal(outsiderOrganizationAccessDenial.schemaVersion, 'organization.access_denial.v1')
    assertOrganizationTenantIdentity(outsiderOrganizationAccessDenial, organization.id)
    assert.equal(outsiderOrganizationAccessDenial.actorId, 'org_smoke_outsider')
    assert.equal(outsiderOrganizationAccessDenial.route, 'GET /api/organizations/:id')
    assert.equal(outsiderOrganizationAccessDenial.blockerCode, 'nonmember_denied')
    assert.equal(outsiderOrganizationAccessDenial.denialReason, 'not_member')
    assert.equal(outsiderOrganizationAccessDenial.nonmemberEnumeration, false)
    assert.ok(outsiderOrganizationAccessDenial.noLeakFields.includes('activeTerms[]'))
    assert.ok(outsiderOrganizationAccessDenial.downstreamRoutes.alertTermsExport.includes('watchlists/alert-terms'))
    assert.equal(outsiderOrganizationAccessDenial.serviceLogAction, 'organization_access_denied')
    assert.equal(outsiderOrganizationAccessDenial.requestId, 'smoke-outsider-org-read-denied')
    const outsiderReadinessResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-readiness`,
        headers: { ...authHeaders('org_smoke_outsider', 'outsider-token'), 'x-request-id': 'smoke-outsider-alert-readiness-denied' },
    }, 404)
    const outsiderReadinessAccessDenial = parseBody(outsiderReadinessResponse.body).organizationAccessDenial
    assert.equal(outsiderReadinessAccessDenial.schemaVersion, 'organization.access_denial.v1')
    assert.equal(outsiderReadinessAccessDenial.route, 'GET /api/organizations/:id/alert-readiness')
    assert.equal(outsiderReadinessAccessDenial.blockerCode, 'nonmember_denied')
    assert.equal(outsiderReadinessAccessDenial.nonmemberEnumeration, false)
    assert.ok(outsiderReadinessAccessDenial.noLeakFields.includes('activeTerms[]'))
    assert.equal(outsiderReadinessAccessDenial.requestId, 'smoke-outsider-alert-readiness-denied')
    const outsiderAlertTermsResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms`,
        headers: { ...authHeaders('org_smoke_outsider', 'outsider-token'), 'x-request-id': 'smoke-outsider-alert-terms-denied' },
    }, 404)
    const outsiderAlertTermsAccessDenial = parseBody(outsiderAlertTermsResponse.body).organizationAccessDenial
    assert.equal(outsiderAlertTermsAccessDenial.schemaVersion, 'organization.access_denial.v1')
    assert.equal(outsiderAlertTermsAccessDenial.route, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.equal(outsiderAlertTermsAccessDenial.blockerCode, 'nonmember_denied')
    assert.equal(outsiderAlertTermsAccessDenial.nonmemberEnumeration, false)
    assert.ok(outsiderAlertTermsAccessDenial.noLeakFields.includes('activeTerms[]'))
    assert.ok(!('alertTermsExport' in parseBody(outsiderAlertTermsResponse.body)))
    assert.equal(outsiderAlertTermsAccessDenial.requestId, 'smoke-outsider-alert-terms-denied')
    await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}`,
        headers: authHeaders('org_smoke_outsider', 'outsider-token'),
    }, 404)
    await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists/cleanup`,
        headers: authHeaders('org_smoke_outsider', 'outsider-token'),
        payload: { itemIds: [ownerWatchlistItem.id], reason: 'Outsider cannot clean up.', requestId: 'smoke-outsider-cleanup-denied' },
    }, 404)
    assert.ok(serviceLogs.some(log => log.message === 'organization_invites_created'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_accepted'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_upserted'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_updated' && log.metadata.requestId === 'smoke-keyword-update'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_paused' && log.metadata.requestId === 'smoke-pause-company'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_resumed' && log.metadata.requestId === 'smoke-resume-company'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_archived' && log.metadata.requestId === 'smoke-disable-actor'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_restored' && log.metadata.requestId === 'smoke-restore-cleanup-keyword'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-viewer-watchlist-create-denied' && log.metadata.action === 'create_watchlist' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-member-watchlist-create-denied' && log.metadata.action === 'create_watchlist' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-viewer-watchlist-archive-denied' && log.metadata.action === 'archive_watchlist' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-member-watchlist-update-denied' && log.metadata.action === 'update_watchlist' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-member-cleanup-denied' && log.metadata.action === 'cleanup_watchlists' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_lookup_denied' && log.metadata.action === 'read_watchlist' && log.metadata.itemId === ownerWatchlistItem.id && log.metadata.blockerCode === 'watchlist_not_found_or_cross_org'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_lookup_denied' && log.metadata.requestId === 'smoke-wrong-org-watchlist-update-denied' && log.metadata.action === 'update_watchlist' && log.metadata.blockerCode === 'watchlist_not_found_or_cross_org'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_lookup_denied' && log.metadata.requestId === 'smoke-archived-watchlist-update-denied' && log.metadata.action === 'update_watchlist' && log.metadata.blockerCode === 'watchlist_not_found_or_cross_org'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_access_denied' && log.metadata.requestId === 'smoke-outsider-org-read-denied' && log.metadata.blockerCode === 'nonmember_denied'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_access_denied' && log.metadata.requestId === 'smoke-outsider-watchlists-denied' && log.metadata.route === 'GET /api/organizations/:id/watchlists' && log.metadata.blockerCode === 'nonmember_denied'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_access_denied' && log.metadata.requestId === 'smoke-outsider-alert-readiness-denied' && log.metadata.route === 'GET /api/organizations/:id/alert-readiness' && log.metadata.blockerCode === 'nonmember_denied'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_access_denied' && log.metadata.requestId === 'smoke-outsider-alert-terms-denied' && log.metadata.route === 'GET /api/organizations/:id/watchlists/alert-terms' && log.metadata.blockerCode === 'nonmember_denied'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_exported' && log.metadata.requestId === 'smoke-alert-terms-ready'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_export_denied' && log.metadata.requestId === 'smoke-viewer-alert-terms-denied' && log.metadata.denialReason === 'role_not_allowed'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_export_denied' && log.metadata.requestId === 'smoke-alert-terms-paused' && log.metadata.role === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_export_denied' && log.metadata.requestId === 'smoke-member-alert-terms-ready' && log.metadata.allowedRoles.includes('admin')))
    assert.ok(serviceLogs.some(log => log.message === 'organization_alert_case_visibility_denied' && log.metadata.requestId === 'smoke-member-alert-case-denied' && log.metadata.denialReason === 'role_not_allowed' && log.metadata.allowedRoles.includes('admin')))
    assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_cleanup_archived' && log.metadata.requestId === 'smoke-proof-cleanup'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invites_created' && log.metadata.role === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invites_created' && log.metadata.requestId === 'smoke-duplicate-recipient-dedupe' && log.metadata.submittedRecipientCount === 2 && log.metadata.recipientCount === 1 && log.metadata.duplicateRecipientCount === 1))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_accepted' && log.metadata.role === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === invite.id && log.metadata.blockerCode === 'invite_already_accepted'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === pendingOpsInvite.id && log.metadata.blockerCode === 'member_revoked'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === staleDeactivatedInvite.id && log.metadata.blockerCode === 'member_deactivated'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === unknownUserInvite.id && log.metadata.blockerCode === 'invite_not_pending'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === expiredInvite.id && log.metadata.blockerCode === 'invite_expired'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === staleRemovedViewerInvite.id && log.metadata.blockerCode === 'member_revoked'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_action_denied' && log.metadata.inviteId === invite.id && log.metadata.requestId === 'smoke-accepted-revoke-denied' && log.metadata.blockerCode === 'invite_already_accepted'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_management_denied' && log.metadata.requestId === 'smoke-member-invite-list-denied' && log.metadata.action === 'list_invites' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_management_denied' && log.metadata.requestId === 'smoke-member-invite-create-denied' && log.metadata.action === 'create_invite' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_management_denied' && log.metadata.requestId === 'smoke-viewer-revoke-denied' && log.metadata.action === 'revoke_invite' && log.metadata.actorRole === 'reader'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_revoked' && log.metadata.requestId === 'smoke-revoke-pending-ops'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_invite_resent' && log.metadata.requestId === 'smoke-resend-pending-ops'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_settings_mutation_denied' && log.metadata.requestId === 'smoke-member-settings-denied' && log.metadata.actorRole === 'reader' && log.metadata.attemptedFields.includes('alertVisibilityPolicy')))
    assert.ok(serviceLogs.some(log => log.message === 'organization_settings_mutation_denied' && log.metadata.requestId === 'smoke-viewer-settings-denied' && log.metadata.actorRole === 'reader' && log.metadata.attemptedFields.includes('defaultWebhookPolicy')))
    assert.ok(serviceLogs.some(log => log.message === 'organization_settings_updated' && log.metadata.fields.includes('defaultWebhookPolicy')))
    assert.ok(serviceLogs.some(log => log.message === 'organization_ownership_transferred' && log.metadata.targetUserId === 'org_smoke_admin'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_member_removed' && log.metadata.targetUserId === 'org_smoke_viewer'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_member_removed' && log.metadata.targetUserId === 'org_smoke_viewer' && log.metadata.revokedInviteCount === 1 && log.metadata.revokedInviteIds.includes(viewerPendingInviteBeforeRemoval.id)))
    assert.ok(serviceLogs.some(log => log.message === 'organization_member_role_updated' && log.metadata.requestId === 'smoke-viewer-role-editor'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_member_mutation_denied' && log.metadata.requestId === 'smoke-member-role-denied' && log.metadata.action === 'change_member_role'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_member_mutation_denied' && log.metadata.requestId === 'smoke-admin-promote-denied' && log.metadata.requestedRole === 'admin'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_member_mutation_denied' && log.metadata.action === 'remove_member' && log.metadata.targetUserId === 'org_smoke_owner'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_last_owner_guard_blocked' && log.metadata.requestId === 'smoke-last-owner-role-denied' && log.metadata.action === 'change_owner_role'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_last_owner_guard_blocked' && log.metadata.action === 'remove_owner' && log.metadata.targetUserId === 'org_smoke_admin'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_lifecycle_mutation_blocked' && log.metadata.requestId === 'smoke-archived-invite-denied' && log.metadata.blockerCode === 'org_archived'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_lifecycle_mutation_blocked' && log.metadata.requestId === 'smoke-deleted-watchlist-resume-denied' && log.metadata.blockerCode === 'org_deleted'))
    assert.ok(serviceLogs.some(log => log.message === 'organization_lifecycle_mutation_blocked' && log.metadata.blockedAction === 'change member roles' && log.metadata.actorRole === 'owner'))
}
