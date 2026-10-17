import { beforeEach, expect, test } from 'bun:test'
import { callRestore, purgeDeletedAccount, purgeDeletedAccounts, resetState, state } from './purge-deleted-accounts-fixture.ts'

beforeEach(resetState)

test('purges due accounts once, cleans credentials and personal data, and preserves public article content', async () => {
    const result = await purgeDeletedAccounts()

    expect(result).toMatchObject({ scanned: 1, purged: 1, failed: 0, blockedOwnerAccounts: 0 })
    expect(state.account).toBeNull()
    expect(state.accountDue).toBe(false)
    const userLockIndex = state.sqlCalls.findIndex(sql => sql.startsWith('SELECT id, name, email FROM users') && sql.includes('FOR UPDATE'))
    const ownedOrganizationLockIndex = state.sqlCalls.findIndex(sql => sql.startsWith('SELECT organization.id FROM organizations organization') && sql.includes('FOR UPDATE OF organization'))
    const transactionalBlockerIndex = state.sqlCalls.findIndex((sql, index) => index > ownedOrganizationLockIndex
        && sql.includes('FROM organizations organization') && sql.includes('NOT EXISTS'))
    expect(userLockIndex).toBeGreaterThanOrEqual(0)
    expect(ownedOrganizationLockIndex).toBeGreaterThan(userLockIndex)
    expect(transactionalBlockerIndex).toBeGreaterThan(ownedOrganizationLockIndex)
    expect(state.revokedUsers).toEqual(['deleted-user'])
    expect(state.tokenDeletes).toEqual(['deleted-user'])
    expect(state.deletedPrincipals).toEqual(['ada'])
    expect(state.purgedSshUsers).toEqual(['deleted-user'])
    expect(state.sqlCalls).toContain('DELETE FROM article_ownership WHERE owner_id = $1')
    expect(state.sqlCalls.some(sql => sql.includes('WITH RECURSIVE personal_tree'))).toBe(true)
    expect(state.sqlCalls).toContain('UPDATE share SET owner = \'\' WHERE organization_id IS NOT NULL AND owner = $1')
    expect(state.sqlCalls).toContain('DELETE FROM case_repositories WHERE owner_id = $1 AND organization_id IS NULL')
    expect(state.sqlCalls).toContain('UPDATE case_repositories SET owner_id = NULL WHERE owner_id = $1 AND organization_id IS NOT NULL')
    expect(state.sqlCalls).toContain('DELETE FROM api_keys WHERE owner_id = $1 AND organization_id IS NULL')
    expect(state.sqlCalls).toContain('DELETE FROM login_events WHERE user_id = $1')
    expect(state.sqlCalls).toContain('DELETE FROM attempts WHERE id = $1')
    expect(state.auditRows[0]).toMatchObject({
        object_id: null,
        subject_id: null,
        request_id: '',
        ip: '',
        user_agent: '',
        context: { note: '[deleted user]', reason: 'account closed' },
    })
    expect(state.auditRows[0].context).not.toHaveProperty('targetId')
    expect(state.auditRows[0].context).not.toHaveProperty('targetName')
    expect(state.auditRows[1].subject_id).toBeNull()
    expect(state.auditRows[1].context).toEqual({ reason: 'legacy subject only' })
    expect(state.auditRows[2]).toMatchObject({
        request_id: '', ip: '', user_agent: '',
        context: { reason: 'name only' },
    })
    expect(state.auditRows[3]).toMatchObject({
        request_id: '', ip: '', user_agent: '',
        context: { reason: 'email only' },
    })
    expect(state.auditRows[4]).toMatchObject({
        request_id: 'free-text-name-request', ip: '198.51.100.11', user_agent: 'Unrelated browser',
        context: { reason: 'Ada Example' },
    })
    expect(state.sqlCalls.some(sql => sql.includes('OR subject_id = $1'))).toBe(true)

    const repeated = await purgeDeletedAccounts()
    expect(repeated).toMatchObject({ scanned: 0, purged: 0, failed: 0 })
    expect(state.sqlCalls.filter(sql => sql.startsWith('DELETE FROM users'))).toHaveLength(1)
})

test('ignores accounts whose deletion deadline is still in the future', async () => {
    state.dueIds = []

    const result = await purgeDeletedAccounts()

    expect(result).toMatchObject({ scanned: 0, purged: 0, failed: 0 })
    expect(state.sqlCalls.some(sql => sql.includes('deletion_scheduled_at <= NOW()'))).toBe(true)
    expect(state.revokedUsers).toEqual([])
})

