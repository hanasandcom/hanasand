import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'

export async function runDownstreamContractsAndInviteDenials(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, orgUtils, authHeaders, parseBody, assertOrganizationTenantIdentity } = ctx
    const { organization } = journey
    const readiness = journey.readiness!
    const alertTermsExport = journey.alertTermsExport!

    assert.deepEqual(
        alertTermsExport.activeWatchlistTerms,
        readiness.alertGenerationBridge.activeWatchlistTerms
    )

    const memberAlertTermsReadyResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-member-alert-terms-ready`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 403)
    const memberAlertTermsDenialBody = parseBody(memberAlertTermsReadyResponse.body)
    assert.equal(memberAlertTermsDenialBody.error, 'Organization alert visibility does not allow this member to export alert terms.')
    assert.ok(!('alertTermsExport' in memberAlertTermsDenialBody))
    assert.equal(memberAlertTermsDenialBody.organization.id, organization.id)
    const memberAlertTermsDenial = memberAlertTermsDenialBody.alertTermsExportDenial
    assert.equal(memberAlertTermsDenial.schemaVersion, 'organization.watchlist_alert_terms_export_denial.v1')
    assertOrganizationTenantIdentity(memberAlertTermsDenial, organization.id)
    assert.deepEqual(memberAlertTermsDenial.member, {
        userId: 'org_smoke_member',
        role: 'reader',
        status: 'active',
    })
    assert.equal(memberAlertTermsDenial.visibility.allowed, false)
    assert.equal(memberAlertTermsDenial.visibility.reason, 'role_not_allowed')
    assert.deepEqual(memberAlertTermsDenial.visibility.allowedRoles, ['owner', 'admin'])
    assert.deepEqual(memberAlertTermsDenial.allowedActions, [])
    assert.equal(memberAlertTermsDenial.routes.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.ok(memberAlertTermsDenial.safeFields.includes('visibility.reason'))
    assert.ok(memberAlertTermsDenial.redactedFields.includes('activeTerms[]'))
    assert.ok(memberAlertTermsDenial.redactedFields.includes('watchlistScope.alertGeneratorKeys'))
    assert.deepEqual(memberAlertTermsDenial.blockerCodes, ['role_not_allowed'])
    assert.equal(memberAlertTermsDenial.nonmemberEnumeration, false)
    assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.schemaVersion, 'organization.watchlist_alert_generation_consumer_denial.v1')
    assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.organizationId, organization.id)
    assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.member.role, 'reader')
    assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.canReadSharedWatchlists, true)
    assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.canExportAlertTerms, false)
    assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.canMutateWatchlists, false)
    assert.deepEqual(memberAlertTermsDenial.alertGenerationConsumerDenial.allowedExportRoles, ['owner', 'admin'])
    assert.deepEqual(memberAlertTermsDenial.alertGenerationConsumerDenial.readSharedWatchlistRoles, ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'])
    assert.deepEqual(memberAlertTermsDenial.alertGenerationConsumerDenial.mutateWatchlistRoles, ['owner', 'admin', 'editor'])
    assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.denialReason, 'role_not_allowed')
    assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.nonmemberEnumeration, false)
    assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.removedMemberDenied, 'member_revoked')
    assert.ok(memberAlertTermsDenial.alertGenerationConsumerDenial.noLeakFields.includes('otherOrg.watchlistItemIds'))
    assert.ok(!('activeTerms' in memberAlertTermsDenial.alertGenerationConsumerDenial))
    assert.equal(memberAlertTermsDenial.auditProof.schemaVersion, 'organization.watchlist_alert_terms_denial_audit.v1')
    assert.equal(memberAlertTermsDenial.auditProof.serviceLogAction, 'organization_watchlist_alert_terms_export_denied')
    assert.equal(memberAlertTermsDenial.auditProof.requestId, 'smoke-member-alert-terms-ready')
    assert.deepEqual(memberAlertTermsDenial.auditProof.requiredMetadataFields, [
        'requestId',
        'role',
        'alertVisibilityPolicy',
        'allowedRoles',
        'denialReason',
        'blockerCodes',
    ])
    assert.ok(memberAlertTermsDenial.auditProof.redactedFields.includes('activeTerms[]'))
    assert.equal(memberAlertTermsDenial.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
    const deniedQueueContract = orgUtils.organizationSharedWatchlistAlertQueueVisibility(readiness.sharedWatchlistDownstreamProof)
    assert.equal(deniedQueueContract.visibility.allowed, false)
    assert.equal(deniedQueueContract.visibility.denialReason, 'role_not_allowed')
    assert.equal(deniedQueueContract.actionGates.readAlertsAllowed, false)
    assert.equal(deniedQueueContract.roleActionMatrix.actorRole, 'reader')
    assert.deepEqual(deniedQueueContract.roleActionMatrix.allowedActions, [])
    assert.deepEqual(deniedQueueContract.roleActionMatrix.allowedActionsByRole.viewer, [])
    assert.deepEqual(deniedQueueContract.roleActionMatrix.roleGates.manage_invites, ['owner', 'admin'])
    assert.equal(deniedQueueContract.denialResponseContract.blocked, true)
    assert.equal(deniedQueueContract.denialResponseContract.statusCode, 403)
    assert.equal(deniedQueueContract.denialResponseContract.errorCode, 'org_alert_visibility_denied')
    assert.equal(deniedQueueContract.denialResponseContract.reason, 'role_not_allowed')
    assert.deepEqual(deniedQueueContract.denialResponseContract.responseShape, [
        'error',
        'message',
        'organizationId',
        'visibilityDecision',
        'allowedRoles',
        'requestId',
    ])
    assert.ok(deniedQueueContract.denialResponseContract.noLeakFields.includes('persistedAlertContract'))
    assert.ok(deniedQueueContract.denialResponseContract.noLeakFields.includes('member.userId'))
    assert.equal(deniedQueueContract.denialResponseContract.auditEventAction, 'organization_watchlist_alert_visibility_denied')
    assert.equal(deniedQueueContract.denialGuardrails.ok, true)
    assert.deepEqual(deniedQueueContract.denialGuardrails.blockerCodes, [])
    const deniedIntegrationGuardrails = orgUtils.organizationSharedWatchlistIntegrationGuardrails(readiness.sharedWatchlistDownstreamProof)
    assert.equal(deniedIntegrationGuardrails.caseSafety.ok, true)
    assert.equal(deniedIntegrationGuardrails.caseSafety.actorCanOpenCase, false)
    assert.equal(deniedIntegrationGuardrails.caseSafety.actorCanAssignCase, false)
    assert.deepEqual(deniedIntegrationGuardrails.caseSafety.blockerCodes, [])

}
