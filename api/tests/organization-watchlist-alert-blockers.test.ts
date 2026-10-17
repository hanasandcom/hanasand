import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { organizationWatchlistAlertTermsExport, roleCanWriteWatchlist } from '../src/utils/organizations.ts'

test('empty watchlist alert export blockers', () => {
    const emptyAlertTermsExport = organizationWatchlistAlertTermsExport(
        {
            id: 'org_empty',
            name: 'Empty Org',
            slug: 'empty-org',
            member_count: 1,
            owner_count: 1,
            pending_invite_count: 0,
            shared_watchlist_count: 0,
        },
        [],
        { userId: 'org_empty_owner', role: 'owner' }
    )
    assert.equal(emptyAlertTermsExport.canGenerateAlerts, false)
    assert.deepEqual(emptyAlertTermsExport.blockedReasons, ['needs_shared_watchlist_item'])
    assert.deepEqual(emptyAlertTermsExport.alertBridgeContract.typedBlockers.map(blocker => blocker.code), ['no_active_watchlist_terms'])
    assert.equal(emptyAlertTermsExport.alertBridgeContract.typedBlockers[0].severity, 'blocker')
    assert.deepEqual(emptyAlertTermsExport.alertBridgeContract.lifecycleReadiness.typedBlockers.map(blocker => blocker.code), ['no_active_terms', 'alert_bridge_unavailable'])
    assert.equal(emptyAlertTermsExport.alertBridgeContract.lifecycleReadiness.alertReplay.status, 'blocked')
    assert.equal(emptyAlertTermsExport.alertBridgeContract.alertCaseProof.readyForReplay, false)
    assert.deepEqual(emptyAlertTermsExport.alertBridgeContract.alertCaseProof.typedBlockers.map(blocker => blocker.code), ['no_active_terms', 'alert_export_unavailable'])
})
test('inactive watchlist terms are excluded', () => {
    const inactiveOnlyAlertTermsExport = organizationWatchlistAlertTermsExport(
        {
            id: 'org_inactive_only',
            name: 'Inactive Only Org',
            slug: 'inactive-only',
            member_count: 2,
            owner_count: 1,
            pending_invite_count: 0,
            shared_watchlist_count: 2,
        },
        [
            {
                id: 'watch_paused_only',
                organization_id: 'org_inactive_only',
                kind: 'domain',
                value: 'paused-only.example',
                notes: '',
                status: 'paused',
                created_by: 'owner',
                updated_by: 'owner',
                lifecycle_reason: 'Pause proof term.',
                lifecycle_request_id: 'proof-pause-only',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                id: 'watch_archived_only',
                organization_id: 'org_inactive_only',
                kind: 'vendor',
                value: 'Archived Only Vendor',
                notes: '',
                status: 'archived',
                created_by: 'owner',
                updated_by: 'owner',
                lifecycle_reason: 'Archive proof term.',
                lifecycle_request_id: 'proof-archive-only',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
        ],
        { userId: 'org_inactive_admin', role: 'admin' }
    )
    assert.equal(inactiveOnlyAlertTermsExport.activeTerms.length, 0)
    assert.equal(inactiveOnlyAlertTermsExport.excluded.pausedCount, 1)
    assert.equal(inactiveOnlyAlertTermsExport.excluded.archivedCount, 1)
    assert.equal(inactiveOnlyAlertTermsExport.alertBridgeContract.alertCaseProof.readyForReplay, false)
    assert.deepEqual(inactiveOnlyAlertTermsExport.alertBridgeContract.alertCaseProof.typedBlockers.map(blocker => blocker.code), [
        'no_active_terms',
        'alert_export_unavailable',
        'paused_archived_only',
        'cleanup_required',
    ])
    assert.equal(inactiveOnlyAlertTermsExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.cleanupRequired, true)
})
test('watchlist write role restrictions', () => {
    assert.equal(roleCanWriteWatchlist('member'), false)
    assert.equal(roleCanWriteWatchlist('viewer'), false)
    assert.equal(roleCanWriteWatchlist(undefined), false)
})
