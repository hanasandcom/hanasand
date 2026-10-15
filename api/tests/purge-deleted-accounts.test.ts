import { beforeEach, expect, mock, test } from 'bun:test'

type Account = { id: string, name: string, email: string | null }
let account: Account | null = { id: 'deleted-user', name: 'Ada Example', email: 'ada@example.test' }
let dueIds = ['deleted-user']
let blockedOwnerAccounts = 0
let mailUsername: string | null = 'ada'
let organizationBlocker = false
let failMailDeletion = false
let auditRows: Array<{ id: number, object_type: string, object_id: string | null, subject_id: string | null, request_id: string, ip: string, user_agent: string, context: Record<string, unknown> }> = []
const sqlCalls: string[] = []
const tokenDeletes: string[] = []
const revokedUsers: string[] = []
const deletedPrincipals: string[] = []
const purgedSshUsers: string[] = []

async function query(sql: string, params: unknown[] = []) {
    const normalized = sql.replace(/\s+/g, ' ').trim()
    sqlCalls.push(normalized)
    if (normalized.startsWith('DELETE FROM users')) {
        if (account?.id === params[0]) {
            account = null
            dueIds = dueIds.filter(id => id !== params[0])
            return { rows: [{ id: params[0] }] }
        }
    }
    if (normalized.includes('COUNT(DISTINCT user_account.id)')) return { rows: [{ count: blockedOwnerAccounts }] }
    if (normalized.includes('FROM users user_account')) return { rows: dueIds.map(id => ({ id })) }
    if (normalized.includes('FROM users') && normalized.includes('deletion_scheduled_at <= NOW()')) {
        return { rows: account?.id === params[0] ? [account] : [] }
    }
    if (normalized.includes('FROM mail_accounts')) return { rows: mailUsername ? [{ mail_username: mailUsername }] : [] }
    if (normalized.includes('FROM organizations organization') && normalized.includes('NOT EXISTS')) {
        return { rows: organizationBlocker ? [{ id: 'org-1', name: 'Only Owner Org', active_api_key: true }] : [] }
    }
    if (normalized.includes('FROM system_events')) return { rows: auditRows }
    if (normalized.startsWith('UPDATE system_events')) {
        const event = auditRows.find(row => row.id === params[0])
        if (event) {
            event.object_id = null
            event.subject_id = null
            event.request_id = ''
            event.ip = ''
            event.user_agent = ''
            event.context = JSON.parse(String(params[2]))
        }
        return { rows: [] }
    }
    return { rows: [] }
}

mock.module('#db', () => ({
    default: query,
    identityQueryOnce: async (sql: string, params: unknown[] = []) => {
        sqlCalls.push(sql.replace(/\s+/g, ' ').trim())
        if (sql.includes('DELETE FROM tokens')) tokenDeletes.push(String(params[0]))
        return { rows: [] }
    },
    withTransaction: async (work: (tx: typeof query) => unknown) => work(query),
    tryWithDatabaseAdvisoryLock: async (_key: string, work: () => unknown) => ({ acquired: true, result: await work() }),
}))
mock.module('../src/utils/auth/session.ts', () => ({ revokeAllTokens: async ({ userId }: { userId: string }) => { revokedUsers.push(userId); return 1 } }))
mock.module('../src/utils/mail/stalwartAdmin.ts', () => ({
    deleteMailPrincipal: async (name: string) => {
        if (failMailDeletion) throw new Error('mail provider unavailable')
        deletedPrincipals.push(name)
    },
}))
mock.module('../src/utils/auth/purgeUserSshKeys.ts', () => ({
    purgeUserSshKeys: async (userId: string) => { purgedSshUsers.push(userId); return 0 },
}))

const { purgeDeletedAccounts } = await import('../src/utils/auth/purgeDeletedAccounts.ts')

