import { beforeEach, expect, mock, test } from 'bun:test'

type Account = { id: string, name: string, email: string | null }
let account: Account | null = { id: 'deleted-user', name: 'Ada Example', email: 'ada@example.test' }
let accountDue = true
let dueIds = ['deleted-user']
let blockedOwnerAccounts = 0
let mailUsername: string | null = 'ada'
let organizationBlocker = false
let failMailDeletion = false
let waitForMailDeletion = false
let markMailDeletionStarted!: () => void
let releaseMailDeletion!: () => void
let mailDeletionStarted = Promise.resolve()
let mailDeletionGate = Promise.resolve()
let auditRows: Array<{ id: number, object_type: string, actor_id: string | null, object_id: string | null, subject_id: string | null, request_id: string, ip: string, user_agent: string, context: Record<string, unknown> }> = []
const sqlCalls: string[] = []
const activeAdvisoryLocks = new Set<string>()
const tokenDeletes: string[] = []
const revokedUsers: string[] = []
const deletedPrincipals: string[] = []
const purgedSshUsers: string[] = []
let waitForRestore = false
let canRestore = true
let markRestoreStarted!: () => void
let releaseRestore!: () => void
let restoreStarted = Promise.resolve()
let restoreGate = Promise.resolve()

function containsIdentityField(value: unknown, identities: string[]): boolean {
    if (Array.isArray(value)) return value.some(item => containsIdentityField(item, identities))
    if (!value || typeof value !== 'object') return false
    return Object.entries(value as Record<string, unknown>).some(([key, item]) =>
        (/^(target|actor|user|account)[_-]?(name|email)$/i.test(key) && typeof item === 'string' && identities.includes(item))
        || containsIdentityField(item, identities))
}

async function query(sql: string, params: unknown[] = []) {
    const normalized = sql.replace(/\s+/g, ' ').trim()
    sqlCalls.push(normalized)
    if (normalized.startsWith('DELETE FROM users')) {
        if (account?.id === params[0]) {
            account = null
            accountDue = false
            dueIds = dueIds.filter(id => id !== params[0])
            return { rows: [{ id: params[0] }] }
        }
    }
    if (normalized.includes('COUNT(DISTINCT user_account.id)')) return { rows: [{ count: blockedOwnerAccounts }] }
    if (normalized.includes('FROM users user_account')) return { rows: dueIds.map(id => ({ id })) }
    if (normalized.includes('FROM users') && normalized.includes('deletion_scheduled_at <= NOW()')) {
        return { rows: accountDue && account?.id === params[0] ? [account] : [] }
    }
    if (normalized.includes('FROM mail_accounts')) return { rows: mailUsername ? [{ mail_username: mailUsername }] : [] }
    if (normalized.includes('FROM organizations organization') && normalized.includes('NOT EXISTS')) {
        return { rows: organizationBlocker ? [{ id: 'org-1', name: 'Only Owner Org', active_api_key: true }] : [] }
    }
    if (normalized.includes('FROM system_events')) {
        return { rows: auditRows.filter(row => row.actor_id === params[0]
            || row.object_id === params[0]
            || (normalized.includes('subject_id = $1') && row.subject_id === params[0])
            || JSON.stringify(row.context).includes(String(params[0]))
            || containsIdentityField(row.context, params.slice(1).filter((identity): identity is string => typeof identity === 'string'))) }
    }
    if (normalized.startsWith('UPDATE users') && normalized.includes('deletion_scheduled_at = NULL')) {
        markRestoreStarted()
        if (waitForRestore) await restoreGate
        if (!canRestore) return { rows: [] }
        accountDue = false
        dueIds = []
        return { rows: [{ id: 'deleted-user', name: 'Ada Example', avatar: null, active: true }] }
    }
    if (normalized.startsWith('UPDATE system_events')) {
        const event = auditRows.find(row => row.id === params[0])
        if (event) {
            if (event.object_id === params[1]) event.object_id = null
            if (event.subject_id === params[1]) event.subject_id = null
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
    withDatabaseAdvisoryLock: async (key: string, work: () => unknown) => {
        if (activeAdvisoryLocks.has(key)) throw new Error(`Advisory lock already held: ${key}`)
        activeAdvisoryLocks.add(key)
        try {
            return await work()
        } finally {
            activeAdvisoryLocks.delete(key)
        }
    },
    tryWithDatabaseAdvisoryLock: async (key: string, work: () => unknown) => {
        if (activeAdvisoryLocks.has(key)) return { acquired: false }
        activeAdvisoryLocks.add(key)
        try {
            return { acquired: true, result: await work() }
        } finally {
            activeAdvisoryLocks.delete(key)
        }
    },
}))
mock.module('../src/utils/auth/session.ts', () => ({ revokeAllTokens: async ({ userId }: { userId: string }) => { revokedUsers.push(userId); return 1 } }))
mock.module('../src/utils/mail/stalwartAdmin.ts', () => ({
    deleteMailPrincipal: async (name: string) => {
        if (failMailDeletion) throw new Error('mail provider unavailable')
        if (waitForMailDeletion) {
            markMailDeletionStarted()
            await mailDeletionGate
        }
        deletedPrincipals.push(name)
    },
}))
mock.module('../src/utils/auth/purgeUserSshKeys.ts', () => ({
    purgeUserSshKeys: async (userId: string) => { purgedSshUsers.push(userId); return 0 },
}))
mock.module('../src/utils/auth/login.ts', () => ({ default: async () => ({ token: 'restored-session', expires_at: '2030-01-01T00:00:00.000Z' }) }))
mock.module('../src/utils/auth/passwordReset.ts', () => ({ consumePendingPasswordResetCodes: async () => {} }))

