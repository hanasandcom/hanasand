import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'

export async function assertAlertReferenceViewerAccess(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody, assertOrganizationTenantIdentity } = ctx
    const { organization } = journey

    const viewerReadinessResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-readiness`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    }, 200)
    assert.equal(parseBody(viewerReadinessResponse.body).alertReadiness.watchlistItemCount, 5)

    const viewerAlertTermsDeniedResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-viewer-alert-terms-denied`,
        headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    }, 403)
    const viewerAlertTermsDeniedBody = parseBody(viewerAlertTermsDeniedResponse.body)
    assert.equal(viewerAlertTermsDeniedBody.error, 'Organization alert visibility does not allow this member to export alert terms.')
    assert.ok(!('alertTermsExport' in viewerAlertTermsDeniedBody))
    const viewerAlertTermsDenied = viewerAlertTermsDeniedBody.alertTermsExportDenial
    assert.equal(viewerAlertTermsDenied.schemaVersion, 'organization.watchlist_alert_terms_export_denial.v1')
    assertOrganizationTenantIdentity(viewerAlertTermsDenied, organization.id)
    assert.deepEqual(viewerAlertTermsDenied.member, {
        userId: 'org_smoke_viewer',
        role: 'reader',
        status: 'active',
    })
    assert.equal(viewerAlertTermsDenied.visibility.allowed, false)
    assert.equal(viewerAlertTermsDenied.visibility.reason, 'role_not_allowed')
    assert.equal(viewerAlertTermsDenied.visibility.alertVisibilityPolicy, 'admins')
    assert.deepEqual(viewerAlertTermsDenied.visibility.allowedRoles, ['owner', 'admin'])
    assert.deepEqual(viewerAlertTermsDenied.blockerCodes, ['role_not_allowed'])
    assert.equal(viewerAlertTermsDenied.nonmemberEnumeration, false)
    assert.ok(viewerAlertTermsDenied.redactedFields.includes('activeTerms[]'))
    assert.ok(viewerAlertTermsDenied.redactedFields.includes('alertGeneratorKeys[]'))
    assert.ok(!('activeTerms' in viewerAlertTermsDenied))
    assert.ok(!('activeWatchlistTerms' in viewerAlertTermsDenied))
    assert.ok(!JSON.stringify(viewerAlertTermsDenied).includes('acme-shared.example'))
    assert.equal(viewerAlertTermsDenied.routes.alertReadiness, 'GET /api/organizations/:id/alert-readiness')
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.schemaVersion, 'organization.watchlist_alert_generation_consumer_denial.v1')
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.member.role, 'reader')
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.canReadSharedWatchlists, true)
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.canExportAlertTerms, false)
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.canMutateWatchlists, false)
    assert.deepEqual(viewerAlertTermsDenied.alertGenerationConsumerDenial.allowedExportRoles, ['owner', 'admin'])
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.denialReason, 'role_not_allowed')
    assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.nonmemberEnumeration, false)
    assert.ok(viewerAlertTermsDenied.alertGenerationConsumerDenial.noLeakFields.includes('activeTerms[]'))
    assert.ok(viewerAlertTermsDenied.alertGenerationConsumerDenial.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
    assert.ok(!JSON.stringify(viewerAlertTermsDenied.alertGenerationConsumerDenial).includes('acme-shared.example'))
    assert.equal(viewerAlertTermsDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

}
