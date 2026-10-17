import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { normalizeInviteActionInput, normalizeInviteInput, normalizeMemberRoleInput, normalizeOrganizationInput, normalizeOrganizationSettingsInput, normalizeOwnershipTransferInput, normalizeWatchlistActionInput, normalizeWatchlistCleanupInput, normalizeWatchlistInput } from '../src/utils/organizations.ts'

test('organization input normalization and validation', () => {
    assert.deepEqual(normalizeOrganizationInput({ name: ' Acme Security AS ' }), {
        name: 'Acme Security AS',
        slug: 'acme-security-as',
    })

    const tenInvites = normalizeInviteInput({
        emails: Array.from({ length: 10 }, (_, index) => `User${index + 1}@Example.COM`),
        role: 'member',
    })
    assert.equal(tenInvites.emails.length, 10)
    assert.equal(tenInvites.emails[0], 'user1@example.com')
    assert.equal(tenInvites.role, 'reader')
    assert.ok(Date.parse(tenInvites.expiresAt) > Date.now())

    const viewerInvite = normalizeInviteInput({ email: 'viewer@example.com', role: 'viewer' })
    assert.equal(viewerInvite.role, 'reader')

    assert.throws(() => normalizeInviteInput({ email: 'not-an-email' }), /Invalid invite email/)
    assert.throws(() => normalizeInviteInput({ emails: Array.from({ length: 26 }, (_, index) => `user${index}@example.com`) }), /25 users/)
    assert.throws(() => normalizeInviteInput({ email: 'owner@example.com', role: 'owner' }), /admin, editor, or reader/)
    assert.throws(() => normalizeInviteInput({ email: 'user@example.com', expiresAt: 'yesterdayish' }), /valid date/)
    assert.throws(() => normalizeInviteInput({ email: 'user@example.com', expiresAt: '2020-01-01T00:00:00.000Z' }), /future/)

    assert.deepEqual(normalizeOrganizationSettingsInput({
        name: ' Smoke Org Settings ',
        slug: 'Smoke Org Settings!',
        defaultWebhookPolicy: 'manual_selection',
        alertVisibilityPolicy: 'admins',
        lifecycleStatus: 'archived',
        retentionDays: 180,
        auditSafeMetadata: { region: 'EU', customerTier: 'managed' },
    }), {
        name: 'Smoke Org Settings',
        slug: 'smoke-org-settings',
        defaultWebhookPolicy: 'manual_selection',
        alertVisibilityPolicy: 'admins',
        lifecycleStatus: 'archived',
        retentionDays: 180,
        auditSafeMetadata: { region: 'EU', customerTier: 'managed' },
    })
    assert.throws(() => normalizeOrganizationSettingsInput({ defaultWebhookPolicy: 'send_everywhere' }), /Default webhook policy/)
    assert.throws(() => normalizeOrganizationSettingsInput({ alertVisibilityPolicy: 'public' }), /Alert visibility policy/)
    assert.throws(() => normalizeOrganizationSettingsInput({ lifecycleStatus: 'disabled' }), /Organization lifecycle status/)
    assert.throws(() => normalizeOrganizationSettingsInput({ retentionDays: 10 }), /Retention days/)
    assert.throws(() => normalizeOrganizationSettingsInput({ auditSafeMetadata: { callback: 'https://hooks.example.test/secret' } }), /emails, URLs, or secrets/)

    assert.deepEqual(normalizeOwnershipTransferInput({
        targetUserId: 'user_next_owner',
        reason: 'Customer primary admin changed roles.',
    }), {
        targetUserId: 'user_next_owner',
        reason: 'Customer primary admin changed roles.',
    })
    assert.throws(() => normalizeOwnershipTransferInput({ targetUserId: 'user_next_owner' }), /reason is required/)
    assert.throws(() => normalizeOwnershipTransferInput({ reason: 'handoff' }), /Target user/)

    assert.deepEqual(normalizeWatchlistInput({ kind: 'domain', value: 'https://WWW.Example.COM/login', notes: ' Supplier portal ' }), {
        kind: 'domain',
        value: 'example.com',
        notes: 'Supplier portal',
        reason: undefined,
        requestId: undefined,
    })
    assert.deepEqual(normalizeWatchlistInput({ kind: 'company', value: ' Example Holdings ' }), {
        kind: 'company',
        value: 'Example Holdings',
        notes: '',
        reason: undefined,
        requestId: undefined,
    })
    assert.throws(() => normalizeWatchlistInput({ kind: 'user', value: 'local only' }), /company, domain, vendor, actor, or keyword/)
    assert.deepEqual(normalizeWatchlistCleanupInput({
        itemIds: ['watch_1', 'watch_1', 'watch_2'],
        reason: 'Cleanup live proof terms.',
        requestId: 'cleanup-request',
    }), {
        itemIds: ['watch_1', 'watch_2'],
        reason: 'Cleanup live proof terms.',
        requestId: 'cleanup-request',
    })
    assert.throws(() => normalizeWatchlistCleanupInput({ itemIds: [] }), /at least one watchlist item id/)
    assert.deepEqual(normalizeWatchlistActionInput({
        action: 'restore',
        reason: 'Restore archived watchlist after customer cleanup.',
        requestId: 'restore-watchlist',
    }), {
        action: 'restore',
        reason: 'Restore archived watchlist after customer cleanup.',
        requestId: 'restore-watchlist',
    })
    assert.throws(() => normalizeWatchlistActionInput({ action: 'delete', reason: 'nope' }), /pause, resume, archive, or restore/)
})
test('required organization reasons share normalization and preserve operation-specific limits', () => {
    assert.equal(normalizeInviteActionInput({
        action: 'revoke',
        reason: '  reviewed   this change ',
    }).reason, 'reviewed this change')
    assert.equal(normalizeOwnershipTransferInput({
        targetUserId: 'user_next_owner',
        reason: '  reviewed   this change ',
    }).reason, 'reviewed this change')
    assert.equal(normalizeMemberRoleInput({
        role: 'reader',
        reason: '  reviewed   this change ',
    }).reason, 'reviewed this change')

    assert.equal(normalizeInviteActionInput({ action: 'revoke', reason: 'abc' }).reason, 'abc')
    assert.equal(normalizeOwnershipTransferInput({ targetUserId: 'user_next_owner', reason: 'abc' }).reason, 'abc')
    assert.equal(normalizeMemberRoleInput({ role: 'reader', reason: 'abc' }).reason, 'abc')
    assert.equal(normalizeInviteActionInput({ action: 'revoke', reason: 'x'.repeat(1000) }).reason.length, 1000)
    assert.equal(normalizeOwnershipTransferInput({ targetUserId: 'user_next_owner', reason: 'x'.repeat(1000) }).reason.length, 1000)
    assert.equal(normalizeMemberRoleInput({ role: 'reader', reason: 'x'.repeat(1000) }).reason.length, 1000)

    assert.throws(() => normalizeInviteActionInput({ action: 'revoke', reason: 'ok' }), /Invite action reason is required/)
    assert.throws(() => normalizeOwnershipTransferInput({ targetUserId: 'user_next_owner', reason: 'ok' }), /Ownership transfer reason is required/)
    assert.throws(() => normalizeMemberRoleInput({ role: 'reader', reason: 'ok' }), /Member role change reason is required/)

    assert.throws(() => normalizeInviteActionInput({ action: 'revoke', reason: 'x'.repeat(1001) }), /Invite action reason must be 1000 characters or fewer/)
    assert.throws(() => normalizeOwnershipTransferInput({ targetUserId: 'user_next_owner', reason: 'x'.repeat(1001) }), /Ownership transfer reason must be 1000 characters or fewer/)
    assert.throws(() => normalizeMemberRoleInput({ role: 'reader', reason: 'x'.repeat(1001) }), /Member role change reason must be 1000 characters or fewer/)
})
test('watchlist mutations normalize shared reason and request ID aliases consistently', () => {
    const reason = '  Reviewed   after customer request. '
    const request_id = ' watchlist-request '

    assert.deepEqual(normalizeWatchlistInput({ kind: 'company', value: 'Example', reason, request_id }), {
        kind: 'company',
        value: 'Example',
        notes: '',
        reason: 'Reviewed after customer request.',
        requestId: 'watchlist-request',
    })
    assert.deepEqual(normalizeWatchlistActionInput({ action: 'pause', reason, request_id }), {
        action: 'pause', reason: 'Reviewed after customer request.', requestId: 'watchlist-request',
    })
    assert.deepEqual(normalizeWatchlistCleanupInput({ itemIds: ['watch_1'], reason, request_id }), {
        itemIds: ['watch_1'], reason: 'Reviewed after customer request.', requestId: 'watchlist-request',
    })
})
