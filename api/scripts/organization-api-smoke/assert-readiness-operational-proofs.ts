import assert from 'node:assert/strict'
import type { AlertAssertionContext, Row } from './alert-assertion-context.ts'

export function assertReadinessWorkspaceProofs(readiness: Row, { organization, assertOrganizationTenantIdentity }: AlertAssertionContext): void {
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.activeWatchlistTermCount, 5)
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.canSupportTenMemberSharedWatchlistRollout, true)
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.readinessRefs.inviteLifecycle, 'organization.invite_lifecycle_readiness_proof.v1')
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.readinessRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.readinessRefs.alertGenerationConsumer, 'organization.watchlist_alert_generation_consumer.v1')
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.readinessRefs.alertCasePersistence, 'organization.alert_case_bridge_persistence_receipt.v1')
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.readinessRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.routeRefs.bulkInvite, 'POST /api/organizations/:id/invites')
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.routeRefs.listMembers, 'GET /api/organizations/:id/members')
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.routeRefs.createWatchlist, 'POST /api/organizations/:id/watchlists')
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.routeRefs.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.routeRefs.alertCaseVisibility, 'GET /api/organizations/:id/alert-case-visibility')
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.routeRefs.webhookDeliver, 'POST /v1/dwm/webhooks/deliver')
    assert.deepEqual(readiness.readinessProof.tenMemberWorkspaceProof.lifecycleBlockers, [])
    assert.ok(readiness.readinessProof.tenMemberWorkspaceProof.noEnumerationFields.includes('otherOrg.members'))
    assert.ok(readiness.readinessProof.tenMemberWorkspaceProof.noEnumerationFields.includes('destination.secret'))
    assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
    assert.equal(readiness.readinessProof.alertGenerationHandoff.schemaVersion, 'organization.watchlist_alert_generation_handoff.v1')
    assert.equal(readiness.readinessProof.alertGenerationHandoff.sourceContract, 'organization.watchlist_alert_generation_consumer.v1')
    assert.equal(readiness.readinessProof.alertGenerationHandoff.route, 'organization_watchlist')
    assert.equal(readiness.readinessProof.alertGenerationHandoff.exportRoute, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.equal(readiness.readinessProof.alertGenerationHandoff.cleanupRoute, 'POST /api/organizations/:id/watchlists/cleanup')
    assertOrganizationTenantIdentity(readiness.readinessProof.alertGenerationHandoff, organization.id)
    assert.equal(readiness.readinessProof.alertGenerationHandoff.activeTermCount, readiness.alertGenerationBridge.activeWatchlistTerms.length)
    assert.deepEqual(
        readiness.readinessProof.alertGenerationHandoff.watchlistItemIds.sort(),
        readiness.alertGenerationBridge.activeWatchlistTerms.map((term: Row) => term.watchlistItemId).sort(),
    )
    assert.deepEqual(
        readiness.readinessProof.alertGenerationHandoff.alertGeneratorKeys.sort(),
        readiness.alertGenerationBridge.activeWatchlistTerms
            .map((term: Row) => `org:${organization.id}:watchlist:${term.watchlistItemId}:${term.termFamily}:${String(term.term).trim().toLowerCase()}`)
            .sort(),
    )
    assert.ok(readiness.readinessProof.alertGenerationHandoff.matchingInputFields.includes('alertGenerationRef'))
    assert.ok(readiness.readinessProof.alertGenerationHandoff.expectedPersistedAlertFields.includes('workflowContext.organizationId'))
    assert.ok(readiness.readinessProof.alertGenerationHandoff.expectedPersistedAlertFields.includes('casePath'))
    assert.ok(readiness.readinessProof.alertGenerationHandoff.expectedCaseFields.includes('allowedActions'))
    assert.deepEqual(readiness.readinessProof.alertGenerationHandoff.dedupeKeyFields, ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'])
    assert.deepEqual(readiness.readinessProof.alertGenerationHandoff.replaySteps, ['export_alert_terms', 'match_retained_capture', 'persist_org_alert', 'verify_case_visibility', 'deliver_webhook', 'archive_cleanup'])
    assert.equal(readiness.readinessProof.alertGenerationHandoff.readinessRefs.alertQueue, 'organization.alert_queue_visibility_proof.v1')
    assert.equal(readiness.readinessProof.alertGenerationHandoff.readinessRefs.caseAssignment, 'organization.case_assignment_readiness.v1')
    assert.equal(readiness.readinessProof.alertGenerationHandoff.readinessRefs.destinationOwnership, 'organization.webhook_destination_ownership_readiness.v1')
    assert.ok(readiness.readinessProof.alertGenerationHandoff.lifecycleBlockers.includes('watchlist_archived'))
    assert.deepEqual(readiness.readinessProof.alertGenerationHandoff.blockerCodes, ['role_not_allowed'])
    assert.equal(readiness.readinessProof.alertGenerationHandoff.crossOrgDedupeAllowed, false)
    assert.equal(readiness.readinessProof.alertGenerationHandoff.nonmemberEnumeration, false)
    assert.equal(readiness.readinessProof.uiProof.nonmemberEnumeration, false)
    assert.ok(readiness.readinessProof.uiProof.safeFields.includes('routes'))
    assert.ok(readiness.readinessProof.uiProof.safeFields.includes('alertQueueProof'))
}

export function assertReadinessUiAuditProofs(readiness: Row): void {
    assert.ok(readiness.readinessProof.uiProof.safeFields.includes('webhookDeliveryProof'))
    assert.ok(readiness.readinessProof.uiProof.safeFields.includes('memberLifecycleProof'))
    assert.ok(readiness.readinessProof.uiProof.safeFields.includes('inviteLifecycleProof'))
    assert.ok(readiness.readinessProof.uiProof.redactedFields.includes('activeTerms[].term'))
    assert.equal(readiness.readinessProof.cleanupProof.cleanupIdempotent, true)
    assert.equal(readiness.readinessProof.cleanupProof.cleanupRoute, 'POST /api/organizations/:id/watchlists/cleanup')
    assert.equal(readiness.readinessProof.customerWorkflowProof.schemaVersion, 'organization.customer_workflow_proof.v1')
    assert.deepEqual(readiness.readinessProof.customerWorkflowProof.routeSequence, [
        'POST /api/organizations',
        'POST /api/organizations/:id/invites',
        'POST /api/organizations/invites/:inviteId/accept',
        'GET /api/organizations/:id/members',
        'POST /api/organizations/:id/watchlists',
        'GET /api/organizations/:id/watchlists/alert-terms',
        'GET /api/organizations/:id/alert-case-visibility',
        'POST /api/organizations/:id/watchlists/cleanup',
    ])
    assert.ok(readiness.readinessProof.customerWorkflowProof.requiredOrgFields.includes('counts.activeAdminCount'))
    assert.ok(readiness.readinessProof.customerWorkflowProof.requiredWatchlistFields.includes('alertGenerationRef'))
    assert.ok(readiness.readinessProof.customerWorkflowProof.requiredAlertFields.includes('workflowContext.visibilityDecision'))
    assert.equal(readiness.readinessProof.customerWorkflowProof.roleGates.ownerAdminMutate, true)
    assert.equal(readiness.readinessProof.customerWorkflowProof.roleGates.memberReadExport, false)
    assert.equal(readiness.readinessProof.customerWorkflowProof.roleGates.viewerReadOnly, true)
    assert.equal(readiness.readinessProof.customerWorkflowProof.roleGates.nonmemberEnumeration, false)
    assert.deepEqual(readiness.readinessProof.customerWorkflowProof.lifecycleBlockers, ['role_not_allowed'])
    assert.deepEqual(readiness.readinessProof.customerWorkflowProof.downstreamConsumers, ['alert_queue', 'case_workflow', 'webhook_delivery', 'dashboard_readiness'])
    assert.equal(readiness.readinessProof.customerWorkflowProof.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
}

export function assertReadinessSharedWatchlist(readiness: Row, { organization }: AlertAssertionContext): void {
    assert.equal(readiness.sharedWatchlistDownstreamProof.schemaVersion, 'organization.shared_watchlist_downstream_proof.v1')
    assert.equal(readiness.sharedWatchlistDownstreamProof.actor.userId, 'org_smoke_member')
    assert.equal(readiness.sharedWatchlistDownstreamProof.actor.role, 'reader')
    assert.equal(readiness.sharedWatchlistDownstreamProof.actor.canManageWatchlists, false)
    assert.equal(readiness.sharedWatchlistDownstreamProof.actor.canExportActiveTerms, false)
    assert.deepEqual(readiness.sharedWatchlistDownstreamProof.actor.allowedActions, [])
    assert.deepEqual(readiness.sharedWatchlistDownstreamProof.caseBridge.blockerCodes, ['role_not_allowed'])
    assert.deepEqual(readiness.sharedWatchlistDownstreamProof.alertBridge.blockerCodes, [])
    assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.schemaVersion, 'organization.shared_watchlist_monitoring_workflow.v1')
    assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.organizationId, organization.id)
    assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.persistenceLevel, 'organization_persisted')
    assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.entrypoint.route, 'GET /api/organizations/:id/watchlists/alert-terms')
    assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.find((step: Row) => step.id === 'alert_queue_visibility').state, 'blocked')
    assert.deepEqual(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.find((step: Row) => step.id === 'alert_queue_visibility').blockerCodes, ['role_not_allowed'])
    assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.operatorActions.acknowledgeAlert, false)
    assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.operatorActions.linkCase, false)
    assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.evidenceContract.containsRawTerms, false)
    assert.equal(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.schemaVersion, 'organization.shared_watchlist_analyst_portal_workflow.v1')
    assert.equal(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.queueContract.state, 'blocked')
    assert.deepEqual(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.queueContract.blockerCodes, ['role_not_allowed'])
    assert.equal(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.roleGate.actorRole, 'reader')
    assert.equal(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.roleGate.readAlertsAllowed, false)
    assert.equal(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.roleGate.caseActionsAllowed, false)
    assert.equal(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.detailContract.containsRawTerms, false)
    assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.schemaVersion, 'organization.shared_watchlist_enrichment_provenance.v1')
    assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceCoverage.state, 'ready')
    assert.deepEqual(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceCoverage.activeFamilies, ['organization_watchlist'])
    assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.schemaVersion, 'organization.shared_watchlist_source_coverage_health.v1')
    assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.state, 'ready')
    assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.rows.find((row: Row) => row.sourceFamily === 'organization_watchlist').status, 'covered')
    assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.redaction.containsRawContent, false)
    assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.watchlistScope.crossTenantCollisionAllowed, false)
}
