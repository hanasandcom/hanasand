import { beforeEach, expect, mock, test } from 'bun:test'

const queries: Array<{ sql: string, params?: unknown[] }> = []
const mailSyncs: Array<{ userId: string, displayName: string, password: string }> = []
const loginRequests: Array<{ id: string, ip: string, userAgent: string }> = []
let userExists = true
let loginResult: { token: string, expires_at: string } | null = null

mock.module('#db', () => ({
    default: async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params })
        if (sql.includes('UPDATE users')) return { rowCount: userExists ? 1 : 0, rows: userExists ? [{ id: 'member' }] : [] }
        if (sql.includes('SELECT name FROM users')) return { rowCount: 1, rows: [{ name: 'Member Name' }] }
        throw new Error(`Unexpected query: ${sql}`)
    },
}))
mock.module('bcrypt', () => ({ default: { hash: async (password: string, rounds: number) => `hash:${rounds}:${password}` } }))
mock.module('#utils/auth/login.ts', () => ({
    default: async (input: { id: string, ip: string, userAgent: string }) => {
        loginRequests.push(input)
        return loginResult
    },
}))
mock.module('#utils/mail/accounts.ts', () => ({
    syncMailPasswordForUser: async (userId: string, displayName: string, password: string) => {
        mailSyncs.push({ userId, displayName, password })
    },
}))

const { default: updateUserPassword } = await import('../src/handlers/user/updateUserPassword.ts')

beforeEach(() => {
    queries.length = 0
    mailSyncs.length = 0
    loginRequests.length = 0
    userExists = true
    loginResult = { token: 'session-token', expires_at: '2030-01-01T00:00:00.000Z' }
})

test('updates the password, syncs mail, and returns the new session', async () => {
    const result = await updateUserPassword({ userId: 'member', password: 'New-password-123!', ip: '198.51.100.4', userAgent: 'Test browser' })

    expect(result).toEqual({ userFound: true, session: loginResult })
    expect(queries).toEqual([
        { sql: expect.stringContaining('UPDATE users'), params: ['member', 'hash:10:New-password-123!'] },
        { sql: 'SELECT name FROM users WHERE id = $1', params: ['member'] },
    ])
    expect(queries[0].sql).toContain('SET password = $2')
    expect(queries[0].sql).toContain('WHERE id = $1')
    expect(mailSyncs).toEqual([{ userId: 'member', displayName: 'Member Name', password: 'New-password-123!' }])
    expect(loginRequests).toEqual([{ id: 'member', ip: '198.51.100.4', userAgent: 'Test browser' }])
})

test('does not sync mail or create a session when the user is missing', async () => {
    userExists = false

    expect(await updateUserPassword({ userId: 'missing', password: 'New-password-123!', ip: '198.51.100.4', userAgent: '' })).toEqual({ userFound: false })
    expect(queries).toHaveLength(1)
    expect(mailSyncs).toHaveLength(0)
    expect(loginRequests).toHaveLength(0)
})

test('reports a missing login session after completing the password update', async () => {
    loginResult = null

    const result = await updateUserPassword({ userId: 'member', password: 'New-password-123!', ip: '198.51.100.4', userAgent: '' })

    expect(result).toEqual({ userFound: true, session: null })
    expect(mailSyncs).toHaveLength(1)
    expect(loginRequests).toHaveLength(1)
})