beforeEach(() => {
    account = { id: 'deleted-user', name: 'Ada Example', email: 'ada@example.test' }
    dueIds = ['deleted-user']
    blockedOwnerAccounts = 0
    mailUsername = 'ada'
    organizationBlocker = false
    failMailDeletion = false
    auditRows = [{
        id: 7,
        object_type: 'user',
        object_id: 'deleted-user',
        subject_id: 'deleted-user',
        request_id: 'request-123',
        ip: '198.51.100.7',
        user_agent: 'Example browser',
        context: { targetId: 'deleted-user', targetName: 'Ada Example', note: 'deleted-user', reason: 'account closed' },
    }]
    sqlCalls.length = 0
    tokenDeletes.length = 0
    revokedUsers.length = 0
    deletedPrincipals.length = 0
    purgedSshUsers.length = 0
})

test('purges due accounts once, cleans credentials and personal data, and preserves public article content', async () => {
    const result = await purgeDeletedAccounts()

    expect(result).toMatchObject({ scanned: 1, purged: 1, failed: 0, blockedOwnerAccounts: 0 })
    expect(account).toBeNull()
    expect(revokedUsers).toEqual(['deleted-user'])
    expect(tokenDeletes).toEqual(['deleted-user'])
    expect(deletedPrincipals).toEqual(['ada'])
    expect(purgedSshUsers).toEqual(['deleted-user'])
    expect(sqlCalls).toContain('DELETE FROM article_ownership WHERE owner_id = $1')
    expect(sqlCalls.some(sql => sql.includes('WITH RECURSIVE personal_tree'))).toBe(true)
    expect(sqlCalls).toContain('UPDATE share SET owner = \'\' WHERE organization_id IS NOT NULL AND owner = $1')
    expect(sqlCalls).toContain('DELETE FROM case_repositories WHERE owner_id = $1 AND organization_id IS NULL')
    expect(sqlCalls).toContain('UPDATE case_repositories SET owner_id = NULL WHERE owner_id = $1 AND organization_id IS NOT NULL')
    expect(sqlCalls).toContain('DELETE FROM api_keys WHERE owner_id = $1 AND organization_id IS NULL')
    expect(sqlCalls).toContain('DELETE FROM login_events WHERE user_id = $1')
    expect(sqlCalls).toContain('DELETE FROM attempts WHERE id = $1')
    expect(auditRows[0]).toMatchObject({
        object_id: null,
        subject_id: null,
        request_id: '',
        ip: '',
        user_agent: '',
        context: { note: '[deleted user]', reason: 'account closed' },
    })
    expect(auditRows[0].context).not.toHaveProperty('targetId')
    expect(auditRows[0].context).not.toHaveProperty('targetName')

    const repeated = await purgeDeletedAccounts()
    expect(repeated).toMatchObject({ scanned: 0, purged: 0, failed: 0 })
    expect(sqlCalls.filter(sql => sql.startsWith('DELETE FROM users'))).toHaveLength(1)
})

test('ignores accounts whose deletion deadline is still in the future', async () => {
    dueIds = []

    const result = await purgeDeletedAccounts()

    expect(result).toMatchObject({ scanned: 0, purged: 0, failed: 0 })
    expect(sqlCalls.some(sql => sql.includes('deletion_scheduled_at <= NOW()'))).toBe(true)
    expect(revokedUsers).toEqual([])
})

test('reports due accounts held by the organization-owner guard and leaves them pending', async () => {
    blockedOwnerAccounts = 1
    dueIds = []

    const result = await purgeDeletedAccounts()

    expect(result).toMatchObject({ scanned: 0, purged: 0, failed: 0, blockedOwnerAccounts: 1 })
    expect(account).not.toBeNull()
    expect(revokedUsers).toEqual([])
})

test('retries failed external mailbox cleanup without hard-deleting the account', async () => {
    failMailDeletion = true

    await expect(purgeDeletedAccounts()).rejects.toThrow('1 due account deletion cleanup(s) failed')
    expect(account).not.toBeNull()
    expect(sqlCalls.some(sql => sql.startsWith('DELETE FROM users'))).toBe(false)
    expect(sqlCalls.some(sql => sql.startsWith('INSERT INTO account_deletion_purge_attempts'))).toBe(true)
    const dueQuery = sqlCalls.find(sql => sql.includes('FROM users user_account') && sql.includes('ORDER BY'))
    expect(dueQuery).toContain('ORDER BY (purge_attempt.user_id IS NOT NULL)')
})
