import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function runOrganizationLifecycleAndTenantIsolation(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, orgUtils, watchlists, authHeaders, parseBody, assertOrganizationTenantIdentity, organizationSummary } = ctx
    const { organization } = journey
    const alertTermsExport = journey.alertTermsExport!
    const adminAlertCaseVisibility = journey.adminAlertCaseVisibility!
    const adminPortalVisibility = journey.adminPortalVisibility!
    const ownerWatchlistItem = journey.ownerWatchlistItem!
    const bulkInviteWorkflow = journey.bulkInviteWorkflow!

    const archiveOrganizationResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/settings`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { lifecycleStatus: 'archived' },
    }, 200)
    const archivedOrganizationSettings = parseBody(archiveOrganizationResponse.body)
    assert.equal(archivedOrganizationSettings.organization.lifecycleStatus, 'archived')
    assert.equal(archivedOrganizationSettings.settings.lifecycleStatus, 'archived')
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.lifecycleStatus, 'archived')
    assert.ok(archivedOrganizationSettings.lifecycleReadiness.typedBlockers.includes('org_archived'))
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.alertExportReadiness.ready, false)
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.lifecycleStatus, 'archived')
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.blockerCode, 'org_archived')
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.inviteMutationAllowed, false)
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.watchlistMutationAllowed, false)
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.alertExportAllowed, false)
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.caseVisibilityAllowed, false)
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.webhookDeliveryAllowed, false)
    assert.ok(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.blockedRoutes.includes('GET /api/organizations/:id/watchlists/alert-terms'))
    assert.equal(archivedOrganizationSettings.settingsMutationReceipt.schemaVersion, 'organization.lifecycle_settings_mutation_receipt.v1')
    assert.equal(archivedOrganizationSettings.settingsMutationReceipt.previousLifecycleStatus, 'active')
    assert.equal(archivedOrganizationSettings.settingsMutationReceipt.lifecycleStatus, 'archived')
    assert.equal(archivedOrganizationSettings.settingsMutationReceipt.lifecycleChanged, true)
    assert.deepEqual(archivedOrganizationSettings.settingsMutationReceipt.mutatedFields, ['lifecycleStatus'])
    assert.ok(ctx.serviceLogs.some(
        log => log.message === 'organization_settings_updated'
            && Array.isArray(log.metadata.fields)
            && log.metadata.fields.length === 1
            && log.metadata.fields[0] === 'lifecycleStatus',
    ))
    assert.equal(archivedOrganizationSettings.settingsMutationReceipt.blockerReason, 'org_archived')
    assert.equal(archivedOrganizationSettings.settingsMutationReceipt.downstreamReadiness.alertGenerationReady, false)
    assert.equal(archivedOrganizationSettings.settingsMutationReceipt.downstreamReadiness.webhookDeliveryReady, false)
    assert.ok(archivedOrganizationSettings.settingsMutationReceipt.downstreamContracts.includes('organization.webhook_destination_delivery_consumer.v1'))
    assert.equal(archivedOrganizationSettings.settingsMutationReceipt.lifecycleCleanup.noCrossOrgLeakage, true)
    assert.equal(archivedOrganizationSettings.settingsMutationReceipt.destinationReadiness.deliveryBlockedByLifecycle, true)
    assert.ok(archivedOrganizationSettings.settingsMutationReceipt.noLeakFields.includes('destination.secret'))
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.lifecycleStatus, 'archived')
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.blockerCode, 'org_archived')
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.lifecycleMutationAllowed, false)
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.actorPermissions.canManageInvites, false)
    assert.equal(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.actorPermissions.canMutateWatchlists, false)
    assert.ok(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.blockedWhenInactive.includes('POST /api/organizations/:id/invites'))
    assert.ok(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.noLeakFields.includes('otherOrg.watchlistItemIds'))
    const archivedOrgAlertTermsResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-archived-org-alert-terms`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    const archivedOrgAlertTerms = parseBody(archivedOrgAlertTermsResponse.body).alertTermsExport
    assert.equal(archivedOrgAlertTerms.downstreamAuthorization.organizationLifecycleState, 'archived')
    assert.equal(archivedOrgAlertTerms.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, false)
    assert.ok(archivedOrgAlertTerms.downstreamAuthorization.downstream.alertGeneration.blockerCodes.includes('org_archived'))
    assert.deepEqual(archivedOrgAlertTerms.activeTerms, [])
    assert.ok(archivedOrgAlertTerms.blockedReasons.includes('org_archived'))
    assert.equal(archivedOrgAlertTerms.canGenerateAlerts, false)
    assert.ok(archivedOrgAlertTerms.alertBridgeContract.typedBlockers.some((blocker: Row) => blocker.code === 'org_archived'))

    const archivedOrgReadinessResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-readiness`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    const archivedOrgReadiness = parseBody(archivedOrgReadinessResponse.body).alertReadiness
    assert.equal(archivedOrgReadiness.lifecycleReadiness.lifecycleStatus, 'archived')
    assert.equal(archivedOrgReadiness.alertGenerationBridge.canGenerateAlerts, false)
    assert.deepEqual(archivedOrgReadiness.alertGenerationBridge.activeWatchlistTerms, [])
    assert.equal(archivedOrgReadiness.downstreamAuthorization.organizationLifecycleState, 'archived')
    assert.equal(archivedOrgReadiness.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, false)
    assert.equal(archivedOrgReadiness.readinessProof.readiness.organizationCanGenerateAlerts, false)
    assert.equal(archivedOrgReadiness.readinessProof.readiness.readyForWorker3Replay, false)
    assert.equal(archivedOrgReadiness.readinessProof.readiness.readyForDashboard, false)
    assert.ok(archivedOrgReadiness.readinessProof.blockers.includes('org_archived'))
    assert.equal(archivedOrgReadiness.readinessProof.routes.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.ok(archivedOrgReadiness.readinessProof.alertQueueProof.blockerCodes.includes('org_archived'))
    assert.ok(archivedOrgReadiness.readinessProof.webhookDeliveryProof.blockerCodes.includes('org_archived'))
    assert.equal(archivedOrgReadiness.readinessProof.memberLifecycleProof.actorRole, 'admin')
    assert.equal(archivedOrgReadiness.readinessProof.memberLifecycleProof.denialReasons.removedMember, 'member_removed')
    assert.equal(archivedOrgReadiness.readinessProof.memberLifecycleProof.nonmemberEnumeration, false)

    const archivedInviteDeniedResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { email: 'archived-invite@example.test', role: 'member', requestId: 'smoke-archived-invite-denied' },
    }, 409)
    assert.equal(parseBody(archivedInviteDeniedResponse.body).lifecycleBlocker.code, 'org_archived')
    assert.equal(parseBody(archivedInviteDeniedResponse.body).lifecycleBlocker.action, 'invite members')
    assert.equal(parseBody(archivedInviteDeniedResponse.body).lifecycleBlocker.serviceLogAction, 'organization_lifecycle_mutation_blocked')
    assert.equal(parseBody(archivedInviteDeniedResponse.body).auditEvent.schemaVersion, 'organization.lifecycle_mutation_blocker_audit.v1')
    assert.equal(parseBody(archivedInviteDeniedResponse.body).auditEvent.requestId, 'smoke-archived-invite-denied')
    assert.equal(parseBody(archivedInviteDeniedResponse.body).auditEvent.blockerCode, 'org_archived')

    const archivedInviteResendDeniedResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites/${bulkInviteWorkflow.results[1].inviteId}/actions`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { action: 'resend', reason: 'Archived org should not resend invites.', requestId: 'smoke-archived-resend-denied' },
    }, 409)
    assert.equal(parseBody(archivedInviteResendDeniedResponse.body).lifecycleBlocker.code, 'org_archived')
    assert.equal(parseBody(archivedInviteResendDeniedResponse.body).lifecycleBlocker.action, 'resend invites')

    const archivedRoleUpdateDeniedResponse = await apiRequest({
        method: 'PATCH',
        url: `/api/organizations/${organization.id}/members/org_smoke_viewer/role`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { role: 'member', reason: 'Archived org should not change roles.', requestId: 'smoke-archived-role-denied' },
    }, 409)
    assert.equal(parseBody(archivedRoleUpdateDeniedResponse.body).lifecycleBlocker.code, 'org_archived')
    assert.equal(parseBody(archivedRoleUpdateDeniedResponse.body).lifecycleBlocker.action, 'change member roles')

    const archivedOwnershipTransferDeniedResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/ownership-transfer`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { targetUserId: 'org_smoke_admin', reason: 'Archived org should not transfer ownership.', requestId: 'smoke-archived-transfer-denied' },
    }, 409)
    assert.equal(parseBody(archivedOwnershipTransferDeniedResponse.body).lifecycleBlocker.code, 'org_archived')
    assert.equal(parseBody(archivedOwnershipTransferDeniedResponse.body).lifecycleBlocker.action, 'transfer ownership')

    const archivedWatchlistCreateDeniedResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { kind: 'domain', value: 'archived-org.example', reason: 'Archived org should not add terms.', requestId: 'smoke-archived-watchlist-create-denied' },
    }, 409)
    assert.equal(parseBody(archivedWatchlistCreateDeniedResponse.body).lifecycleBlocker.code, 'org_archived')
    assert.equal(parseBody(archivedWatchlistCreateDeniedResponse.body).lifecycleBlocker.action, 'create shared watchlists')

    const archivedWatchlistPauseDeniedResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}/actions`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { action: 'pause', reason: 'Archived org should not pause terms.', requestId: 'smoke-archived-watchlist-pause-denied' },
    }, 409)
    assert.equal(parseBody(archivedWatchlistPauseDeniedResponse.body).lifecycleBlocker.code, 'org_archived')
    assert.equal(parseBody(archivedWatchlistPauseDeniedResponse.body).lifecycleBlocker.action, 'pause shared watchlists')

    const deleteOrganizationResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/settings`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { lifecycleStatus: 'deleted' },
    }, 200)
    const deletedOrganizationSettings = parseBody(deleteOrganizationResponse.body)
    assert.equal(deletedOrganizationSettings.organization.lifecycleStatus, 'deleted')
    assert.equal(deletedOrganizationSettings.settings.lifecycleStatus, 'deleted')
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.lifecycleStatus, 'deleted')
    assert.ok(deletedOrganizationSettings.lifecycleReadiness.typedBlockers.includes('org_deleted'))
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.alertExportReadiness.ready, false)
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.lifecycleStatus, 'deleted')
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.blockerCode, 'org_deleted')
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.inviteMutationAllowed, false)
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.watchlistMutationAllowed, false)
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.alertExportAllowed, false)
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.caseVisibilityAllowed, false)
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.webhookDeliveryAllowed, false)
    assert.ok(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.blockedRoutes.includes('POST /v1/dwm/webhooks/deliver'))
    assert.ok(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.noLeakFields.includes('destination.secret'))
    assert.equal(deletedOrganizationSettings.settingsMutationReceipt.previousLifecycleStatus, 'archived')
    assert.equal(deletedOrganizationSettings.settingsMutationReceipt.lifecycleStatus, 'deleted')
    assert.equal(deletedOrganizationSettings.settingsMutationReceipt.blockerReason, 'org_deleted')
    assert.equal(deletedOrganizationSettings.settingsMutationReceipt.downstreamReadiness.inviteMutationAllowed, false)
    assert.equal(deletedOrganizationSettings.settingsMutationReceipt.downstreamReadiness.caseVisibilityReady, false)
    assert.equal(deletedOrganizationSettings.settingsMutationReceipt.lifecycleCleanup.deletedBlocker, 'org_deleted')
    assert.equal(deletedOrganizationSettings.settingsMutationReceipt.destinationReadiness.nonmemberDestinationEnumeration, false)
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.lifecycleStatus, 'deleted')
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.blockerCode, 'org_deleted')
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.lifecycleMutationAllowed, false)
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.actorPermissions.canDeleteOrganization, false)
    assert.ok(deletedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.blockedWhenInactive.includes('POST /api/organizations/:id/ownership-transfer'))
    assert.equal(deletedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.nonmemberEnumeration, false)

    const deletedOrgAlertTermsResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-deleted-org-alert-terms`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    const deletedOrgAlertTerms = parseBody(deletedOrgAlertTermsResponse.body).alertTermsExport
    assert.equal(deletedOrgAlertTerms.downstreamAuthorization.organizationLifecycleState, 'deleted')
    assert.equal(deletedOrgAlertTerms.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, false)
    assert.ok(deletedOrgAlertTerms.downstreamAuthorization.downstream.alertGeneration.blockerCodes.includes('org_deleted'))
    assert.deepEqual(deletedOrgAlertTerms.activeTerms, [])
    assert.ok(deletedOrgAlertTerms.blockedReasons.includes('org_deleted'))
    assert.equal(deletedOrgAlertTerms.canGenerateAlerts, false)
    assert.ok(deletedOrgAlertTerms.alertBridgeContract.typedBlockers.some((blocker: Row) => blocker.code === 'org_deleted'))

    const deletedOrgReadinessResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-readiness`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    const deletedOrgReadiness = parseBody(deletedOrgReadinessResponse.body).alertReadiness
    assert.equal(deletedOrgReadiness.lifecycleReadiness.lifecycleStatus, 'deleted')
    assert.equal(deletedOrgReadiness.alertGenerationBridge.canGenerateAlerts, false)
    assert.deepEqual(deletedOrgReadiness.alertGenerationBridge.activeWatchlistTerms, [])
    assert.equal(deletedOrgReadiness.downstreamAuthorization.organizationLifecycleState, 'deleted')
    assert.equal(deletedOrgReadiness.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, false)
    assert.equal(deletedOrgReadiness.readinessProof.readiness.organizationCanGenerateAlerts, false)
    assert.equal(deletedOrgReadiness.readinessProof.readiness.readyForWorker3Replay, false)
    assert.equal(deletedOrgReadiness.readinessProof.readiness.readyForDashboard, false)
    assert.ok(deletedOrgReadiness.readinessProof.blockers.includes('org_deleted'))
    assert.ok(deletedOrgReadiness.readinessProof.alertQueueProof.blockerCodes.includes('org_deleted'))
    assert.ok(deletedOrgReadiness.readinessProof.webhookDeliveryProof.blockerCodes.includes('org_deleted'))
    assert.equal(deletedOrgReadiness.readinessProof.memberLifecycleProof.actorRole, 'admin')
    assert.ok(deletedOrgReadiness.readinessProof.memberLifecycleProof.noLeakFields.includes('activeTerms[]'))
    assert.equal(deletedOrgReadiness.readinessProof.cleanupProof.cleanupIdempotent, true)

    const deletedInviteAcceptDeniedResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/invites/${bulkInviteWorkflow.results[2].inviteId}/accept`,
        headers: authHeaders('org_smoke_outsider', 'outsider-token'),
    }, 409)
    const deletedInviteAcceptDenial = parseBody(deletedInviteAcceptDeniedResponse.body).inviteAcceptanceDenial
    assert.equal(deletedInviteAcceptDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
    assert.equal(deletedInviteAcceptDenial.organizationId, organization.id)
    assert.equal(deletedInviteAcceptDenial.inviteId, bulkInviteWorkflow.results[2].inviteId)
    assert.equal(deletedInviteAcceptDenial.inviteStatus, 'pending')
    assert.equal(deletedInviteAcceptDenial.organizationStatus, 'deleted')
    assert.equal(deletedInviteAcceptDenial.blockerCode, 'org_deleted')
    assert.equal(deletedInviteAcceptDenial.nonmemberEnumeration, false)

    const deletedWatchlistCreateDeniedResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { kind: 'keyword', value: 'deleted org term', reason: 'Deleted org should not add terms.', requestId: 'smoke-deleted-watchlist-create-denied' },
    }, 409)
    assert.equal(parseBody(deletedWatchlistCreateDeniedResponse.body).lifecycleBlocker.code, 'org_deleted')
    assert.equal(parseBody(deletedWatchlistCreateDeniedResponse.body).lifecycleBlocker.action, 'create shared watchlists')

    const deletedWatchlistResumeDeniedResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}/actions`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { action: 'resume', reason: 'Deleted org should not resume terms.', requestId: 'smoke-deleted-watchlist-resume-denied' },
    }, 409)
    assert.equal(parseBody(deletedWatchlistResumeDeniedResponse.body).lifecycleBlocker.code, 'org_deleted')
    assert.equal(parseBody(deletedWatchlistResumeDeniedResponse.body).lifecycleBlocker.action, 'resume shared watchlists')
    assert.equal(parseBody(deletedWatchlistResumeDeniedResponse.body).auditEvent.serviceLogAction, 'organization_lifecycle_mutation_blocked')
    assert.equal(parseBody(deletedWatchlistResumeDeniedResponse.body).auditEvent.requestId, 'smoke-deleted-watchlist-resume-denied')
    assert.equal(parseBody(deletedWatchlistResumeDeniedResponse.body).auditEvent.blockerCode, 'org_deleted')

    const reactivateOrganizationResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/settings`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { lifecycle_status: 'active' },
    }, 200)
    assert.equal(parseBody(reactivateOrganizationResponse.body).organization.lifecycleStatus, 'active')
    assert.equal(parseBody(reactivateOrganizationResponse.body).lifecycleReadiness.lifecycleStatus, 'active')
    assert.deepEqual(parseBody(reactivateOrganizationResponse.body).lifecycleReadiness.typedBlockers, [])
    assert.equal(parseBody(reactivateOrganizationResponse.body).lifecycleReadiness.downstreamLifecycleReceipt.blockerCode, null)
    assert.equal(parseBody(reactivateOrganizationResponse.body).lifecycleReadiness.downstreamLifecycleReceipt.inviteMutationAllowed, true)
    assert.equal(parseBody(reactivateOrganizationResponse.body).lifecycleReadiness.downstreamLifecycleReceipt.webhookDeliveryAllowed, true)
    assert.equal(parseBody(reactivateOrganizationResponse.body).settingsMutationReceipt.previousLifecycleStatus, 'deleted')
    assert.equal(parseBody(reactivateOrganizationResponse.body).settingsMutationReceipt.lifecycleStatus, 'active')
    assert.equal(parseBody(reactivateOrganizationResponse.body).settingsMutationReceipt.blockerReason, null)
    assert.equal(parseBody(reactivateOrganizationResponse.body).settingsMutationReceipt.downstreamReadiness.alertGenerationReady, true)
    assert.equal(parseBody(reactivateOrganizationResponse.body).settingsMutationReceipt.downstreamReadiness.webhookDeliveryReady, true)
    assert.equal(parseBody(reactivateOrganizationResponse.body).settingsMutationReceipt.destinationReadiness.deliveryBlockedByLifecycle, false)

    const secondOrganizationResponse = await apiRequest({
        method: 'POST',
        url: '/api/organizations',
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { name: 'Smoke Overlap Tenant' },
    }, 201)
    const secondOrganization = parseBody(secondOrganizationResponse.body).organization
    assert.notEqual(secondOrganization.id, organization.id)

    const secondOrgWatchlistResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${secondOrganization.id}/watchlists`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { kind: 'domain', value: 'acme-shared.example', notes: 'Overlapping domain in separate tenant.', requestId: 'smoke-overlap-domain-second-org' },
    }, 201)
    const secondOrgWatchlistItem = parseBody(secondOrgWatchlistResponse.body).watchlistItem
    assert.equal(secondOrgWatchlistItem.organizationId, secondOrganization.id)
    assert.equal(secondOrgWatchlistItem.value, 'acme-shared.example')

    const secondOrgAlertTermsResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${secondOrganization.id}/watchlists/alert-terms?requestId=smoke-overlap-second-org-export`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    }, 200)
    const secondOrgAlertTermsExport = parseBody(secondOrgAlertTermsResponse.body).alertTermsExport
    assertOrganizationTenantIdentity(secondOrgAlertTermsExport, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.member.role, 'owner')
    assert.equal(secondOrgAlertTermsExport.activeTerms.length, 1)
    assert.equal(secondOrgAlertTermsExport.activeTerms[0].term, 'acme-shared.example')
    assertOrganizationTenantIdentity(secondOrgAlertTermsExport.activeTerms[0].alertGenerationRef, secondOrganization.id)
    assertOrganizationTenantIdentity(secondOrgAlertTermsExport.activeTerms[0].ownerContext, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.activeTerms[0].ownerContext.ownerOrganizationId, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.activeTerms[0].ownerContext.watchlistItemId, secondOrgWatchlistItem.id)
    assert.equal(secondOrgAlertTermsExport.activeTerms[0].ownerContext.webhookDestinationOrgField, 'destination.org_id')
    assert.equal(secondOrgAlertTermsExport.activeTerms[0].ownerContext.alertGeneratorKey, secondOrgAlertTermsExport.activeTerms[0].alertGeneratorKey)
    assert.notEqual(secondOrgAlertTermsExport.activeTerms[0].alertGeneratorKey, alertTermsExport.activeTerms.find((term: Row) => term.term === 'acme-shared.example').alertGeneratorKey)
    const secondOrgGeneratedReference = orgUtils.buildOrganizationDwmAlertReference(
        organizationSummary(secondOrganization.id, 'owner'),
        watchlists.get(secondOrgWatchlistItem.id) as Row,
    )
    const firstOrgOverlapTerm = alertTermsExport.activeTerms.find((term: Row) => term.term === 'acme-shared.example')
    assertOrganizationTenantIdentity(secondOrgGeneratedReference.alertOwnership, secondOrganization.id)
    assert.equal(secondOrgGeneratedReference.alertOwnership.watchlistItemId, secondOrgWatchlistItem.id)
    assert.equal(secondOrgGeneratedReference.alertOwnership.crossTenantCollisionAllowed, false)
    assertOrganizationTenantIdentity(secondOrgGeneratedReference.ownerContext, secondOrganization.id)
    assert.equal(secondOrgGeneratedReference.ownerContext.watchlistItemId, secondOrgWatchlistItem.id)
    assert.equal(secondOrgGeneratedReference.ownerContext.alertGeneratorKey, secondOrgGeneratedReference.alert.dedupeKey)
    assert.equal(secondOrgGeneratedReference.alert.workflowContext.ownerContext.organizationId, secondOrganization.id)
    assert.notEqual(secondOrgGeneratedReference.alertOwnership.dedupeKey, firstOrgOverlapTerm.alertGenerationRef.dedupe.key)
    assert.notEqual(secondOrgGeneratedReference.alertOwnership.organizationId, firstOrgOverlapTerm.organizationId)
    assert.notEqual(secondOrgGeneratedReference.ownerContext.organizationId, firstOrgOverlapTerm.ownerContext.organizationId)
    assert.notEqual(secondOrgGeneratedReference.ownerContext.alertGeneratorKey, firstOrgOverlapTerm.ownerContext.alertGeneratorKey)
    assert.equal(secondOrgGeneratedReference.webhookContract.schemaVersion, 'organization.alert_reference_webhook_contract.v1')
    assertOrganizationTenantIdentity(secondOrgGeneratedReference.webhookContract, secondOrganization.id)
    assert.equal(secondOrgGeneratedReference.webhookContract.requiredDestinationOrgId, secondOrganization.id)
    assert.equal(secondOrgGeneratedReference.webhookContract.selectedDestinationOrgField, 'destination.org_id')
    assert.equal(secondOrgGeneratedReference.webhookContract.selectedDestinationIdField, 'webhookDestinationIds[]')
    assert.equal(secondOrgGeneratedReference.webhookContract.ownerContext.organizationId, secondOrganization.id)
    assert.equal(secondOrgGeneratedReference.webhookContract.ownerContext.alertGeneratorKey, secondOrgGeneratedReference.alert.dedupeKey)
    assert.notEqual(secondOrgGeneratedReference.webhookContract.requiredDestinationOrgId, organization.id)
    assert.notEqual(secondOrgAlertTermsExport.activeTerms[0].ownerContext.organizationId, firstOrgOverlapTerm.ownerContext.organizationId)
    assert.notEqual(secondOrgAlertTermsExport.activeTerms[0].ownerContext.alertGeneratorKey, firstOrgOverlapTerm.ownerContext.alertGeneratorKey)
    assert.equal(secondOrgAlertTermsExport.downstreamAuthorization.watchlists.activeCount, 1)
    assert.deepEqual(secondOrgAlertTermsExport.downstreamAuthorization.watchlists.activeIds, [secondOrgWatchlistItem.id])
    assert.equal(secondOrgAlertTermsExport.downstreamAuthorization.actionGates.create_watchlist.allowed, true)
    assert.equal(secondOrgAlertTermsExport.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, true)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.organizationId, secondOrganization.id)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.watchlistOwnership.activeIds, [secondOrgWatchlistItem.id])
    assert.ok(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.watchlistOwnership.lifecycleStatuses.every((item: Row) => item.organizationId === secondOrganization.id))
    assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.alertGeneratorKeys, alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.alertGeneratorKeys)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.watchlistOwnership.isolatedByOrganizationId, true)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.organizationId, secondOrganization.id)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.alertGeneratorKeys, alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.alertGeneratorKeys)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.dedupe.crossTenantCollisionAllowed, false)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.organizationId, secondOrganization.id)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.watchlistScope.alertGeneratorKeys, alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.watchlistScope.alertGeneratorKeys)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.organizationId, secondOrganization.id)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.watchlistScope.alertGeneratorKeys, alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.watchlistScope.alertGeneratorKeys)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.organizationId, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.requiredDestinationOrgId, secondOrganization.id)
    assert.notEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.requiredDestinationOrgId, alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.requiredDestinationOrgId)
    assertOrganizationTenantIdentity(secondOrgAlertTermsExport.webhookDestinationOwnership, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationOwnership.requiredDestinationOrgId, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationOwnership.selectedDestinationOrgField, 'destination.org_id')
    assert.equal(secondOrgAlertTermsExport.webhookDestinationOwnership.nonmemberDestinationEnumeration, false)
    assert.notEqual(secondOrgAlertTermsExport.webhookDestinationOwnership.requiredDestinationOrgId, alertTermsExport.webhookDestinationOwnership.requiredDestinationOrgId)
    assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationOwnership.idempotency.keyFields, ['eventType', 'organizationId', 'destinationId', 'alert.dedupeKey'])
    assert.ok(secondOrgAlertTermsExport.webhookDestinationOwnership.requiredAlertFields.includes('alert.organizationId'))
    assert.ok(secondOrgAlertTermsExport.webhookDestinationOwnership.redactedFields.includes('destination.secret'))
    assertOrganizationTenantIdentity(secondOrgAlertTermsExport.webhookDestinationAccessDecision, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.destinationScope.requiredDestinationOrgId, secondOrganization.id)
    assert.notEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.destinationScope.requiredDestinationOrgId, alertTermsExport.webhookDestinationAccessDecision.destinationScope.requiredDestinationOrgId)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.destinationScope.crossOrgDestinationAllowed, false)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.allowedActions.automaticDelivery, true)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.allowedActions.manualTrigger, true)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.allowedActions.configureDestination, true)
    assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.blockerCodes, [])
    assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.roleGates.manualTrigger, ['owner', 'admin', 'editor'])
    assert.ok(secondOrgAlertTermsExport.webhookDestinationAccessDecision.noLeakFields.includes('otherOrg.destinationIds'))
    assert.ok(secondOrgAlertTermsExport.webhookDestinationAccessDecision.proofAssertions.includes('nonmember_cannot_enumerate_destinations'))
    assertOrganizationTenantIdentity(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.selectedDestinationOrgField, 'destination.org_id')
    assert.notEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.organizationId, alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.organizationId)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.crossOrgDestinationAllowed, false)
    assert.ok(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.noLeakFields.includes('otherOrg.destinationIds'))
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.organizationId, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.destinationScope.requiredDestinationOrgId, secondOrganization.id)
    assert.notEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.destinationScope.requiredDestinationOrgId, alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.destinationScope.requiredDestinationOrgId)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.readiness.destinationDeliveryReady, true)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.readiness.manualSelectionRequired, false)
    assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.readiness.blockerCodes, [])
    assert.ok(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.organizationId, secondOrganization.id)
    assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
    assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.watchlistScope.provenanceHashes, secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenanceHash))
    assert.notDeepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.watchlistScope.provenanceHashes, alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.watchlistScope.provenanceHashes)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.workflowState.destinationDeliveryReady, true)
    assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.blockerCodes, [])
    assert.ok(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.noLeakFields.includes('otherOrg.destinationIds'))
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.organizationId, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.readyForDelivery, true)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.destinationDeliveryReady, true)
    assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.blockerReason, null)
    assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.blockerCodes, [])
    assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.watchlistMatches.map((match: Row) => match.watchlistItemId), [secondOrgWatchlistItem.id])
    assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.watchlistMatches.map((match: Row) => match.provenanceHash), secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenanceHash))
    assert.ok(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.watchlistMatches.every((match: Row) => match.workflowStatus === 'ready_for_delivery'))
    assert.ok(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.watchlistMatches.every((match: Row) => match.destinationReadiness.destinationDeliveryReady === true))
    assert.notDeepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.watchlistMatches.map((match: Row) => match.provenanceHash), alertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.watchlistMatches.map((match: Row) => match.provenanceHash))
    assert.equal(secondOrgAlertTermsExport.alertGenerationConsumer.organizationId, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.alertGenerationConsumer.scopeGuardrails.crossOrgReadAllowed, false)
    assert.equal(secondOrgAlertTermsExport.alertGenerationConsumer.scopeGuardrails.watchlistScope, 'organization_owned')
    assert.deepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.activeTerms.map((term: Row) => term.watchlistItemId), [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.activeTerms.map((term: Row) => term.alertGeneratorKey), alertTermsExport.alertGenerationConsumer.activeTerms.map((term: Row) => term.alertGeneratorKey))
    assert.ok(!secondOrgAlertTermsExport.alertGenerationConsumer.activeTerms.some((term: Row) => alertTermsExport.alertGenerationConsumer.activeTerms.map((firstTerm: Row) => firstTerm.watchlistItemId).includes(term.watchlistItemId)))
    assert.deepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.watchlistId), [secondOrgWatchlistItem.id])
    assert.deepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenance.organizationId), [secondOrganization.id])
    assert.notDeepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenance.alertGeneratorKey), alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenance.alertGeneratorKey))
    assert.notDeepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenanceHash), alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenanceHash))
    assert.deepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.destinationReadiness.selectedDestinationOrgField), ['destination.org_id'])
    assert.ok(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.destinationReadiness.dryRunVisibility.allowed === true))
    assert.ok(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.matchReason.code === 'organization_watchlist_term_match'))
    assert.equal(secondOrgAlertTermsExport.termExportDeltaReceipt.organizationId, secondOrganization.id)
    assert.deepEqual(secondOrgAlertTermsExport.termExportDeltaReceipt.exportedWatchlistItemIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertTermsExport.termExportDeltaReceipt.exportedAlertGeneratorKeys, alertTermsExport.termExportDeltaReceipt.exportedAlertGeneratorKeys)
    assert.equal(secondOrgAlertTermsExport.termExportDeltaReceipt.nonmemberEnumeration, false)
    assert.equal(secondOrgAlertTermsExport.alertCasePersistenceReceipt.organizationId, secondOrganization.id)
    assert.deepEqual(secondOrgAlertTermsExport.alertCasePersistenceReceipt.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertTermsExport.alertCasePersistenceReceipt.watchlistScope.alertGeneratorKeys, alertTermsExport.alertCasePersistenceReceipt.watchlistScope.alertGeneratorKeys)
    assert.equal(secondOrgAlertTermsExport.alertCasePersistenceReceipt.dedupe.crossTenantCollisionAllowed, false)
    assertOrganizationTenantIdentity(secondOrgAlertTermsExport.consumerReadiness, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.consumerReadiness.watchlists.activeCount, 1)
    assert.deepEqual(secondOrgAlertTermsExport.consumerReadiness.watchlists.activeIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertTermsExport.consumerReadiness.watchlists.alertGeneratorKeys, alertTermsExport.consumerReadiness.watchlists.alertGeneratorKeys)
    assert.equal(secondOrgAlertTermsExport.consumerReadiness.watchlists.crossTenantCollisionAllowed, false)
    assert.equal(secondOrgAlertTermsExport.consumerReadiness.readiness.alertQueueReady, true)
    assert.equal(secondOrgAlertTermsExport.consumerReadiness.readiness.caseWorkflowReady, true)
    assert.equal(secondOrgAlertTermsExport.consumerReadiness.readiness.webhookDeliveryReady, true)
    assert.equal(secondOrgAlertTermsExport.consumerReadiness.readiness.supportRedactedReadReady, true)
    assert.equal(secondOrgAlertTermsExport.consumerReadiness.readiness.dashboardReadinessReady, true)
    assert.deepEqual(secondOrgAlertTermsExport.consumerReadiness.roleGates.mutateWatchlists, ['owner', 'admin', 'editor'])
    assert.deepEqual(secondOrgAlertTermsExport.consumerReadiness.roleGates.exportTerms, ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'])
    assert.deepEqual(secondOrgAlertTermsExport.consumerReadiness.roleGates.manualWebhookTrigger, ['owner', 'admin', 'editor'])
    assert.deepEqual(secondOrgAlertTermsExport.consumerReadiness.blockers, [])
    assert.ok(secondOrgAlertTermsExport.consumerReadiness.noLeakFields.includes('destination.secret'))
    assert.equal(secondOrgAlertTermsExport.readinessExport.schemaVersion, 'organization.shared_watchlist_readiness_export.v1')
    assertOrganizationTenantIdentity(secondOrgAlertTermsExport.readinessExport, secondOrganization.id)
    assert.deepEqual(secondOrgAlertTermsExport.readinessExport.watchlistScope.activeItemIds, [secondOrgWatchlistItem.id])
    assert.deepEqual(secondOrgAlertTermsExport.readinessExport.watchlistScope.alertGeneratorKeys, secondOrgAlertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey))
    assert.notDeepEqual(secondOrgAlertTermsExport.readinessExport.watchlistScope.alertGeneratorKeys, alertTermsExport.readinessExport.watchlistScope.alertGeneratorKeys)
    assert.equal(secondOrgAlertTermsExport.readinessExport.watchlistScope.crossTenantCollisionAllowed, false)
    assert.deepEqual(secondOrgAlertTermsExport.readinessExport.userLocalIsolation.activeWatchlistItemIds, [secondOrgWatchlistItem.id])
    assert.deepEqual(secondOrgAlertTermsExport.readinessExport.userLocalIsolation.alertGeneratorKeys, secondOrgAlertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey))
    assert.notDeepEqual(secondOrgAlertTermsExport.readinessExport.userLocalIsolation.alertGeneratorKeys, alertTermsExport.readinessExport.userLocalIsolation.alertGeneratorKeys)
    assert.ok(secondOrgAlertTermsExport.readinessExport.userLocalIsolation.noLeakFields.includes('userLocal.watchlistItems'))
    assert.equal(secondOrgAlertTermsExport.readinessExport.userLocalIsolation.crossOrgDedupeAllowed, false)
    assert.equal(secondOrgAlertTermsExport.readinessExport.readiness.alertExportReady, true)
    assert.equal(secondOrgAlertTermsExport.readinessExport.readiness.webhookDestinationReady, true)
    assert.deepEqual(secondOrgAlertTermsExport.readinessExport.blockers, [])
    assert.ok(secondOrgAlertTermsExport.readinessExport.noLeakFields.includes('otherOrg.watchlistItemIds'))
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.ok, true)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.organizationId, secondOrganization.id)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.orgScope.watchlistItemIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.orgScope.alertGeneratorKeys, alertTermsExport.sharedWatchlistIntegrationGuardrails.orgScope.alertGeneratorKeys)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.denialSafety.ok, true)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.denialSafety.blockerCodes, [])
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.ok, true)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.requiredDestinationOrgId, secondOrganization.id)
    assert.notEqual(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.requiredDestinationOrgId, alertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.requiredDestinationOrgId)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.blockerCodes, [])
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.ok, true)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.actorCanOpenCase, true)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.actorCanAssignCase, true)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.blockerCodes, [])
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.organizationId, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.summary.activeTermCount, 1)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.summary.termFamilies, ['domain'])
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.containsRawTerms, false)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.guardrails.ok, true)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.guardrails.rawTermAccessAllowed, false)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.guardrails.blockerCodes, [])
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.schemaVersion, 'organization.shared_watchlist_audit_event_bridge.v1')
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.requiredActions, alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.requiredActions)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.noRawTermAccess, true)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.blockerCodes, [])
    assert.ok(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.eventDescriptors.every((event: Row) => event.redactedMetadataFields.includes('alertBridge.alertGeneratorKeys')))
    assert.ok(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.eventDescriptors.every((event: Row) => event.organizationField === 'organizationId'))
    assertOrganizationTenantIdentity(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.persistenceLevel, 'organization_persisted')
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.find((step: Row) => step.id === 'alert_upsert').state, 'ready')
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.find((step: Row) => step.id === 'alert_upsert').blockerCodes, [])
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.evidenceContract.containsRawTerms, false)
    assertOrganizationTenantIdentity(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.queueContract.state, 'ready')
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.detailContract.containsRawTerms, false)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.roleGate.actorRole, 'owner')
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.roleGate.caseActionsAllowed, true)
    assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.organizationId, alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.organizationId)
    assertOrganizationTenantIdentity(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance, secondOrganization.id)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.watchlistScope.crossTenantCollisionAllowed, false)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.state, 'ready')
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.rows.find((row: Row) => row.sourceFamily === 'organization_watchlist').status, 'covered')
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.rows.map((row: Row) => row.sourceFamily), alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.rows.map((row: Row) => row.sourceFamily))
    assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.watchlistScope.alertGeneratorKeys, alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.watchlistScope.alertGeneratorKeys)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.redaction.containsRawContent, false)
    const secondOrgPortalVisibility = orgUtils.organizationAnalystPortalVisibilityAdapter(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof, secondOrgAlertTermsExport.downstreamAuthorization)
    assertOrganizationTenantIdentity(secondOrgPortalVisibility, secondOrganization.id)
    assert.equal(secondOrgPortalVisibility.member.role, 'owner')
    assert.equal(secondOrgPortalVisibility.actionMatrix.review_alert.allowed, true)
    assert.deepEqual(secondOrgPortalVisibility.watchlistScope.activeWatchlistItemIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgPortalVisibility.watchlistScope.activeWatchlistItemIds, adminPortalVisibility.watchlistScope.activeWatchlistItemIds)
    assert.notDeepEqual(secondOrgPortalVisibility.watchlistScope.alertGeneratorKeys, adminPortalVisibility.watchlistScope.alertGeneratorKeys)
    assert.equal(secondOrgPortalVisibility.redaction.nonmemberEnumeration, false)
    assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.alertGeneratorKeys, alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.alertGeneratorKeys)
    assertOrganizationTenantIdentity(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.visibility.allowed, true)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.alertGeneratorKeys, alertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.alertGeneratorKeys)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.ownerOrganizationId, secondOrganization.id)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.crossTenantCollisionAllowed, false)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.partitionKey, 'organizationId')
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.crossTenantCollisionAllowed, false)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.nonmemberEnumeration, false)
    assert.ok(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.proofAssertions.includes('two_org_overlapping_terms'))
    assert.ok(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.proofAssertions.includes('distinct_alert_generator_keys'))
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.visibility.nonmemberEnumeration, false)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.support.mode, 'redacted_summary_only')
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.support.redactionRequired, true)
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.consumerContract.expectedAdapter, 'organizationSharedWatchlistAlertQueueVisibility')
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.consumerContract.requiredStorageBinding, 'workflowContext.organizationId')
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.denialGuardrails.ok, true)
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.denialGuardrails.blockerCodes, [])
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.actorRole, 'owner')
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.roleGates.archive_watchlist, ['owner', 'admin', 'editor'])
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.allowedActionsByRole.support, [])
    assert.ok(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.auditContract.downstreamCorrelationFields.includes('alertBridge.alertGeneratorKeys'))
    assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.auditContract.proofLogQuery, 'GET /api/logs?service=api&message=organization_watchlist')
    assert.ok(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.redactedFields.includes('activeTerms[].term'))
    assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.blockerCodes, [])

    const secondOrgAlertCaseVisibilityResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${secondOrganization.id}/alert-case-visibility`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    }, 200)
    const secondOrgAlertCaseVisibility = parseBody(secondOrgAlertCaseVisibilityResponse.body).alertCaseVisibility
    assert.equal(secondOrgAlertCaseVisibility.schemaVersion, 'organization.alert_case_visibility.v1')
    assertOrganizationTenantIdentity(secondOrgAlertCaseVisibility, secondOrganization.id)
    assert.equal(secondOrgAlertCaseVisibility.member.role, 'owner')
    assert.deepEqual(secondOrgAlertCaseVisibility.alertQueue.watchlistItemIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertCaseVisibility.alertQueue.watchlistItemIds, adminAlertCaseVisibility.alertQueue.watchlistItemIds)
    assert.notDeepEqual(secondOrgAlertCaseVisibility.alertQueue.alertGeneratorKeys, adminAlertCaseVisibility.alertQueue.alertGeneratorKeys)
    assert.deepEqual(secondOrgAlertCaseVisibility.workflowState.alertListing.requiredFilters.watchlistItemIds, [secondOrgWatchlistItem.id])
    assert.equal(secondOrgAlertCaseVisibility.workflowState.alertListing.requiredFilters.organizationId, secondOrganization.id)
    assert.notDeepEqual(secondOrgAlertCaseVisibility.workflowState.alertListing.requiredFilters.alertGeneratorKeys, adminAlertCaseVisibility.workflowState.alertListing.requiredFilters.alertGeneratorKeys)
    assert.equal(secondOrgAlertCaseVisibility.workflowState.alertRecord.crossTenantCollisionAllowed, false)
    assert.deepEqual(secondOrgAlertCaseVisibility.analystPortalAdapter.watchlistScope.activeWatchlistItemIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertCaseVisibility.analystPortalAdapter.watchlistScope.alertGeneratorKeys, adminAlertCaseVisibility.analystPortalAdapter.watchlistScope.alertGeneratorKeys)
    assert.equal(secondOrgAlertCaseVisibility.analystPortalAdapter.watchlistScope.crossTenantCollisionAllowed, false)
    assert.equal(secondOrgAlertCaseVisibility.analystPortalAdapter.redaction.nonmemberEnumeration, false)
    assert.deepEqual(secondOrgAlertCaseVisibility.caseWorkflow.watchlistItemIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertCaseVisibility.caseWorkflow.alertGeneratorKeys, adminAlertCaseVisibility.caseWorkflow.alertGeneratorKeys)
    assert.equal(secondOrgAlertCaseVisibility.caseVisibilityConsumer.organizationId, secondOrganization.id)
    assert.equal(secondOrgAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.ownerOrganizationId, secondOrganization.id)
    assert.deepEqual(secondOrgAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.alertGeneratorKeys, adminAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.alertGeneratorKeys)
    assert.equal(secondOrgAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.crossTenantCollisionAllowed, false)
    assert.equal(secondOrgAlertCaseVisibility.caseVisibilityConsumer.denialContract.nonmemberEnumeration, false)
    assert.ok(secondOrgAlertCaseVisibility.caseVisibilityConsumer.noLeakFields.includes('otherOrg.caseIds'))
    assert.equal(secondOrgAlertCaseVisibility.alertCasePersistenceReadiness.organizationId, secondOrganization.id)
    assert.deepEqual(secondOrgAlertCaseVisibility.alertCasePersistenceReadiness.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
    assert.notDeepEqual(secondOrgAlertCaseVisibility.alertCasePersistenceReadiness.watchlistScope.alertGeneratorKeys, adminAlertCaseVisibility.alertCasePersistenceReadiness.watchlistScope.alertGeneratorKeys)
    assert.equal(secondOrgAlertCaseVisibility.alertCasePersistenceReadiness.watchlistScope.crossTenantCollisionAllowed, false)
    assert.equal(secondOrgAlertCaseVisibility.alertCasePersistenceReadiness.readyForPersistence, true)
    assert.equal(secondOrgAlertCaseVisibility.guardrails.crossTenantCollisionAllowed, false)
    assert.equal(secondOrgAlertCaseVisibility.guardrails.nonmemberEnumeration, false)
    assert.ok(secondOrgAlertCaseVisibility.guardrails.noLeakFields.includes('otherOrg.watchlistItemIds'))

    const secondOrgListResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${secondOrganization.id}/watchlists`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    }, 200)
    assert.deepEqual(parseBody(secondOrgListResponse.body).watchlistItems.map((item: Row) => item.organizationId), [secondOrganization.id])
    assert.deepEqual(parseBody(secondOrgListResponse.body).watchlistItems.map((item: Row) => item.id), [secondOrgWatchlistItem.id])
    assert.deepEqual(parseBody(secondOrgListResponse.body).watchlistItems.map((item: Row) => item.enabled), [true])
    assert.deepEqual(parseBody(secondOrgListResponse.body).watchlistItems.map((item: Row) => item.disabledReason), [null])

    const wrongOrgWatchlistReadResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${secondOrganization.id}/watchlists/${ownerWatchlistItem.id}`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
    }, 404)
    const wrongOrgWatchlistReadDenied = parseBody(wrongOrgWatchlistReadResponse.body).watchlistLookupDenial
    assertCrossOrgWatchlistDenial(wrongOrgWatchlistReadDenied, secondOrganization.id, ownerWatchlistItem.id)
    assert.equal(wrongOrgWatchlistReadDenied.action, 'read_watchlist')
    assert.ok(wrongOrgWatchlistReadDenied.blockedConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
    assert.ok(wrongOrgWatchlistReadDenied.blockedConsumerContracts.includes('organization.case_visibility_consumer.v1'))
    assert.ok(wrongOrgWatchlistReadDenied.blockedConsumerContracts.includes('organization.webhook_destination_access_decision.v1'))
    assert.ok(wrongOrgWatchlistReadDenied.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))

    const wrongOrgWatchlistUpdateResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${secondOrganization.id}/watchlists/${ownerWatchlistItem.id}`,
        headers: authHeaders('org_smoke_owner', 'owner-token'),
        payload: { kind: 'domain', value: 'wrong-org-update.example', reason: 'Wrong org item mutation must not enumerate.', requestId: 'smoke-wrong-org-watchlist-update-denied' },
    }, 404)
    const wrongOrgWatchlistUpdateDenied = parseBody(wrongOrgWatchlistUpdateResponse.body).watchlistLookupDenial
    assertCrossOrgWatchlistDenial(wrongOrgWatchlistUpdateDenied, secondOrganization.id, ownerWatchlistItem.id)
    assert.equal(wrongOrgWatchlistUpdateDenied.action, 'update_watchlist')
    assert.ok(wrongOrgWatchlistUpdateDenied.blockedConsumerContracts.includes('organization.shared_watchlist_readiness_export.v1'))
    assert.ok(wrongOrgWatchlistUpdateDenied.blockedConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
    assert.ok(wrongOrgWatchlistUpdateDenied.blockedConsumerContracts.includes('organization.webhook_destination_access_decision.v1'))
    assert.ok(wrongOrgWatchlistUpdateDenied.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
    assert.ok(wrongOrgWatchlistUpdateDenied.safeFields.includes('itemId'))
    assert.equal(wrongOrgWatchlistUpdateDenied.serviceLogAction, 'organization_watchlist_lookup_denied')
    assert.equal(wrongOrgWatchlistUpdateDenied.requestId, 'smoke-wrong-org-watchlist-update-denied')

}

function assertCrossOrgWatchlistDenial(denial: Row, organizationId: string, itemId: string) {
    assert.equal(denial.schemaVersion, 'organization.watchlist_lookup_denial.v1')
    assert.equal(denial.organizationId, organizationId)
    assert.equal(denial.tenantId, organizationId)
    assert.equal(denial.actorId, 'org_smoke_owner')
    assert.equal(denial.actorRole, 'owner')
    assert.equal(denial.itemId, itemId)
    assert.equal(denial.blockerCode, 'watchlist_not_found_or_cross_org')
    assert.equal(denial.nonmemberEnumeration, false)
    assert.equal(denial.crossOrgEnumerationAllowed, false)
    assert.equal(denial.deniedReadDoesNotAffectActiveTerms, true)
    assert.deepEqual(denial.readinessRefs, {
        sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1',
        alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1',
        alertCasePersistence: 'organization.alert_case_bridge_persistence_receipt.v1',
        caseVisibilityConsumer: 'organization.case_visibility_consumer.v1',
        webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1',
    })
    for (const field of ['otherOrg.watchlistItemIds', 'otherOrg.webhookDestinationIds', 'otherOrg.caseIds']) {
        assert.ok(denial.noLeakFields.includes(field))
    }
}
