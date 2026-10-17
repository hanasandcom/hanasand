import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'

export async function assertRemovedMemberAccess(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody } = ctx
    const { organization } = journey
    const staleRemovedViewerInvite = journey.staleRemovedViewerInvite!
    const readiness = journey.readiness!

    const staleRemovedViewerAcceptResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/invites/${staleRemovedViewerInvite.id}/accept`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    }, 409)
    const staleRemovedViewerAcceptDenial = parseBody(staleRemovedViewerAcceptResponse.body).inviteAcceptanceDenial
    assert.equal(staleRemovedViewerAcceptDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
    assert.equal(staleRemovedViewerAcceptDenial.organizationId, organization.id)
    assert.equal(staleRemovedViewerAcceptDenial.inviteId, staleRemovedViewerInvite.id)
    assert.equal(staleRemovedViewerAcceptDenial.inviteStatus, 'pending')
    assert.equal(staleRemovedViewerAcceptDenial.memberStatus, 'removed')
    assert.equal(staleRemovedViewerAcceptDenial.blockerCode, 'member_revoked')
    assert.equal(staleRemovedViewerAcceptDenial.removedMemberDenied, true)
    assert.equal(staleRemovedViewerAcceptDenial.nonmemberEnumeration, false)
    assert.ok(staleRemovedViewerAcceptDenial.safeFields.includes('memberStatus'))
    assert.ok(staleRemovedViewerAcceptDenial.noLeakFields.includes('otherOrg.members'))
    assert.ok(staleRemovedViewerAcceptDenial.noLeakFields.includes('destination.secret'))
    assert.ok(staleRemovedViewerAcceptDenial.blockedConsumerContracts.includes('organization.case_visibility_consumer.v1'))
    assert.ok(staleRemovedViewerAcceptDenial.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
    assert.equal(staleRemovedViewerAcceptDenial.readinessRefs.alertCasePersistence, 'organization.alert_case_bridge_persistence_receipt.v1')
    assert.equal(staleRemovedViewerAcceptDenial.ownerlessRecoveryMutationAllowed, false)
    assert.equal(staleRemovedViewerAcceptDenial.accessRequiresAcceptedMembership, true)

    const removedViewerInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { email: 'viewer@example.test', role: 'viewer', requestId: 'smoke-removed-viewer' },
    }, 201)
    const removedViewerInviteWorkflow = parseBody(removedViewerInviteResponse.body).workflow
    assert.equal(removedViewerInviteWorkflow.invitedCount, 0)
    assert.equal(removedViewerInviteWorkflow.skippedCount, 1)
    assert.equal(removedViewerInviteWorkflow.results[0].outcome, 'blocked_removed_member')

    await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    }, 404)

    await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-readiness`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    }, 404)

    const removedViewerAlertTermsResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-removed-viewer-alert-terms`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    }, 404)
    const removedViewerAlertTermsDenial = parseBody(removedViewerAlertTermsResponse.body).organizationAccessDenial
    assert.equal(removedViewerAlertTermsDenial.schemaVersion, 'organization.access_denial.v1')
    assert.equal(removedViewerAlertTermsDenial.organizationId, organization.id)
    assert.equal(removedViewerAlertTermsDenial.actorId, 'org_smoke_viewer')
    assert.equal(removedViewerAlertTermsDenial.route, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.equal(removedViewerAlertTermsDenial.blockerCode, 'nonmember_denied')
    assert.equal(removedViewerAlertTermsDenial.nonmemberEnumeration, false)

    const removedViewerCaseVisibilityResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-case-visibility?requestId=smoke-removed-viewer-case-visibility`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    }, 404)
    const removedViewerCaseVisibilityDenial = parseBody(removedViewerCaseVisibilityResponse.body).organizationAccessDenial
    assert.equal(removedViewerCaseVisibilityDenial.schemaVersion, 'organization.access_denial.v1')
    assert.equal(removedViewerCaseVisibilityDenial.organizationId, organization.id)
    assert.equal(removedViewerCaseVisibilityDenial.actorId, 'org_smoke_viewer')
    assert.equal(removedViewerCaseVisibilityDenial.route, 'GET /api/organizations/:id/alert-case-visibility')
    assert.equal(removedViewerCaseVisibilityDenial.blockerCode, 'nonmember_denied')
    assert.equal(removedViewerCaseVisibilityDenial.nonmemberEnumeration, false)
    assert.equal(removedViewerCaseVisibilityDenial.downstreamRoutes.alertCaseVisibility, 'GET /api/organizations/:id/alert-case-visibility')
    assert.equal(removedViewerCaseVisibilityDenial.downstreamRoutes.webhookDelivery, 'POST /v1/dwm/webhooks/deliver')
    assert.equal(removedViewerCaseVisibilityDenial.downstreamRefs.caseVisibilityConsumer, 'organization.case_visibility_consumer.v1')
    assert.equal(removedViewerCaseVisibilityDenial.downstreamRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
    assert.ok(removedViewerCaseVisibilityDenial.noLeakFields.includes('otherOrg.caseIds'))
    assert.ok(removedViewerCaseVisibilityDenial.noLeakFields.includes('destination.secret'))
    assert.equal(readiness.readinessProof.memberLifecycleProof.denialReasons.removedMember, 'member_removed')
    assert.equal(readiness.readinessProof.memberLifecycleProof.denialReasons.expiredInvite, 'invite_expired')

}
