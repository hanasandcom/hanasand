import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import { queryOnce } from '../../src/utils/db.ts'
import { organizationRetentionCutoff } from '../../src/utils/organizationPrivacy.ts'

export async function setupOrganizationRetentionScenario() {
    const old = '2020-01-01T00:00:00.000Z'
    const currentPassword = 'retention-owner-password'
    assert.equal(organizationRetentionCutoff(30, new Date('2024-03-31T12:00:00.000Z')), '2024-03-01T12:00:00.000Z')
    const users = [
        'retention_user_a', 'retention_user_b', 'retention_user_c', 'retention_user_removed',
        'retention_user_recovered', 'retention_user_poison', 'retention_user_fair',
        'retention_user_page', 'retention_user_concurrent', 'retention_user_auth_owner', 'retention_user_auth_admin',
        'retention_user_page_a', 'retention_user_page_b', 'retention_user_locked',
    ]
    for (const user of users) {
        await queryOnce('INSERT INTO users (id, name, password, avatar) VALUES ($1, $1, $2, $3)', [user, user === 'retention_user_auth_owner' ? await bcrypt.hash(currentPassword, 4) : 'local-test', ''])
    }
    for (const [id, user, name, slug] of [
        ['retention_org_a', users[0], 'Retention Customer A', 'retention-customer-a'],
        ['retention_org_b', users[1], 'Retention Customer B', 'retention-customer-b'],
        ['retention_org_c', users[2], 'Sensitive Customer C', 'sensitive-customer-c'],
        ['retention_org_recovered', users[4], 'Recovered Runtime', 'recovered-runtime'],
        ['retention_org_poison', users[5], 'Missing Mirror', 'missing-mirror'],
        ['retention_org_fair', users[6], 'Fair Tenant', 'fair-tenant'],
        ['retention_org_page', users[7], 'Protected Pages', 'protected-pages'],
        ['retention_org_concurrent', users[8], 'Concurrent Tenant', 'concurrent-tenant'],
        ['retention_org_auth', users[9], 'Authenticated Deletion', 'authenticated-deletion'],
        ['retention_org_page_a', users[11], 'Paged Tenant A', 'paged-tenant-a'],
        ['retention_org_page_b', users[12], 'Paged Tenant B', 'paged-tenant-b'],
        ['retention_org_locked', users[13], 'Locked Tenant', 'locked-tenant'],
    ]) {
        await queryOnce('INSERT INTO organizations (id, name, slug, status, retention_days, created_by) VALUES ($1, $3, $4, \'archived\', 30, $2)', [id, user, name, slug])
        await queryOnce('INSERT INTO organization_members (organization_id, user_id, role, status, joined_at) VALUES ($1, $2, \'owner\', \'active\', $3)', [id, user, old])
    }
    await queryOnce('INSERT INTO organization_members (organization_id, user_id, role, status, joined_at, removed_at) VALUES (\'retention_org_a\', $1, \'member\', \'removed\', NOW(), $2)', [users[3], old])
    await queryOnce('INSERT INTO organization_members (organization_id, user_id, role, status, joined_at) VALUES (\'retention_org_auth\', $1, \'admin\', \'active\', $2)', [users[10], old])
    await queryOnce(`
    INSERT INTO tokens (id, token, ip, user_agent) VALUES
        ($1, 'retention-owner-token', '127.0.0.1', 'retention-smoke'),
        ($2, 'retention-admin-token', '127.0.0.1', 'retention-smoke'),
        ($3, 'retention-poison-token', '127.0.0.1', 'retention-smoke'),
        ($4, 'retention-locked-token', '127.0.0.1', 'retention-smoke')
`, [users[9], users[10], users[5], users[13]])

    await queryOnce('INSERT INTO organization_invites (id, organization_id, email, invited_by, status, created_at, expires_at, revoked_at) VALUES (\'invite_delete\', \'retention_org_a\', \'delete@example.test\', $1, \'revoked\', NOW(), NOW() + INTERVAL \'1 day\', $2), (\'invite_hold\', \'retention_org_a\', \'hold@example.test\', $1, \'revoked\', NOW(), NOW() + INTERVAL \'1 day\', $2), (\'invite_other\', \'retention_org_b\', \'other@example.test\', $3, \'revoked\', NOW(), NOW() + INTERVAL \'1 day\', $2)', [users[0], old, users[1]])
    await queryOnce('INSERT INTO admin_access_recovery_approvals (request_id, organization_id, invite_id, requested_by, expires_at) VALUES (\'recovery_hold\', \'retention_org_a\', \'invite_hold\', $1, NOW() + INTERVAL \'1 day\')', [users[0]])
    await queryOnce('INSERT INTO organization_invites (id, organization_id, email, invited_by, status, created_at, expires_at, revoked_at) VALUES (\'invite_delete_hold\', \'retention_org_c\', \'held-customer@example.test\', $1, \'revoked\', NOW(), NOW() + INTERVAL \'1 day\', $2)', [users[2], old])
    await queryOnce('INSERT INTO admin_access_recovery_approvals (request_id, organization_id, invite_id, requested_by, expires_at) VALUES (\'recovery_delete_hold\', \'retention_org_c\', \'invite_delete_hold\', $1, NOW() + INTERVAL \'1 day\')', [users[2]])
    await queryOnce('INSERT INTO organization_watchlist_items (id, organization_id, kind, value, status, created_by, created_at, updated_at, archived_at) VALUES (\'watch_delete\', \'retention_org_a\', \'domain\', \'delete.example\', \'archived\', $1, $3, $3, $3), (\'watch_hold\', \'retention_org_a\', \'domain\', \'hold.example\', \'archived\', $1, $3, $3, $3), (\'watch_other\', \'retention_org_b\', \'domain\', \'other.example\', \'archived\', $2, $3, $3, $3)', [users[0], users[1], old])
    await queryOnce('INSERT INTO dwm_webhook_deliveries (id, owner_id, org_id, alert_id, event_type, status, dry_run, payload, idempotency_key, created_at, updated_at) VALUES (\'delivery_delete\', $1, \'retention_org_a\', \'alert_delete\', \'dwm.alert.created\', \'failed\', false, \'{"secret":"delete"}\', \'delivery-delete\', $4, $4), (\'delivery_hold\', $1, \'retention_org_a\', \'alert_hold\', \'dwm.alert.created\', \'failed\', false, \'{"secret":"hold"}\', \'delivery-hold\', $4, $4), (\'delivery_other\', $2, \'retention_org_b\', \'alert_other\', \'dwm.alert.created\', \'failed\', false, \'{"secret":"other"}\', \'delivery-other\', $4, $4), (\'delivery_retry\', $3, \'retention_org_c\', \'alert_retry\', \'dwm.alert.created\', \'failed\', false, \'{"secret":"retry"}\', \'delivery-retry\', $4, $4)', [users[0], users[1], users[2], old])

    const tiModes = new Map<string, 'missing' | 'record-failure'>()
    const tiPages = new Map<string, number>()
    globalThis.fetch = async(input, init) => {
        const url = new URL(String(input))
        const organizationId = decodeURIComponent(url.pathname.split('/')[3])
        if ((init?.method || 'GET') === 'GET') {
            return Response.json({ schemaVersion: 'organization.privacy_export.ti.v1', organizationId, tenantId: organizationId, data: { marker: organizationId } })
        }
        if (tiModes.get(organizationId) === 'missing') {
            return Response.json({ error: { message: 'Organization mirror not found' } }, { status: 404 })
        }
        if (tiModes.get(organizationId) === 'record-failure') {
            return Response.json({
                schemaVersion: 'organization.privacy_purge.ti.v1', organizationId, selected: 1,
                completed: [], protected: [], failed: [{ sourceService: 'ti-scraper', recordType: 'capture', recordId: 'capture_retry', action: 'redact', status: 'failed', reason: 'object_store_unavailable', error: 'retry me' }],
                heldAlertIds: [], protectedWatchlistIds: [], hasMore: true, remainingEligible: 1,
            }, { status: 503 })
        }
        if (organizationId === 'retention_org_page_a') {
            const page = (tiPages.get(organizationId) || 0) + 1
            tiPages.set(organizationId, page)
            const completed = Array.from({ length: 100 }, (_, index) => ({
                sourceService: 'ti-scraper', recordType: 'capture', recordId: `page-${page}-${index}`,
                action: 'redact', status: 'redacted', reason: 'organization_retention_expired',
            }))
            return Response.json({
                schemaVersion: 'organization.privacy_purge.ti.v1', organizationId, selected: 100, processed: 100,
                completed, protected: [], failed: [], heldAlertIds: [], protectedWatchlistIds: [],
                hasMore: page < 3, remainingEligible: page < 3 ? 100 : 0,
            })
        }
        return Response.json({
            schemaVersion: 'organization.privacy_purge.ti.v1', organizationId, selected: 0,
            completed: organizationId === 'retention_org_c' ? [{ sourceService: 'ti-scraper', recordType: 'capture', recordId: 'capture_retry', action: 'redact', status: 'redacted', reason: 'organization_retention_expired' }] : [],
            protected: [], failed: [],
            heldAlertIds: organizationId === 'retention_org_a' ? ['alert_hold'] : [],
            protectedWatchlistIds: organizationId === 'retention_org_a' ? ['org_watch_hold'] : [],
            hasMore: false, remainingEligible: 0,
        })
    }
    return { users, old, currentPassword, tiModes, tiPages }
}
