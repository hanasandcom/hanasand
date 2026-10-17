import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { buildOrganizationBridgeContext, buildOrganizationDwmAlertReference } from '../src/utils/organizations.ts'

test('watchlist alert reference contract', () => {
    const alertReference = buildOrganizationDwmAlertReference(
        {
            id: 'org_acme',
            name: 'Acme Security',
            slug: 'acme-security',
            default_webhook_policy: 'manual_selection',
            alert_visibility_policy: 'admins',
            member_count: 8,
            owner_count: 1,
            pending_invite_count: 2,
            shared_watchlist_count: 1,
        },
        {
            id: 'watch_domain_acme',
            organization_id: 'org_acme',
            kind: 'domain',
            value: 'acme.example',
            notes: '',
            created_by: 'owner',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }
    )
    assert.equal(alertReference.organizationId, 'org_acme')
    assert.equal(alertReference.tenantId, 'org_acme')
    assert.equal(alertReference.watchlistItemId, 'watch_domain_acme')
    assert.equal(alertReference.watchlist.id, 'watch_domain_acme')
    assert.equal(alertReference.alert.watchlistItemId, 'watch_domain_acme')
    assert.equal(alertReference.alert.route, 'organization_watchlist')
    assert.equal(alertReference.alert.defaultWebhookPolicy, 'manual_selection')
    assert.equal(alertReference.alert.alertVisibilityPolicy, 'admins')
    assert.equal(alertReference.alert.memberCount, 8)
    assert.equal(alertReference.alert.activeMemberCount, 8)
    assert.equal(alertReference.alert.ownerCount, 1)
    assert.deepEqual(alertReference.alert.allowedViewerRoles, ['owner', 'admin'])
    assert.equal(alertReference.alert.removedMemberDenialReason, 'member_removed')
    assert.equal(alertReference.alert.deactivatedMemberDenialReason, 'member_deactivated')
    assert.equal(alertReference.alert.pendingInviteCount, 2)
    assert.equal(alertReference.alert.sharedWatchlistCount, 1)
    assert.equal(alertReference.alert.readinessStatus, 'ready')
    assert.equal(alertReference.webhookContract.defaultWebhookPolicy, 'manual_selection')
    assert.deepEqual(alertReference.webhookContract.allowedViewerRoles, ['owner', 'admin'])
    assert.match(alertReference.alert.casePath, /organizationId=org_acme/)
    assert.match(alertReference.alert.dedupeKey, /org:org_acme:watchlist:watch_domain_acme/)
})
test('organization bridge context defaults', () => {
    assert.deepEqual(buildOrganizationBridgeContext({
        id: 'org_empty',
        name: 'Empty Org',
        slug: 'empty-org',
        member_count: 1,
        owner_count: 1,
        pending_invite_count: 0,
        shared_watchlist_count: 0,
    }), {
        id: 'org_empty',
        name: 'Empty Org',
        slug: 'empty-org',
        defaultWebhookPolicy: 'active_destinations',
        alertVisibilityPolicy: 'members',
        memberCount: 1,
        activeMemberCount: 1,
        ownerCount: 1,
        allowedViewerRoles: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
        removedMemberDenialReason: 'member_removed',
        deactivatedMemberDenialReason: 'member_deactivated',
        pendingInviteCount: 0,
        sharedWatchlistCount: 0,
        readinessStatus: 'needs_watchlist',
    })
})
