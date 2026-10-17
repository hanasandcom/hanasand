import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import { revokeAllTokens } from '#utils/auth/session.ts'
import { validatePassword } from '#utils/auth/password.ts'
import { sendSystemMail } from '#utils/mail/system.ts'
import { syncMailPasswordForUser } from '#utils/mail/accounts.ts'
import { passwordChangedMail } from '#utils/auth/passwordChangedMail.ts'
import { consumePendingPasswordResetCodes } from '#utils/auth/passwordReset.ts'
import {
    createSecurityActionTokens,
    consumeReset,
    getActiveUser,
    getPendingReset,
    hashResetToken,
    normalizeUserId,
    recoveryAddressForUser,
    RESET_TTL_MINUTES,
    type ResetRow,
} from './passwordResetSupport.ts'

const MAX_CODE_ATTEMPTS = 5

type RequestBody = { id?: string }
type VerifyBody = { id?: string, code?: string }
type CompleteBody = { id?: string, resetToken?: string, password?: string }

export async function requestPasswordReset(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.body as RequestBody ?? {}
    const identifier = normalizeUserId(id)
    if (!identifier) return res.status(400).send({ error: 'Enter your username.' })

    const user = await getActiveUser(identifier)
    if (!user) return res.send({ ok: true })

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
    const codeHash = await bcrypt.hash(code, 10)
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000)
    await consumePendingPasswordResetCodes(user.id)
    await run(`
        INSERT INTO password_reset_codes (user_id, code_hash, requested_ip, user_agent, expires_at)
        VALUES ($1, $2, $3, $4, $5)
    `, [user.id, codeHash, req.ip, String(req.headers['user-agent'] || ''), expiresAt])

    try {
        await sendSystemMail({
            to: recoveryAddressForUser(user),
            subject: 'Hanasand password reset code',
            textBody: `Your Hanasand password reset code is ${code}.\n\nIt expires in ${RESET_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.`,
            htmlBody: `<p>Your Hanasand password reset code is <strong>${code}</strong>.</p><p>It expires in ${RESET_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.</p>`,
        })
    } catch (error) {
        req.log.error(error)
        await consumePendingPasswordResetCodes(user.id).catch(() => {})
        return res.status(500).send({ error: 'Unable to send reset email.' })
    }

    return res.send({ ok: true })
}

export async function verifyPasswordResetCode(req: FastifyRequest, res: FastifyReply) {
    const { id, code } = req.body as VerifyBody ?? {}
    const user = await getActiveUser(normalizeUserId(id))
    const userId = user?.id || ''
    const resetCode = String(code || '').trim()
    if (!userId || !/^\d{6}$/.test(resetCode)) return res.status(400).send({ error: 'Enter the 6 digit code.' })

    const reset = await getPendingReset(userId)
    if (!reset) return res.status(400).send({ error: 'The reset code is invalid or expired.' })
    if (reset.attempts >= MAX_CODE_ATTEMPTS) {
        await consumeReset(reset.id)
        return res.status(400).send({ error: 'The reset code is invalid or expired.' })
    }

    const valid = await bcrypt.compare(resetCode, reset.code_hash)
    if (!valid) {
        await run('UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = $1', [reset.id])
        return res.status(400).send({ error: 'The reset code is invalid or expired.' })
    }

    const resetToken = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`
    await run(`
        UPDATE password_reset_codes
        SET reset_token_hash = $2,
            verified_at = NOW()
        WHERE id = $1
    `, [reset.id, hashResetToken(resetToken)])

    return res.send({ ok: true, resetToken, expiresAt: reset.expires_at })
}

export async function completePasswordReset(req: FastifyRequest, res: FastifyReply) {
    const { id, resetToken, password } = req.body as CompleteBody ?? {}
    const user = await getActiveUser(normalizeUserId(id))
    const userId = user?.id || ''
    const tokenHash = hashResetToken(String(resetToken || ''))
    if (!user || !resetToken || !password) return res.status(400).send({ error: 'Missing reset token or password.' })

    const resetResult = await run(`
        SELECT prc.id, prc.user_id, prc.reset_token_hash, prc.expires_at, u.name
        FROM password_reset_codes prc
        JOIN users u ON u.id = prc.user_id
        WHERE prc.user_id = $1
          AND prc.reset_token_hash = $2
          AND prc.consumed_at IS NULL
          AND prc.expires_at > NOW()
          AND u.active IS TRUE
        ORDER BY prc.verified_at DESC NULLS LAST, prc.created_at DESC
        LIMIT 1
    `, [userId, tokenHash])
    if (!resetResult.rows.length) return res.status(400).send({ error: 'The reset session is invalid or expired.' })

    const validation = await validatePassword(password)
    if (!validation.valid) return res.status(400).send({ error: validation.error })

    const reset = resetResult.rows[0] as ResetRow & { name: string }
    const hashedPassword = await bcrypt.hash(password, 10)
    const updated = await withTransaction(async query => {
        await query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId])
        const consumed = await query(`UPDATE password_reset_codes SET consumed_at = NOW()
            WHERE id = $1 AND reset_token_hash = $2 AND consumed_at IS NULL AND expires_at > NOW()
            RETURNING id`, [reset.id, tokenHash])
        if (!consumed.rows.length) return false
        await query('UPDATE users SET password = $2, password_reset_locked_at = NULL WHERE id = $1', [userId, hashedPassword])
        await consumePendingPasswordResetCodes(userId, query)
        await query('DELETE FROM attempts WHERE id = $1', [userId])
        await revokeAllTokens({ userId, revokedBy: 'password_reset' })
        return true
    })
    if (!updated) return res.status(400).send({ error: 'The reset session is invalid or expired.' })

    await syncMailPasswordForUser(userId, reset.name || userId, password).catch(error => {
        req.log.error({ error, userId }, 'Failed to sync mail password after password reset')
    })
    try {
        const actions = await createSecurityActionTokens(userId, reset.id)
        await sendSystemMail({
            to: recoveryAddressForUser(user),
            ...passwordChangedMail({
                id: userId,
                changedAt: new Date(),
                ip: req.ip,
                userAgent: String(req.headers['user-agent'] || ''),
                ...actions,
            }),
        })
    } catch (error) {
        req.log.error({ error, userId }, 'Failed to send password reset security notification')
    }

    return res.send({ ok: true })
}
