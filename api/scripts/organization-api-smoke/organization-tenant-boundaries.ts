import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function assertSecondOrganizationTenantBoundaries(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney, secondOrganization: Row, secondOrgWatchlistItem: Row, secondOrgAlertTermsExport: Row): Promise<void> {
    const { apiRequest, authHeaders, parseBody, assertOrganizationTenantIdentity, orgUtils } = ctx
    const alertTermsExport = journey.alertTermsExport!
    const adminAlertCaseVisibility = journey.adminAlertCaseVisibility!
    const adminPortalVisibility = journey.adminPortalVisibility!
    const ownerWatchlistItem = journey.ownerWatchlistItem!
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
