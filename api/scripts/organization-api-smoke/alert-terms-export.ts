import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'

export async function runAlertTermsExport(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, orgUtils, authHeaders, parseBody, assertOrganizationTenantIdentity } = ctx
    const { organization } = journey

    const alertTermsResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?request_id=smoke-alert-terms-ready`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    const alertTermsExport = journey.alertTermsExport = parseBody(alertTermsResponse.body).alertTermsExport
    assert.equal(alertTermsExport.schemaVersion, 'organization.watchlist_alert_terms_export.v1')
    assertOrganizationTenantIdentity(alertTermsExport, organization.id)
    assert.deepEqual(alertTermsExport.member, { userId: 'org_smoke_admin', role: 'admin', status: 'active' })
    assert.deepEqual(alertTermsExport, orgUtils.organizationWatchlistAlertTermsExport(
        ctx.organizationSummary(organization.id, 'admin'),
        [...ctx.watchlists.values()]
            .filter(item => item.organization_id === organization.id)
            .sort((left, right) => `${left.status}:${left.kind}:${left.value}`.localeCompare(`${right.status}:${right.kind}:${right.value}`)),
        { userId: 'org_smoke_admin', role: 'admin' },
    ))
    assert.equal(alertTermsExport.activeTerms.length, 5)
    assert.deepEqual(alertTermsExport.termFamilies, ['actor', 'company', 'domain', 'keyword', 'vendor'])
    assert.equal(new Set(alertTermsExport.activeTerms.map((term: { alertGeneratorKey: string }) => term.alertGeneratorKey)).size, 5)
    assert.equal(alertTermsExport.webhookDestinationAccessDecision.destinationScope.crossOrgDestinationAllowed, false)
    assert.equal(alertTermsExport.webhookDestinationAccessDecision.destinationScope.nonmemberDestinationEnumeration, false)
    assert.equal(alertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.readyForDelivery, false)
    assert.equal(alertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.blockerReason, 'manual_webhook_selection_required')
    assert.ok(alertTermsExport.webhookDestinationAccessDecision.deliveryConsumerReceipt.noLeakFields.includes('destination.secret'))
    assert.ok(ctx.serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_exported'
        && log.metadata.requestId === 'smoke-alert-terms-ready'))
    const adminPortalVisibility = journey.adminPortalVisibility = orgUtils.organizationAnalystPortalVisibilityAdapter(
        alertTermsExport.sharedWatchlistDownstreamProof,
        alertTermsExport.downstreamAuthorization,
    )
    assert.equal(adminPortalVisibility.schemaVersion, 'organization.analyst_portal_visibility_adapter.v1')
    assertOrganizationTenantIdentity(adminPortalVisibility, organization.id)
    assert.equal(adminPortalVisibility.actionMatrix.review_alert.allowed, true)
    assert.equal(adminPortalVisibility.actionMatrix.deliver_webhook.allowed, false)
    assert.equal(adminPortalVisibility.watchlistScope.crossTenantCollisionAllowed, false)
    assert.equal(adminPortalVisibility.redaction.nonmemberEnumeration, false)
}
