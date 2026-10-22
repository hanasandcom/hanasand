import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { organizationAnalystPortalVisibilityAdapter, organizationLifecycleReadiness } from '../src/utils/organizations.ts'

test('organization lifecycle readiness', () => {
    const lifecycleReadiness = organizationLifecycleReadiness({
        id: 'org_lifecycle',
        name: 'Lifecycle Org',
        slug: 'lifecycle-org',
        created_by: 'owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        role: 'admin',
        member_count: 3,
        owner_count: 1,
        admin_count: 2,
        pending_invite_count: 10,
        shared_watchlist_count: 1,
    })
    assert.equal(lifecycleReadiness.schemaVersion, 'organization.lifecycle_readiness.v1')
    assert.equal(lifecycleReadiness.organizationId, 'org_lifecycle')
    assert.equal(lifecycleReadiness.tenantId, 'org_lifecycle')
    assert.equal(lifecycleReadiness.actorRole, 'admin')
    assert.equal(lifecycleReadiness.counts.activeAdminCount, 2)
    assert.equal(lifecycleReadiness.memberRoleReadiness.adminCanMutate, true)
    assert.equal(lifecycleReadiness.memberRoleReadiness.memberCanReadAndExport, true)
    assert.equal(lifecycleReadiness.memberRoleReadiness.revokedMemberDenial, 'member_revoked')
    assert.equal(lifecycleReadiness.memberRoleReadiness.expiredInviteDenial, 'invite_expired')
    assert.equal(lifecycleReadiness.watchlistReadiness.ready, true)
    assert.equal(lifecycleReadiness.alertExportReadiness.ready, true)
    assert.equal(lifecycleReadiness.cleanupReadiness.cleanupIdempotent, true)
    assert.deepEqual(lifecycleReadiness.typedBlockers, [])
    assert.equal(lifecycleReadiness.readyForOnboarding, true)
    assert.ok(lifecycleReadiness.blockerCatalog.includes('org_missing'))
    assert.ok(lifecycleReadiness.blockerCatalog.includes('org_archived'))
    assert.ok(lifecycleReadiness.blockerCatalog.includes('org_deleted'))
    assert.ok(lifecycleReadiness.blockerCatalog.includes('no_active_admin'))

    const blockedLifecycleReadiness = organizationLifecycleReadiness({
        id: 'org_blocked',
        name: 'Blocked Org',
        slug: 'blocked-org',
        created_by: 'owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        role: 'member',
        member_count: 2,
        owner_count: 0,
        admin_count: 0,
        pending_invite_count: 0,
        shared_watchlist_count: 0,
    })
    assert.deepEqual(blockedLifecycleReadiness.typedBlockers, ['no_active_admin', 'watchlist_setup_required', 'alert_export_unavailable'])
    assert.equal(blockedLifecycleReadiness.alertExportReadiness.ready, false)
    assert.equal(blockedLifecycleReadiness.readyForOnboarding, false)
})
test('analyst portal role gates reuse independent role lists', () => {
    const proof = {
        organizationId: 'org_roles',
        tenantId: 'org_roles',
        actor: { userId: 'owner', role: 'owner', status: 'active' },
        watchlistOwnership: { activeIds: [] },
        alertBridge: { blockerCodes: [], alertGeneratorKeys: [], persistenceContract: { lifecycleBlockers: [] } },
        caseBridge: { blockerCodes: [] },
        webhookBridge: { blockerCodes: [], deliveryContract: { roleGates: { manualTriggerAllowed: true, denialReason: null } } },
    }
    const authorization = {
        visibility: { allowed: true, allowedRoles: ['owner', 'admin'], reason: null },
        allowedActions: ['acknowledge_alert', 'assign_case', 'link_case'],
        member: { role: 'owner' },
    }
    const first = organizationAnalystPortalVisibilityAdapter(proof as any, authorization as any)
    assert.deepEqual(first.actionMatrix.acknowledge_alert.allowedRoles, ['owner', 'admin', 'editor'])
    assert.deepEqual(first.actionMatrix.assign_case.allowedRoles, ['owner', 'admin', 'editor', 'analyst'])
    assert.deepEqual(first.actionMatrix.link_case.allowedRoles, ['owner', 'admin', 'editor', 'analyst'])
    assert.deepEqual(first.actionMatrix.replay_alert.allowedRoles, ['owner', 'admin', 'editor'])
    assert.deepEqual(first.actionMatrix.deliver_webhook.allowedRoles, ['owner', 'admin', 'editor'])
    assert.equal(Object.hasOwn(first.actionMatrix, 'open_audit_timeline'), false)

    first.actionMatrix.acknowledge_alert.allowedRoles.pop()
    assert.deepEqual(first.actionMatrix.assign_case.allowedRoles, ['owner', 'admin', 'editor', 'analyst'])
    assert.deepEqual(organizationAnalystPortalVisibilityAdapter(proof as any, authorization as any).actionMatrix.acknowledge_alert.allowedRoles,
        ['owner', 'admin', 'editor'])
})
