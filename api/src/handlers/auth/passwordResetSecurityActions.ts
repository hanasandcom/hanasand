import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import { revokeAllTokens } from '#utils/auth/session.ts'
import { consumePendingPasswordResetCodes } from '#utils/auth/passwordReset.ts'
import {
    createOpaqueToken,
    hashResetToken,
    readSecurityActionToken,
    RESET_TTL_MINUTES,
} from './passwordResetSupport.ts'

export async function lockAccountFromPasswordReset(req: FastifyRequest, res: FastifyReply) {
    const token = readSecurityActionToken(req.body)
    if (!token) return res.status(400).send({ error: 'This security link is invalid or expired.' })

    const locked = await withTransaction(async query => {
        const action = await query(`
            UPDATE password_reset_security_actions
            SET consumed_at = NOW()
            WHERE token_hash = $1
              AND action = 'lock_account'
              AND consumed_at IS NULL
              AND expires_at > NOW()
              AND EXISTS (SELECT 1 FROM users WHERE users.id = password_reset_security_actions.user_id AND users.active IS TRUE)
            RETURNING user_id
        `, [hashResetToken(token)])
        if (!action.rows.length) return false

        const userId = String(action.rows[0].user_id)
        const user = await query('SELECT id FROM users WHERE id = $1 AND active IS TRUE FOR UPDATE', [userId])
        if (!user.rows.length) return false

        const updated = await query('UPDATE users SET password_reset_locked_at = NOW() WHERE id = $1 AND active IS TRUE RETURNING id', [userId])
        if (!updated.rows.length) return false

        const revoked = await revokeAllTokens({ userId, revokedBy: 'password_reset_security_lock' })
        if (revoked === null) throw new Error('Identity did not confirm session revocation.')
        return true
    })
    if (!locked) return res.status(400).send({ error: 'This security link is invalid or expired.' })
    return res.send({ ok: true })
}

export async function startPasswordResetAgain(req: FastifyRequest, res: FastifyReply) {
    const token = readSecurityActionToken(req.body)
    if (!token) return res.status(400).send({ error: 'This reset link is invalid or expired.' })

    const resetToken = createOpaqueToken()
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000)
    const started = await withTransaction(async query => {
        const action = await query(`
            UPDATE password_reset_security_actions
            SET consumed_at = NOW()
            WHERE token_hash = $1
              AND action = 'reset_password'
              AND consumed_at IS NULL
              AND expires_at > NOW()
              AND EXISTS (SELECT 1 FROM users WHERE users.id = password_reset_security_actions.user_id AND users.active IS TRUE)
            RETURNING user_id
        `, [hashResetToken(token)])
        if (!action.rows.length) return null

        const userId = String(action.rows[0].user_id)
        const user = await query('SELECT id FROM users WHERE id = $1 AND active IS TRUE FOR UPDATE', [userId])
        if (!user.rows.length) return null

        const code = crypto.randomBytes(32).toString('hex')
        const codeHash = await bcrypt.hash(code, 10)
        await consumePendingPasswordResetCodes(userId, query)
        await query(`
            INSERT INTO password_reset_codes (user_id, code_hash, reset_token_hash, requested_ip, user_agent, verified_at, expires_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), $6)
        `, [userId, codeHash, hashResetToken(resetToken), req.ip, String(req.headers['user-agent'] || ''), expiresAt])
        return { userId }
    })
    if (!started) return res.status(400).send({ error: 'This reset link is invalid or expired.' })

    return res.send({ ok: true, id: started.userId, resetToken })
}
