import { mock } from 'bun:test'
import { containsIdentityField, state } from './purge-deleted-accounts-state.ts'

async function query(sql: string, params: unknown[] = []) {
    const normalized = sql.replace(/\s+/g, ' ').trim()
    state.sqlCalls.push(normalized)
    if (normalized.startsWith('DELETE FROM users') && state.account?.id === params[0]) {
        state.account = null
        state.accountDue = false
        state.dueIds = state.dueIds.filter(id => id !== params[0])
        return { rows: [{ id: params[0] }] }
    }
    if (normalized.includes('COUNT(DISTINCT user_account.id)')) return { rows: [{ count: state.blockedOwnerAccounts }] }
    if (normalized.includes('FROM users user_account')) return { rows: state.dueIds.map(id => ({ id })) }
    if (normalized.includes('FROM users') && normalized.includes('deletion_scheduled_at <= NOW()')) {
        return { rows: state.accountDue && state.account?.id === params[0] ? [state.account] : [] }
    }
    if (normalized.includes('FROM mail_accounts')) return { rows: state.mailUsername ? [{ mail_username: state.mailUsername }] : [] }
    if (normalized.includes('FROM organizations organization') && normalized.includes('NOT EXISTS')) {
        return { rows: state.organizationBlocker ? [{ id: 'org-1', name: 'Only Owner Org', active_api_key: true }] : [] }
    }
    if (normalized.includes('FROM system_events')) return { rows: matchingAuditRows(normalized, params) }
    if (normalized.startsWith('UPDATE users') && normalized.includes('deletion_scheduled_at = NULL')) return restoreAccount()
    if (normalized.startsWith('UPDATE system_events')) scrubAuditRow(params)
    return { rows: [] }
}

function matchingAuditRows(sql: string, params: unknown[]) {
    return state.auditRows.filter(row => row.actor_id === params[0]
        || row.object_id === params[0]
        || (sql.includes('subject_id = $1') && row.subject_id === params[0])
        || JSON.stringify(row.context).includes(String(params[0]))
        || containsIdentityField(row.context, params.slice(1).filter((identity): identity is string => typeof identity === 'string')))
}

async function restoreAccount() {
    state.markRestoreStarted()
    if (state.waitForRestore) await state.restoreGate
    if (!state.canRestore) return { rows: [] }
    state.accountDue = false
    state.dueIds = []
    return { rows: [{ id: 'deleted-user', name: 'Ada Example', avatar: null, active: true }] }
}

function scrubAuditRow(params: unknown[]) {
    const event = state.auditRows.find(row => row.id === params[0])
    if (!event) return
    if (event.object_id === params[1]) event.object_id = null
    if (event.subject_id === params[1]) event.subject_id = null
    event.request_id = ''
    event.ip = ''
    event.user_agent = ''
    event.context = JSON.parse(String(params[2]))
}

mock.module('#db', () => ({
    default: query,
    identityQueryOnce: async (sql: string, params: unknown[] = []) => {
        state.sqlCalls.push(sql.replace(/\s+/g, ' ').trim())
        if (sql.includes('DELETE FROM tokens')) state.tokenDeletes.push(String(params[0]))
        return { rows: [] }
    },
    withTransaction: async (work: (tx: typeof query) => unknown) => work(query),
    withDatabaseAdvisoryLock: async (key: string, work: () => unknown) => runLocked(key, work),
    tryWithDatabaseAdvisoryLock: async (key: string, work: () => unknown) => tryRunLocked(key, work),
}))
mock.module('../src/utils/auth/session.ts', () => ({ revokeAllTokens: async ({ userId }: { userId: string }) => { state.revokedUsers.push(userId); return 1 } }))
mock.module('../src/utils/mail/stalwartAdmin.ts', () => ({ deleteMailPrincipal: deleteMailPrincipal }))
mock.module('../src/utils/auth/purgeUserSshKeys.ts', () => ({ purgeUserSshKeys: async (userId: string) => { state.purgedSshUsers.push(userId); return 0 } }))
mock.module('../src/utils/auth/login.ts', () => ({ default: async () => ({ token: 'restored-session', expires_at: '2030-01-01T00:00:00.000Z' }) }))
mock.module('../src/utils/auth/passwordReset.ts', () => ({ consumePendingPasswordResetCodes: async () => {} }))

async function deleteMailPrincipal(name: string) {
    if (state.failMailDeletion) throw new Error('mail provider unavailable')
    if (state.waitForMailDeletion) {
        state.markMailDeletionStarted()
        await state.mailDeletionGate
    }
    state.deletedPrincipals.push(name)
}

async function runLocked(key: string, work: () => unknown) {
    if (state.activeAdvisoryLocks.has(key)) throw new Error(`Advisory lock already held: ${key}`)
    state.activeAdvisoryLocks.add(key)
    try { return await work() } finally { state.activeAdvisoryLocks.delete(key) }
}

async function tryRunLocked(key: string, work: () => unknown) {
    if (state.activeAdvisoryLocks.has(key)) return { acquired: false }
    state.activeAdvisoryLocks.add(key)
    try { return { acquired: true, result: await work() } } finally { state.activeAdvisoryLocks.delete(key) }
}
