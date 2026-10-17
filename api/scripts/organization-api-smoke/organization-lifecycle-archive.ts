import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function assertOrganizationArchived(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody } = ctx
    const { organization } = journey
    const bulkInviteWorkflow = journey.bulkInviteWorkflow!
    const ownerWatchlistItem = journey.ownerWatchlistItem!
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

}