test('reports due accounts held by the organization-owner guard and leaves them pending', async () => {
    state.blockedOwnerAccounts = 1
    state.dueIds = []

    const result = await purgeDeletedAccounts()

    expect(result).toMatchObject({ scanned: 0, purged: 0, failed: 0, blockedOwnerAccounts: 1 })
    expect(state.account).not.toBeNull()
    expect(state.revokedUsers).toEqual([])
})

test('retries failed external mailbox cleanup without hard-deleting the account', async () => {
    state.failMailDeletion = true

    await expect(purgeDeletedAccounts()).rejects.toThrow('1 due account deletion cleanup(s) failed')
    expect(state.account).not.toBeNull()
    expect(state.sqlCalls.some(sql => sql.startsWith('DELETE FROM users'))).toBe(false)
    expect(state.sqlCalls.some(sql => sql.startsWith('INSERT INTO account_deletion_purge_attempts'))).toBe(true)
    const dueQuery = state.sqlCalls.find(sql => sql.includes('FROM users user_account') && sql.includes('ORDER BY'))
    expect(dueQuery).toContain('PARTITION BY purge_attempt.user_id IS NOT NULL')
    expect(dueQuery).toContain('purge_attempt.attempt_order ASC NULLS FIRST')
    expect(dueQuery).toContain('cohort_position <= $2')
    expect(dueQuery).toContain('cohort_position <= $3')
})

test('retries instead of deleting when the identity service does not confirm session revocation', async () => {
    state.failSessionRevocation = true

    await expect(purgeDeletedAccounts()).rejects.toThrow('1 due account deletion cleanup(s) failed')
    expect(state.account).not.toBeNull()
    expect(state.sqlCalls.some(sql => sql.startsWith('DELETE FROM tokens'))).toBe(false)
    expect(state.purgedSshUsers).toEqual([])
    expect(state.deletedPrincipals).toEqual([])
    expect(state.sqlCalls.some(sql => sql.startsWith('DELETE FROM users'))).toBe(false)
    expect(state.sqlCalls.some(sql => sql.startsWith('INSERT INTO account_deletion_purge_attempts'))).toBe(true)
})

test('purges when the identity service confirms that there are no sessions to revoke', async () => {
    state.revokedSessionCount = 0

    const result = await purgeDeletedAccounts()

    expect(result).toMatchObject({ scanned: 1, purged: 1, failed: 0 })
    expect(state.account).toBeNull()
    expect(state.revokedUsers).toEqual(['deleted-user'])
})

test('serializes a direct per-account purge with the scheduled batch for the same account', async () => {
    state.waitForMailDeletion = true
    const loginPurge = purgeDeletedAccount('deleted-user')
    await state.mailDeletionStarted

    try {
        const scheduledPurge = await purgeDeletedAccounts()
        expect(scheduledPurge).toMatchObject({ scanned: 1, purged: 0, failed: 0 })
    } finally {
        state.releaseMailDeletion()
    }

    expect(await loginPurge).toBe(true)
    expect(state.revokedUsers).toEqual(['deleted-user'])
    expect(state.tokenDeletes).toEqual(['deleted-user'])
    expect(state.purgedSshUsers).toEqual(['deleted-user'])
    expect(state.deletedPrincipals).toEqual(['ada'])
    expect(state.sqlCalls.filter(sql => sql.startsWith('DELETE FROM users'))).toHaveLength(1)
})

test('a restore holding the per-account lock prevents concurrent purge credential cleanup', async () => {
    state.waitForRestore = true
    const restorePromise = callRestore('valid-restore-token')
    await state.restoreStarted

    try {
        const scheduledPurge = await purgeDeletedAccounts()
        expect(scheduledPurge).toMatchObject({ scanned: 1, purged: 0, failed: 0 })
        expect(state.revokedUsers).toEqual([])
        expect(state.tokenDeletes).toEqual([])
        expect(state.deletedPrincipals).toEqual([])
        expect(state.purgedSshUsers).toEqual([])
    } finally {
        state.releaseRestore()
    }

    const restored = await restorePromise
    expect(restored.statusCode, restored.body).toBe(200)
    expect(restored.body).toMatchObject({ message: 'Account restored.', token: 'restored-session' })
    expect(state.account).not.toBeNull()
    expect(state.accountDue).toBe(false)
    expect(state.deletedPrincipals).toEqual([])
})

test('restore continues to reject an account whose deadline has expired', async () => {
    state.canRestore = false

    const response = await callRestore('expired-restore-token')

    expect(response.statusCode).toBe(400)
    expect(response.body).toEqual({ error: 'This account can no longer be restored from this link.' })
    expect(state.account).not.toBeNull()
    expect(state.accountDue).toBe(true)
    expect(state.revokedUsers).toEqual([])
})
