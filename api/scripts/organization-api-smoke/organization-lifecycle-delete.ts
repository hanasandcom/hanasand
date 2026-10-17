import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function assertOrganizationDeletedAndReactivated(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody } = ctx
    const { organization } = journey
    const bulkInviteWorkflow = journey.bulkInviteWorkflow!
    const ownerWatchlistItem = journey.ownerWatchlistItem!
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

}
