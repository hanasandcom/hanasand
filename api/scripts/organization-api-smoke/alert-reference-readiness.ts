import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function assertAlertReferenceReadiness(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody, assertOrganizationTenantIdentity } = ctx
    const { organization } = journey
    const readiness = journey.readiness!
    const alertTermsExport = journey.alertTermsExport!

    const alertTermsRetryResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-alert-terms-ready-retry`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    const alertTermsRetryExport = parseBody(alertTermsRetryResponse.body).alertTermsExport
    assert.ok(alertTermsRetryExport.activeTerms.every((term: Row) => term.enabled === true))
    assert.ok(alertTermsRetryExport.activeTerms.every((term: Row) => term.disabledReason === null))
    assert.deepEqual(
        alertTermsRetryExport.activeTerms.map((term: Row) => ({
            watchlistItemId: term.watchlistItemId,
            alertGeneratorKey: term.alertGeneratorKey,
            alertGenerationRef: term.alertGenerationRef,
        })),
        alertTermsExport.activeTerms.map((term: Row) => ({
            watchlistItemId: term.watchlistItemId,
            alertGeneratorKey: term.alertGeneratorKey,
            alertGenerationRef: term.alertGenerationRef,
        }))
    )

    assert.equal(readiness.generatedAlertReferences.length, 5)
    const domainReference = readiness.generatedAlertReferences.find((reference: Row) => reference.matchedTerm.value === 'acme-shared.example')
    assert.ok(domainReference)
    assertOrganizationTenantIdentity(domainReference, organization.id)
    assert.equal(domainReference.watchlistItemId, domainReference.watchlist.id)
    assert.equal(domainReference.alert.organizationId, organization.id)
    assert.equal(domainReference.alert.orgId, organization.id)
    assert.equal(domainReference.alert.tenantId, organization.id)
    assert.equal(domainReference.alert.watchlistItemId, domainReference.watchlistItemId)
    assert.equal(domainReference.alert.watchlist.id, domainReference.watchlistItemId)
    assert.equal(domainReference.alert.route, 'organization_watchlist')
    assert.equal(domainReference.alert.casePath, `/dwm?organizationId=${encodeURIComponent(organization.id)}&watchlistItemId=${encodeURIComponent(domainReference.watchlistItemId)}`)
    assert.equal(domainReference.alertOwnership.schemaVersion, 'organization.alert_ownership.v1')
    assertOrganizationTenantIdentity(domainReference.alertOwnership, organization.id)
    assert.equal(domainReference.alertOwnership.ownerOrganizationId, organization.id)
    assert.equal(domainReference.alertOwnership.watchlistItemId, domainReference.watchlistItemId)
    assert.equal(domainReference.alertOwnership.watchlistId, domainReference.watchlistItemId)
    assert.equal(domainReference.alertOwnership.sourceFamily, 'organization_watchlist')
    assert.equal(domainReference.alertOwnership.route, 'organization_watchlist')
    assert.equal(domainReference.alertOwnership.casePath, domainReference.alert.casePath)
    assert.equal(domainReference.alertOwnership.dedupeKey, domainReference.alert.dedupeKey)
    assert.equal(domainReference.alertOwnership.visibilityPolicy, 'admins')
    assert.deepEqual(domainReference.alertOwnership.allowedViewerRoles, ['owner', 'admin'])
    assert.ok(domainReference.alertOwnership.requiredPersistedFields.includes('workflowContext.organizationId'))
    assert.ok(domainReference.alertOwnership.requiredPersistedFields.includes('workflowContext.visibilityDecision'))
    assert.ok(domainReference.alertOwnership.lifecycleBlockers.includes('watchlist_archived'))
    assert.ok(domainReference.alertOwnership.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
    assert.equal(domainReference.alertOwnership.crossTenantCollisionAllowed, false)
    assert.equal(domainReference.ownerContext.schemaVersion, 'organization.alert_reference_owner_context.v1')
    assertOrganizationTenantIdentity(domainReference.ownerContext, organization.id)
    assert.equal(domainReference.ownerContext.ownerOrganizationId, organization.id)
    assert.equal(domainReference.ownerContext.watchlistItemId, domainReference.watchlistItemId)
    assert.equal(domainReference.ownerContext.watchlistId, domainReference.watchlistItemId)
    assert.equal(domainReference.ownerContext.watchlistKind, 'domain')
    assert.equal(domainReference.ownerContext.createdBy, 'org_smoke_owner')
    assert.equal(domainReference.ownerContext.visibilityPolicy, 'admins')
    assert.deepEqual(domainReference.ownerContext.allowedViewerRoles, ['owner', 'admin'])
    assert.equal(domainReference.ownerContext.alertGeneratorKey, domainReference.alert.dedupeKey)
    assert.equal(domainReference.ownerContext.webhookDestinationOrgField, 'destination.org_id')
    assert.equal(domainReference.ownerContext.casePath, domainReference.alert.casePath)
    assert.equal(domainReference.ownerContext.crossTenantCollisionAllowed, false)
    assert.deepEqual(domainReference.alert.alertOwnership, domainReference.alertOwnership)
    assertOrganizationTenantIdentity(domainReference.alert.workflowContext, organization.id)
    assert.equal(domainReference.alert.workflowContext.ownerOrganizationId, organization.id)
    assert.deepEqual(domainReference.alert.workflowContext.watchlistItemIds, [domainReference.watchlistItemId])
    assert.deepEqual(domainReference.alert.workflowContext.alertGeneratorKeys, [domainReference.alert.dedupeKey])
    assert.deepEqual(domainReference.alert.workflowContext.ownerContext, domainReference.ownerContext)
    assert.equal(domainReference.alert.defaultWebhookPolicy, 'manual_selection')
    assert.equal(domainReference.alert.alertVisibilityPolicy, 'admins')
    assert.equal(domainReference.alert.memberCount, 4)
    assert.equal(domainReference.alert.activeMemberCount, 4)
    assert.equal(domainReference.alert.ownerCount, 1)
    assert.deepEqual(domainReference.alert.allowedViewerRoles, ['owner', 'admin'])
    assert.equal(domainReference.alert.removedMemberDenialReason, 'member_removed')
    assert.equal(domainReference.alert.deactivatedMemberDenialReason, 'member_deactivated')
    assert.equal(domainReference.alert.pendingInviteCount, 12)
    assert.equal(domainReference.alert.sharedWatchlistCount, 5)
    assert.equal(domainReference.alert.readinessStatus, 'ready')
    assert.equal(domainReference.webhookContract.orgId, organization.id)
    assert.equal(domainReference.webhookContract.schemaVersion, 'organization.alert_reference_webhook_contract.v1')
    assertOrganizationTenantIdentity(domainReference.webhookContract, organization.id)
    assert.equal(domainReference.webhookContract.watchlistId, domainReference.watchlistItemId)
    assert.equal(domainReference.webhookContract.defaultWebhookPolicy, 'manual_selection')
    assert.equal(domainReference.webhookContract.alertVisibilityPolicy, 'admins')
    assert.deepEqual(domainReference.webhookContract.allowedViewerRoles, ['owner', 'admin'])
    assert.equal(domainReference.webhookContract.requiredDestinationOrgId, organization.id)
    assert.equal(domainReference.webhookContract.selectedDestinationOrgField, 'destination.org_id')
    assert.equal(domainReference.webhookContract.selectedDestinationIdField, 'webhookDestinationIds[]')
    assert.deepEqual(domainReference.webhookContract.ownerContext, domainReference.ownerContext)
    assert.ok(domainReference.webhookContract.noLeakFields.includes('destination.secret'))
    assert.ok(domainReference.webhookContract.noLeakFields.includes('otherOrg.destinationIds'))
    assert.equal(domainReference.organization.defaultWebhookPolicy, 'manual_selection')
    assert.equal(domainReference.organization.alertVisibilityPolicy, 'admins')
    assert.deepEqual(domainReference.organization.allowedViewerRoles, ['owner', 'admin'])
    assert.match(domainReference.alert.casePath, /watchlistItemId=/)
    assert.match(domainReference.alert.dedupeKey, /org:/)
    assert.equal(domainReference.watchlist.termFamily, 'domain')
    assert.equal(domainReference.matchedTerm.termFamily, 'domain')
    assert.equal(domainReference.alert.matchedTerm.termFamily, 'domain')
    assert.deepEqual(domainReference.watchlist.terms, ['acme-shared.example'])

}
