import crypto from 'node:crypto'
import run from '#db'
import { addressForUser } from '#utils/mail/helpers.ts'

export const RESET_TTL_MINUTES = 15

export type ResetRow = {
    id: string
    user_id: string
    code_hash: string
    reset_token_hash: string | null
    attempts: number
    expires_at: string
}

export type UserRow = {
    id: string
    name: string
    active: boolean
    recovery_email: string | null
    mail_address: string | null
}

type SecurityActionBody = {
    token?: string
}

export async function getActiveUser(id: string) {
    const result = await run(`
        SELECT u.id, u.name, u.active, COALESCE(u.email,ma.recovery_email) AS recovery_email, ma.mail_address
        FROM users u
        LEFT JOIN mail_accounts ma ON ma.user_id = u.id
        WHERE u.active IS TRUE
          AND (
              u.id = $1
              OR lower(COALESCE(u.username,u.id)) = lower($1)
              OR lower(u.email) = lower($1)
              OR lower(ma.mail_address) = lower($1)
              OR lower(ma.recovery_email) = lower($1)
          )
        LIMIT 1
    `, [id])
    return (result.rows[0] as UserRow | undefined) || null
}

export function recoveryAddressForUser(user: UserRow) {
    return user.recovery_email || user.mail_address || addressForUser(user.id)
}

export async function getPendingReset(userId: string) {
    const result = await run(`
        SELECT id, user_id, code_hash, reset_token_hash, attempts, expires_at
        FROM password_reset_codes
        WHERE user_id = $1
          AND consumed_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
    `, [userId])

    return (result.rows[0] as ResetRow | undefined) || null
}

export async function consumeReset(id: string) {
    await run('UPDATE password_reset_codes SET consumed_at = NOW() WHERE id = $1', [id])
}

export function normalizeUserId(value?: string) {
    return String(value || '').trim()
}

export function hashResetToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

export function readSecurityActionToken(body: unknown) {
    const token = (body as SecurityActionBody | null)?.token
    return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : ''
}

export function createOpaqueToken() {
    return crypto.randomBytes(32).toString('base64url')
}

export async function createSecurityActionTokens(userId: string, resetCodeId: string) {
    const lockToken = createOpaqueToken()
    const resetToken = createOpaqueToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await run(`
        UPDATE password_reset_security_actions
        SET consumed_at = NOW()
        WHERE user_id = $1 AND consumed_at IS NULL
    `, [userId])
    await run(`
        INSERT INTO password_reset_security_actions (user_id, reset_code_id, action, token_hash, expires_at)
        VALUES ($1, $2, 'lock_account', $3, $5), ($1, $2, 'reset_password', $4, $5)
    `, [userId, resetCodeId, hashResetToken(lockToken), hashResetToken(resetToken), expiresAt])

    return { lockToken, resetToken }
}
