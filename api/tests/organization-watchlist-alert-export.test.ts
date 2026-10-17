import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { organizationAlertCaseRoleActions, organizationWatchlistAlertTermsExport } from '../src/utils/organizations.ts'

test('active watchlist alert export contract', () => {
    const alertTermsExport = organizationWatchlistAlertTermsExport(
        {
            id: 'org_acme',
            name: 'Acme Security',
            slug: 'acme-security',
            member_count: 8,
            owner_count: 1,
            pending_invite_count: 2,
            shared_watchlist_count: 2,
        },
        [
            {
                id: 'watch_keyword_acme',
                organization_id: 'org_acme',
                kind: 'keyword',
                value: 'Credential Reset Lures',
                notes: '',
                status: 'active',
                created_by: 'owner',
                updated_by: 'admin',
                lifecycle_reason: 'Proof fixture seed.',
                lifecycle_request_id: 'proof-fixture-create',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                id: 'watch_paused_acme',
                organization_id: 'org_acme',
                kind: 'domain',
                value: 'paused.example',
                notes: '',
                status: 'paused',
                created_by: 'owner',
                updated_by: 'owner',
                lifecycle_reason: 'Paused for cleanup.',
                lifecycle_request_id: 'proof-fixture-pause',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
        ],
        { userId: 'org_smoke_admin', role: 'admin' }
    )
    assert.equal(alertTermsExport.member.userId, 'org_smoke_admin')
    assert.equal(alertTermsExport.activeTerms.length, 1)
    assert.equal(alertTermsExport.excluded.pausedCount, 1)
    assert.equal(alertTermsExport.recommendedDownstreamRoute, 'organization_watchlist')
    assert.equal(alertTermsExport.alertBridgeContract.schemaVersion, 'organization.watchlist_alert_bridge_contract.v1')
    assert.equal(alertTermsExport.alertBridgeContract.recommendedDownstreamRoute, 'organization_watchlist')
    assert.deepEqual(alertTermsExport.alertBridgeContract.memberProvenance, {
        userId: 'org_smoke_admin',
        role: 'admin',
        status: 'active',
    })
    assert.equal(alertTermsExport.alertBridgeContract.supportAccess.mode, 'support_contract_only')
    assert.equal(alertTermsExport.alertBridgeContract.supportVisibility.mode, 'redacted_summary_only')
    assert.equal(alertTermsExport.alertBridgeContract.supportVisibility.contract, 'admin_support')
    assert.ok(alertTermsExport.alertBridgeContract.supportVisibility.safeFields.includes('activeTermCount'))
    assert.ok(alertTermsExport.alertBridgeContract.supportVisibility.redactedFields.includes('activeTerms[].term'))
    assert.equal(alertTermsExport.alertBridgeContract.caseRouteExpectation.route, 'organization_watchlist')
    assert.equal(alertTermsExport.alertBridgeContract.caseRouteExpectation.pathTemplate, '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId')
    assert.deepEqual(alertTermsExport.alertBridgeContract.caseRouteExpectation.queryFields, ['organizationId', 'watchlistItemId'])
    assert.equal(alertTermsExport.alertBridgeContract.caseRouteExpectation.blockerCode, 'no_case_route')
    assert.deepEqual(alertTermsExport.alertBridgeContract.redactedSummary, {
        schemaVersion: 'organization.watchlist_alert_bridge_redacted_summary.v1',
        organizationId: 'org_acme',
        tenantId: 'org_acme',
        activeTermCount: 1,
        termFamilies: ['keyword'],
        pausedCount: 1,
        archivedCount: 0,
        cleanupRequired: true,
        visibilityPolicy: 'members',
        allowedViewerRoles: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
        containsRawTerms: false,
    })
    assert.equal(alertTermsExport.alertBridgeContract.deniedAccess.nonmember, 'nonmember_denied')
    assert.equal(alertTermsExport.alertBridgeContract.deniedAccess.revokedMember, 'revoked_member_denied')
    assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('activeTerms[].alertGenerationRef.dedupe.key'))
    assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('alertBridgeContract.caseRouteExpectation.pathTemplate'))
    assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('alertBridgeContract.redactedSummary'))
    assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('alertBridgeContract.lifecycleReadiness'))
    assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('alertBridgeContract.alertCaseProof'))
    assert.equal(alertTermsExport.alertBridgeContract.alertGeneratorKeyExpectation, 'alertGenerationRef.dedupe.key')
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('no_active_org'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('no_active_admin'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('org_deleted'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('invite_expired'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('member_revoked'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('watchlist_archived'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('watchlist_paused'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('no_active_terms'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('paused_archived_only'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('cleanup_required'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('alert_bridge_unavailable'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('alert_export_unavailable'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('case_route_unavailable'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('support_redaction_required'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('no_active_watchlist_terms'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('no_case_route'))
    assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('support_only_access'))
    assert.deepEqual(alertTermsExport.alertBridgeContract.typedBlockers, [{
        code: 'paused_watchlist_excluded',
        severity: 'notice',
        message: 'Paused watchlist items are auditable but excluded from active alert matching.',
        count: 1,
    }])
    assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.schemaVersion, 'organization.watchlist_lifecycle_readiness.v1')
    assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.organization.status, 'active')
    assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.organization.deletedBlocker, 'org_deleted')
    assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.member.status, 'active')
    assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.member.revokedBlocker, 'member_revoked')
    assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.invites.expiredInviteBlocker, 'invite_expired')
    assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.activeTermCount, 1)
    assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.pausedCount, 1)
    assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.cleanupRequired, true)
    assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.cleanupIdempotent, true)
    assert.deepEqual(alertTermsExport.alertBridgeContract.lifecycleReadiness.typedBlockers.map(blocker => blocker.code), ['watchlist_paused', 'cleanup_required'])
    assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.alertReplay.status, 'ready')
    assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.caseRoute.status, 'expected')
    assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.schemaVersion, 'organization.watchlist_alert_case_proof.v1')
    assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.organizationId, 'org_acme')
    assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.tenantId, 'org_acme')
    assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.readyForReplay, true)
    assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.activeAdminCount, 1)
    assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.activeTermCount, 1)
    assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.replayRoute, 'organization_watchlist')
    assert.ok(alertTermsExport.alertBridgeContract.alertCaseProof.expectedAlertFields.includes('alertGenerationRef.dedupe.key'))
    assert.ok(alertTermsExport.alertBridgeContract.alertCaseProof.expectedCaseFields.includes('casePath'))
    assert.ok(alertTermsExport.alertBridgeContract.alertCaseProof.expectedSupportFields.includes('redactedSummary'))
    assert.deepEqual(alertTermsExport.alertBridgeContract.alertCaseProof.memberVisibility, {
        mode: 'member_scoped_export',
        userId: 'org_smoke_admin',
        role: 'admin',
        status: 'active',
        nonmemberEnumeration: false,
        revokedMemberDenial: 'member_revoked',
    })
    assert.deepEqual(alertTermsExport.alertBridgeContract.alertCaseProof.roleActionContract.actor, {
        userId: 'org_smoke_admin',
        role: 'admin',
        status: 'active',
        allowedActions: organizationAlertCaseRoleActions('admin'),
    })
    assert.deepEqual(alertTermsExport.alertBridgeContract.alertCaseProof.roleActionContract.roleGates.restore_watchlist, ['owner', 'admin', 'editor'])
    assert.deepEqual(alertTermsExport.alertBridgeContract.alertCaseProof.roleActionContract.roleGates.assign_case, ['owner', 'admin', 'editor', 'analyst'])
    assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.roleActionContract.lifecycleDenials.archivedWatchlist, 'watchlist_archived')
    assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.supportRedaction.blockerCode, 'support_redaction_required')
    assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.cleanupRequired, true)
    assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.pausedExcludedCount, 1)
    assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.archivedExcludedCount, 0)
    assert.deepEqual(alertTermsExport.alertBridgeContract.alertCaseProof.typedBlockers.map(blocker => blocker.code), ['cleanup_required'])
    assert.equal(alertTermsExport.activeTerms[0].alertGenerationRef.schemaVersion, 'organization.watchlist_alert_generation_ref.v1')
    assert.equal(alertTermsExport.activeTerms[0].alertGenerationRef.status, 'active')
    assert.equal(alertTermsExport.activeTerms[0].alertGenerationRef.lifecycle.requestId, 'proof-fixture-create')
    assert.equal(alertTermsExport.activeTerms[0].alertGenerationRef.dedupe.key, alertTermsExport.activeTerms[0].alertGeneratorKey)
    assert.deepEqual(alertTermsExport.activeTerms[0].alertGenerationRef.dedupe.parts, {
        organizationId: 'org_acme',
        tenantId: 'org_acme',
        watchlistItemId: 'watch_keyword_acme',
        termFamily: 'keyword',
        normalizedTerm: 'credential reset lures',
    })
})
