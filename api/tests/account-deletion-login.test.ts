import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let scheduledAt: string | null = null
const queries: string[] = []
const queryBindings: Array<{ sql: string, params: unknown[] }> = []
const deletedUsers: string[] = []
const loginReasons: string[] = []
const purgedUsers: string[] = []

mock.module('#db', () => ({
    default: async (sql: string, params?: unknown[]) => {
        const normalized = sql.replace(/\s+/g, ' ').trim()
        queries.push(normalized)
        queryBindings.push({ sql: normalized, params: [...(params || [])] })
        if (sql.includes('SELECT u.id, u.name, u.password')) {
            return { rows: [{ id: 'deletion-user', name: 'Deletion User', password: 'valid-password', account_type: 'user', active: true, deletion_scheduled_at: scheduledAt, password_reset_locked_at: null }] }
        }
        if (sql.includes('SELECT attempts FROM attempts')) return { rows: [] }
        if (sql.includes('DELETE FROM users')) {
            deletedUsers.push(String(params?.[0]))
            return { rows: [] }
        }
        if (sql.includes('INSERT INTO login_events')) {
            loginReasons.push(String(params?.[4]))
            return { rows: [] }
        }
        return { rows: [] }
    },
}))
mock.module('bcrypt', () => ({ default: { compare: async () => true } }))
mock.module('#utils/db/identityDataWrites.ts', () => ({ incrementIdentityLoginAttempt: async () => {} }))
mock.module('#utils/auth/login.ts', () => ({ default: async () => ({ token: 'session-token', expires_at: '2030-01-01T00:00:00.000Z' }) }))
mock.module('#utils/auth/accountDeletion.ts', () => ({ createAccountRestoreToken: () => ({ token: 'restore-token', hash: 'restore-hash' }) }))
mock.module('#utils/auth/session.ts', () => ({ revokeAllTokens: async () => 1 }))
mock.module('#utils/auth/purgeDeletedAccounts.ts', () => ({ purgeDeletedAccount: async (userId: string) => { purgedUsers.push(userId); return true } }))

const loginHandler = (await import('../src/handlers/auth/login.ts')).default
const app = Fastify()
app.post('/login/:id', loginHandler)

beforeEach(() => {
    scheduledAt = null
    queries.length = 0
    queryBindings.length = 0
    deletedUsers.length = 0
    loginReasons.length = 0
    purgedUsers.length = 0
})
afterAll(async () => app.close())

test('a valid login before the scheduled deletion date returns the restore flow without deleting the account', async () => {
    scheduledAt = new Date(Date.now() + 60_000).toISOString()

    const response = await app.inject({ method: 'POST', url: '/login/deletion-user', payload: { password: 'valid-password' } })

    expect(response.statusCode).toBe(423)
    expect(response.json()).toMatchObject({ error: 'Account pending deletion.', pending_deletion: true, restore_token: 'restore-token' })
    expect(deletedUsers).toEqual([])
    expect(loginReasons).toContain('pending_deletion')
    expect(queries.some(sql => sql.includes('UPDATE users SET deletion_restore_token_hash'))).toBe(true)
    const restoreHashUpdate = queryBindings.find(({ sql }) => sql.includes('UPDATE users SET deletion_restore_token_hash'))
    expect(restoreHashUpdate?.params).toEqual(['deletion-user', 'restore-hash'])
    expect(restoreHashUpdate?.params).not.toContain(response.json().restore_token)
})

test('a valid login after the scheduled deletion date rejects access without invoking the account purge', async () => {
    scheduledAt = new Date(Date.now() - 60_000).toISOString()

    const response = await app.inject({ method: 'POST', url: '/login/deletion-user', payload: { password: 'valid-password' } })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Incorrect username or password.' })
    expect(purgedUsers).toEqual([])
    expect(deletedUsers).toEqual([])
    expect(loginReasons).toEqual([])
    expect(queries.some(sql => sql.includes('UPDATE users SET deletion_restore_token_hash'))).toBe(false)
})