const { purgeDeletedAccount, purgeDeletedAccounts } = await import('../src/utils/auth/purgeDeletedAccounts.ts')
const { default: restoreSelf } = await import('../src/handlers/user/restoreSelf.ts')

async function callRestore(restoreToken: string) {
    const response: { statusCode: number, body?: unknown } = { statusCode: 200 }
    const reply = {
        status(statusCode: number) { response.statusCode = statusCode; return reply },
        send(body: unknown) { response.body = body; return reply },
    }
    await restoreSelf({ body: { id: 'deleted-user', restoreToken }, ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any, reply as any)
    return response
}

beforeEach(() => {
    account = { id: 'deleted-user', name: 'Ada Example', email: 'ada@example.test' }
    accountDue = true
    dueIds = ['deleted-user']
    blockedOwnerAccounts = 0
    mailUsername = 'ada'
    organizationBlocker = false
    failMailDeletion = false
    waitForMailDeletion = false
    mailDeletionStarted = new Promise(resolve => { markMailDeletionStarted = resolve })
    mailDeletionGate = new Promise(resolve => { releaseMailDeletion = resolve })
    auditRows = [{
        id: 7,
        object_type: 'user',
        actor_id: 'deleted-user',
        object_id: 'deleted-user',
        subject_id: 'deleted-user',
        request_id: 'request-123',
        ip: '198.51.100.7',
        user_agent: 'Example browser',
        context: { targetId: 'deleted-user', targetName: 'Ada Example', note: 'deleted-user', reason: 'account closed' },
    }, {
        id: 8,
        object_type: 'legacy_user_reference',
        actor_id: 'admin-user',
        object_id: 'organization-1',
        subject_id: 'deleted-user',
        request_id: 'unrelated-request',
        ip: '198.51.100.8',
        user_agent: 'Admin browser',
        context: { reason: 'legacy subject only' },
    }, {
        id: 9,
        object_type: 'account_notice',
        actor_id: null,
        object_id: null,
        subject_id: null,
        request_id: 'name-email-only-request',
        ip: '198.51.100.9',
        user_agent: 'Legacy browser',
        context: { targetName: 'Ada Example', reason: 'name only' },
    }, {
        id: 10,
        object_type: 'account_notice',
        actor_id: null,
        object_id: null,
        subject_id: null,
        request_id: 'email-only-request',
        ip: '198.51.100.10',
        user_agent: 'Legacy browser',
        context: { userEmail: 'ada@example.test', reason: 'email only' },
    }, {
        id: 11,
        object_type: 'account_notice',
        actor_id: null,
        object_id: null,
        subject_id: null,
        request_id: 'free-text-name-request',
        ip: '198.51.100.11',
        user_agent: 'Unrelated browser',
        context: { reason: 'Ada Example' },
    }]
    sqlCalls.length = 0
    activeAdvisoryLocks.clear()
    tokenDeletes.length = 0
    revokedUsers.length = 0
    deletedPrincipals.length = 0
    purgedSshUsers.length = 0
    waitForRestore = false
    canRestore = true
    restoreStarted = new Promise(resolve => { markRestoreStarted = resolve })
    restoreGate = new Promise(resolve => { releaseRestore = resolve })
})

test('purges due accounts once, cleans credentials and personal data, and preserves public article content', async () => {
    const result = await purgeDeletedAccounts()

    expect(result).toMatchObject({ scanned: 1, purged: 1, failed: 0, blockedOwnerAccounts: 0 })
    expect(account).toBeNull()
    expect(accountDue).toBe(false)
    const userLockIndex = sqlCalls.findIndex(sql => sql.startsWith('SELECT id, name, email FROM users') && sql.includes('FOR UPDATE'))
    const ownedOrganizationLockIndex = sqlCalls.findIndex(sql => sql.startsWith('SELECT organization.id FROM organizations organization') && sql.includes('FOR UPDATE OF organization'))
    const transactionalBlockerIndex = sqlCalls.findIndex((sql, index) => index > ownedOrganizationLockIndex
        && sql.includes('FROM organizations organization') && sql.includes('NOT EXISTS'))
    expect(userLockIndex).toBeGreaterThanOrEqual(0)
    expect(ownedOrganizationLockIndex).toBeGreaterThan(userLockIndex)
    expect(transactionalBlockerIndex).toBeGreaterThan(ownedOrganizationLockIndex)
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
    expect(auditRows[1].subject_id).toBeNull()
    expect(auditRows[1].context).toEqual({ reason: 'legacy subject only' })
    expect(auditRows[2]).toMatchObject({
        request_id: '', ip: '', user_agent: '',
        context: { reason: 'name only' },
    })
    expect(auditRows[3]).toMatchObject({
        request_id: '', ip: '', user_agent: '',
        context: { reason: 'email only' },
    })
    expect(auditRows[4]).toMatchObject({
        request_id: 'free-text-name-request', ip: '198.51.100.11', user_agent: 'Unrelated browser',
        context: { reason: 'Ada Example' },
    })
    expect(sqlCalls.some(sql => sql.includes('OR subject_id = $1'))).toBe(true)

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
    expect(dueQuery).toContain('PARTITION BY purge_attempt.user_id IS NOT NULL')
    expect(dueQuery).toContain('purge_attempt.attempt_order ASC NULLS FIRST')
    expect(dueQuery).toContain('cohort_position <= $2')
    expect(dueQuery).toContain('cohort_position <= $3')
})

test('serializes a direct per-account purge with the scheduled batch for the same account', async () => {
    waitForMailDeletion = true
    const loginPurge = purgeDeletedAccount('deleted-user')
    await mailDeletionStarted

    try {
        const scheduledPurge = await purgeDeletedAccounts()
        expect(scheduledPurge).toMatchObject({ scanned: 1, purged: 0, failed: 0 })
    } finally {
        releaseMailDeletion()
    }

    expect(await loginPurge).toBe(true)
    expect(revokedUsers).toEqual(['deleted-user'])
    expect(tokenDeletes).toEqual(['deleted-user'])
    expect(purgedSshUsers).toEqual(['deleted-user'])
    expect(deletedPrincipals).toEqual(['ada'])
    expect(sqlCalls.filter(sql => sql.startsWith('DELETE FROM users'))).toHaveLength(1)
})

test('a restore holding the per-account lock prevents concurrent purge credential cleanup', async () => {
    waitForRestore = true
    const restorePromise = callRestore('valid-restore-token')
    await restoreStarted

    try {
        const scheduledPurge = await purgeDeletedAccounts()
        expect(scheduledPurge).toMatchObject({ scanned: 1, purged: 0, failed: 0 })
        expect(revokedUsers).toEqual([])
        expect(tokenDeletes).toEqual([])
        expect(deletedPrincipals).toEqual([])
        expect(purgedSshUsers).toEqual([])
    } finally {
        releaseRestore()
    }

    const restored = await restorePromise
    expect(restored.statusCode, restored.body).toBe(200)
    expect(restored.body).toMatchObject({ message: 'Account restored.', token: 'restored-session' })
    expect(account).not.toBeNull()
    expect(accountDue).toBe(false)
    expect(deletedPrincipals).toEqual([])
})

test('restore continues to reject an account whose deadline has expired', async () => {
    canRestore = false

    const response = await callRestore('expired-restore-token')

    expect(response.statusCode).toBe(400)
    expect(response.body).toEqual({ error: 'This account can no longer be restored from this link.' })
    expect(account).not.toBeNull()
    expect(accountDue).toBe(true)
    expect(revokedUsers).toEqual([])
})
