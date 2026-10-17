import { afterAll, expect, mock, test } from 'bun:test'
import crypto from 'node:crypto'
import Fastify from 'fastify'

const queries: Array<{ sql: string, params: unknown[] }> = []
const events: string[] = []
const sentMail: Array<{ to: string, textBody: string }> = []
let resetCodeHash = 'hash:123456'
let hashedCodePlaintext = ''

mock.module('#db', () => ({
    default: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params })
        if (sql.includes('SELECT u.id, u.name, u.active')) {
            return { rows: [{ id: 'reset-user', name: 'Reset User', active: true, recovery_email: 'recover@example.test', mail_address: null }] }
        }
        if (sql.includes('SELECT id, user_id, code_hash')) {
            return { rows: [{ id: 'reset-code', user_id: 'reset-user', code_hash: resetCodeHash, reset_token_hash: null, attempts: 0, expires_at: '2026-10-17T12:15:00.000Z' }] }
        }
        return { rows: [] }
    },
    withTransaction: async () => ({ rows: [] }),
}))
mock.module('bcrypt', () => ({
    default: {
        hash: async (value: string) => {
            hashedCodePlaintext = value
            return `hash:${value}`
        },
        compare: async (value: string, hash: string) => hash === `hash:${value}`,
    },
}))
mock.module('#utils/auth/session.ts', () => ({ revokeAllTokens: async () => {} }))
mock.module('#utils/auth/password.ts', () => ({ validatePassword: async () => ({ valid: true }) }))
mock.module('#utils/mail/helpers.ts', () => ({ addressForUser: (id: string) => `${id}@example.test` }))
mock.module('#utils/mail/system.ts', () => ({ sendSystemMail: async (message: typeof sentMail[number]) => { sentMail.push(message) } }))
mock.module('#utils/mail/accounts.ts', () => ({ syncMailPasswordForUser: async () => {} }))
mock.module('#utils/auth/passwordChangedMail.ts', () => ({ passwordChangedMail: () => ({}) }))
mock.module('#utils/auth/passwordReset.ts', () => ({
    consumePendingPasswordResetCodes: async () => { events.push('consume-pending') },
}))

const { requestPasswordReset, verifyPasswordResetCode } = await import('../src/handlers/auth/passwordReset.ts')
const app = Fastify()
app.post('/request', requestPasswordReset)
app.post('/verify', verifyPasswordResetCode)

test('request creates a hashed six-digit code and emails the recovery address', async () => {
    queries.length = 0
    events.length = 0
    sentMail.length = 0
    hashedCodePlaintext = ''
    const response = await app.inject({ method: 'POST', url: '/request', payload: { id: 'reset-user' } })

    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toEqual({ ok: true })
    expect(sentMail).toHaveLength(1)
    expect(sentMail[0].to).toBe('recover@example.test')
    const mailedCode = sentMail[0].textBody.match(/\b(\d{6})\b/)?.[1]
    expect(hashedCodePlaintext).toMatch(/^\d{6}$/)
    expect(mailedCode).toBe(hashedCodePlaintext)
    const insert = queries.find(query => query.sql.includes('INSERT INTO password_reset_codes'))
    expect(insert?.params[0]).toBe('reset-user')
    expect(String(insert?.params[1])).toMatch(/^hash:\d{6}$/)
    expect(events).toEqual(['consume-pending'])
})

test('verification rejects a wrong code and increments attempts', async () => {
    queries.length = 0
    resetCodeHash = 'hash:654321'
    const response = await app.inject({ method: 'POST', url: '/verify', payload: { id: 'reset-user', code: '123456' } })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'The reset code is invalid or expired.' })
    expect(queries.some(query => query.sql.includes('attempts = attempts + 1'))).toBe(true)
})

test('verification exchanges a valid code for a hashed reset token', async () => {
    queries.length = 0
    resetCodeHash = 'hash:123456'
    const response = await app.inject({ method: 'POST', url: '/verify', payload: { id: 'reset-user', code: ' 123456 ' } })
    const body = response.json()

    expect(response.statusCode, response.body).toBe(200)
    expect(body).toMatchObject({ ok: true, expiresAt: '2026-10-17T12:15:00.000Z' })
    expect(body.resetToken).toMatch(/^[a-f0-9]{64}$/)
    const update = queries.find(query => query.sql.includes('SET reset_token_hash = $2'))
    expect(update?.params[1]).toBe(crypto.createHash('sha256').update(body.resetToken).digest('hex'))
})

afterAll(async () => { await app.close() })
