import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function runWatchlistLifecycle(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody } = ctx
    const { organization } = journey
    const ownerWatchlistItem = journey.ownerWatchlistItem!

    const ownerAddsCompanyResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { kind: 'company', value: 'Acme Shared Holdings', requestId: 'smoke-company-watchlist' },
    }, 201)
    const companyWatchlistItem = parseBody(ownerAddsCompanyResponse.body).watchlistItem

    const ownerPausesCompanyResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists/${companyWatchlistItem.id}/actions`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { action: 'pause', reason: 'Pause during live proof cleanup.', requestId: 'smoke-pause-company' },
    }, 200)
    assert.equal(parseBody(ownerPausesCompanyResponse.body).watchlistItem.status, 'paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).watchlistItem.enabled, false)
    assert.equal(parseBody(ownerPausesCompanyResponse.body).watchlistItem.disabledReason, 'watchlist_paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.action, 'pause')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.statusAfter, 'paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.enabledAfter, false)
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.disabledReasonAfter, 'watchlist_paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.alertGenerationEligibleAfter, false)
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.blockerAfter, 'watchlist_paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.schemaVersion, 'organization.watchlist_mutation_receipt.v1')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.action, 'pause')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.statusAfter, 'paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.enabledAfter, false)
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.lifecycleBlockerAfter, 'watchlist_paused')
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.activeTermsIncludedInExport, false)
    assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.noEnumeration, true)

    const pausedWatchlistsResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists?status=paused`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 200)
    assert.deepEqual(parseBody(pausedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.id), [companyWatchlistItem.id])
    assert.deepEqual(parseBody(pausedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.enabled), [false])
    assert.deepEqual(parseBody(pausedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.disabledReason), ['watchlist_paused'])

    const readinessWhilePausedResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-readiness`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    assert.equal(parseBody(readinessWhilePausedResponse.body).alertReadiness.sharedWatchlistCount, 1)
    assert.equal(parseBody(readinessWhilePausedResponse.body).alertReadiness.generatedAlertReferences.length, 1)

    const alertTermsWhilePausedResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-alert-terms-paused`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 403)
    const alertTermsWhilePausedDeniedBody = parseBody(alertTermsWhilePausedResponse.body)
    assert.equal(alertTermsWhilePausedDeniedBody.error, 'Organization alert visibility does not allow this member to export alert terms.')
    assert.ok(!('alertTermsExport' in alertTermsWhilePausedDeniedBody))
    const alertTermsWhilePausedDenied = alertTermsWhilePausedDeniedBody.alertTermsExportDenial
    assert.equal(alertTermsWhilePausedDenied.schemaVersion, 'organization.watchlist_alert_terms_export_denial.v1')
    assert.equal(alertTermsWhilePausedDenied.organizationId, organization.id)
    assert.equal(alertTermsWhilePausedDenied.member.userId, 'org_smoke_member')
    assert.equal(alertTermsWhilePausedDenied.member.role, 'reader')
    assert.equal(alertTermsWhilePausedDenied.visibility.allowed, false)
    assert.equal(alertTermsWhilePausedDenied.visibility.reason, 'role_not_allowed')
    assert.ok(alertTermsWhilePausedDenied.redactedFields.includes('activeTerms[]'))
    assert.ok(!('activeTerms' in alertTermsWhilePausedDenied))
    assert.equal(alertTermsWhilePausedDenied.auditProof.schemaVersion, 'organization.watchlist_alert_terms_denial_audit.v1')
    assert.equal(alertTermsWhilePausedDenied.auditProof.serviceLogAction, 'organization_watchlist_alert_terms_export_denied')
    assert.equal(alertTermsWhilePausedDenied.auditProof.requestId, 'smoke-alert-terms-paused')
    assert.ok(alertTermsWhilePausedDenied.auditProof.requiredMetadataFields.includes('allowedRoles'))
    assert.ok(alertTermsWhilePausedDenied.auditProof.requiredMetadataFields.includes('denialReason'))
    assert.ok(alertTermsWhilePausedDenied.auditProof.redactedFields.includes('watchlistScope.alertGeneratorKeys'))
    assert.equal(alertTermsWhilePausedDenied.auditProof.proofLogQuery, 'GET /api/logs?service=api&message=organization_watchlist_alert_terms_export_denied')

    const ownerResumesCompanyResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists/${companyWatchlistItem.id}/actions`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { action: 'resume', reason: 'Resume after cleanup dry run.', request_id: 'smoke-resume-company' },
    }, 200)
    assert.equal(parseBody(ownerResumesCompanyResponse.body).watchlistItem.status, 'active')
    assert.equal(parseBody(ownerResumesCompanyResponse.body).watchlistItem.lifecycleRequestId, 'smoke-resume-company')
    assert.equal(parseBody(ownerResumesCompanyResponse.body).operation.lifecycleTransition.statusAfter, 'active')
    assert.equal(parseBody(ownerResumesCompanyResponse.body).operation.lifecycleTransition.enabledAfter, true)
    assert.equal(parseBody(ownerResumesCompanyResponse.body).operation.lifecycleTransition.disabledReasonAfter, null)

    const adminAddsActorResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { kind: 'actor', value: 'Scattered Spider', notes: 'Actor alias', requestId: 'smoke-actor-watchlist' },
    }, 201)
    const actorWatchlistItem = journey.actorWatchlistItem = parseBody(adminAddsActorResponse.body).watchlistItem
    assert.equal(actorWatchlistItem.value, 'scattered spider')

    const actorFilterResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists?kind=actor`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 200)
    assert.deepEqual(parseBody(actorFilterResponse.body).watchlistItems.map((item: Row) => item.value), ['scattered spider'])

    const memberAddsKeywordResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { kind: 'keyword', value: 'Credential Reset', notes: 'Phishing wording', requestId: 'smoke-keyword-watchlist' },
    }, 201)
    const keywordWatchlistItem = parseBody(memberAddsKeywordResponse.body).watchlistItem
    assert.equal(keywordWatchlistItem.value, 'credential reset')

    const memberUpdatesKeywordDeniedResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/watchlists/${keywordWatchlistItem.id}`,
        headers: authHeaders('org_smoke_member', 'member-token'),
        payload: { kind: 'keyword', value: 'member update denied', reason: 'Member cannot edit shared terms.', requestId: 'smoke-member-watchlist-update-denied' },
    }, 403)
    const memberUpdatesKeywordDenied = parseBody(memberUpdatesKeywordDeniedResponse.body).watchlistMutationDenial
    assert.equal(memberUpdatesKeywordDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
    assert.equal(memberUpdatesKeywordDenied.organizationId, organization.id)
    assert.equal(memberUpdatesKeywordDenied.actorId, 'org_smoke_member')
    assert.equal(memberUpdatesKeywordDenied.actorRole, 'reader')
    assert.equal(memberUpdatesKeywordDenied.action, 'update_watchlist')
    assert.equal(memberUpdatesKeywordDenied.itemId, keywordWatchlistItem.id)
    assert.equal(memberUpdatesKeywordDenied.denialReason, 'role_not_allowed')
    assert.equal(memberUpdatesKeywordDenied.memberCanReadSharedWatchlists, true)
    assert.equal(memberUpdatesKeywordDenied.memberCanMutateSharedWatchlists, false)
    assert.equal(memberUpdatesKeywordDenied.downstreamRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
    assert.equal(memberUpdatesKeywordDenied.deniedMutationDoesNotAffectActiveTerms, true)
    assert.ok(memberUpdatesKeywordDenied.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
    assert.equal(memberUpdatesKeywordDenied.nonmemberEnumeration, false)
    assert.equal(memberUpdatesKeywordDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
    assert.equal(memberUpdatesKeywordDenied.requestId, 'smoke-member-watchlist-update-denied')
    assert.equal(memberUpdatesKeywordDenied.reason, 'Member cannot edit shared terms.')

    const memberUpdatesKeywordResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/watchlists/${keywordWatchlistItem.id}`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { kind: 'keyword', value: 'Credential Reset Lures', notes: 'Updated wording', reason: 'Refine live proof keyword.', requestId: 'smoke-keyword-update' },
    }, 200)
    assert.equal(parseBody(memberUpdatesKeywordResponse.body).watchlistItem.value, 'credential reset lures')
    assert.equal(parseBody(memberUpdatesKeywordResponse.body).operation.action, 'updated')

    await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { kind: 'vendor', value: 'Acme Payroll Vendor' },
    }, 201)

    const ownerSeesAllResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    }, 200)
    assert.deepEqual(
        parseBody(ownerSeesAllResponse.body).watchlistItems.map((item: Row) => item.value).sort(),
        ['Acme Payroll Vendor', 'Acme Shared Holdings', 'acme-shared.example', 'credential reset lures', 'scattered spider'].sort()
    )
    const ownerSharedWatchlistContract = parseBody(ownerSeesAllResponse.body).sharedWatchlistContract
    assert.deepEqual(ownerSharedWatchlistContract.termFamilies, ['actor', 'company', 'domain', 'keyword', 'vendor'])
    assert.equal(ownerSharedWatchlistContract.permissions.actorRole, 'owner')
    assert.equal(ownerSharedWatchlistContract.permissions.canWrite, true)
    assert.equal(ownerSharedWatchlistContract.permissions.canArchive, true)
    assert.equal(ownerSharedWatchlistContract.permissions.canCleanup, true)
    assert.equal(ownerSharedWatchlistContract.ownership.duplicateTermScope, 'organization')
    assert.equal(ownerSharedWatchlistContract.ownership.crossOrgEnumerationAllowed, false)
    assert.equal(ownerSharedWatchlistContract.ownership.activeItemIds.length, 5)
    assert.ok(ownerSharedWatchlistContract.ownership.itemIds.includes(ownerWatchlistItem.id))
    assert.deepEqual(ownerSharedWatchlistContract.ownership.creatorUserIds.sort(), ['org_smoke_admin', 'org_smoke_owner'].sort())
    assert.equal(ownerSharedWatchlistContract.lifecycle.activeCount, 5)
    assert.equal(ownerSharedWatchlistContract.lifecycle.pausedCount, 0)
    assert.equal(ownerSharedWatchlistContract.lifecycle.archivedCount, 0)
    assert.equal(ownerSharedWatchlistContract.lifecycle.cleanupRoute, 'POST /api/organizations/:id/watchlists/cleanup')
    assert.equal(ownerSharedWatchlistContract.lifecycle.archiveRoute, 'DELETE /api/organizations/:organizationId/watchlists/:itemId')
    assert.deepEqual(ownerSharedWatchlistContract.alertExportBridge.watchlistItemIds.sort(), ownerSharedWatchlistContract.ownership.activeItemIds.sort())
    assert.deepEqual(ownerSharedWatchlistContract.alertExportBridge.termFamilies, ['actor', 'company', 'domain', 'keyword', 'vendor'])
    assert.ok(ownerSharedWatchlistContract.alertExportBridge.ownerContextFields.includes('activeTerms[].lifecycleRequestId'))
    assert.ok(ownerSharedWatchlistContract.alertExportBridge.webhookOwnership.requiredAlertFields.includes('alert.ownerOrganizationId'))
    assert.ok(ownerSharedWatchlistContract.alertExportBridge.webhookOwnership.redactedFields.includes('destination.secret'))
    assert.deepEqual(ownerSharedWatchlistContract.alertExportBridge.blockedReasons, [])

}
