import assert from 'node:assert/strict'

import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function createSecondOrganizationFixture(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<{ secondOrganization: Row; secondOrgWatchlistItem: Row; secondOrgAlertTermsExport: Row }> {
    const { apiRequest, authHeaders, parseBody, assertOrganizationTenantIdentity } = ctx
    const { organization } = journey
    const alertTermsExport = journey.alertTermsExport!
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
    return { secondOrganization, secondOrgWatchlistItem, secondOrgAlertTermsExport }
}
