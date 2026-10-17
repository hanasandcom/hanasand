import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { newPasskeyChallenge } from '#utils/auth/passkeys.ts'

export type PasskeyBody = {
    challengeId?: string
    credential?: Record<string, any>
    label?: string
}

export type ChallengeRow = {
    id: string
    user_id: string | null
    challenge: string
    purpose: 'register' | 'authenticate'
}

export type CredentialRow = {
    credential_id: string
    user_id: string
    public_key_cose: string
    sign_count: number
}

export type PasskeyUser = {
    id: string
    name: string
    avatar: string | null
    active: boolean
    deletion_scheduled_at?: string | null
}

export async function requirePasskeyUser(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.id) {
        res.status(401).send({ error: actor.error || 'Unauthorized.' })
        return null
    }
    return actor.id
}

export async function createPasskeyChallenge(userId: string | null, purpose: ChallengeRow['purpose']) {
    const challenge = newPasskeyChallenge()
    const result = await run(`
        INSERT INTO passkey_challenges (user_id, purpose, challenge, expires_at)
        VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')
        RETURNING id, user_id, purpose, challenge
    `, [userId, purpose, challenge])
    return result.rows[0] as ChallengeRow
}

export async function consumePasskeyChallenge(id: string | undefined, purpose: ChallengeRow['purpose'], userId?: string) {
    if (!id) return null
    const result = await run(`
        UPDATE passkey_challenges
        SET consumed_at = NOW()
        WHERE id = $1
          AND purpose = $2
          AND consumed_at IS NULL
          AND expires_at > NOW()
          AND ($3::text IS NULL OR user_id = $3)
        RETURNING id, user_id, purpose, challenge
    `, [id, purpose, userId || null])
    return (result.rows[0] as ChallengeRow | undefined) || null
}

export async function userForPasskey(userId: string) {
    const result = await run(`
        SELECT id, name, avatar, active, deletion_scheduled_at
        FROM users
        WHERE lower(id) = lower($1)
        LIMIT 1
    `, [userId])
    return result.rows[0] as PasskeyUser | undefined
}

export async function credentialForId(credentialId: string) {
    const result = await run(`
        SELECT credential_id, user_id, public_key_cose, sign_count
        FROM user_passkeys
        WHERE credential_id = $1
        LIMIT 1
    `, [credentialId])
    return (result.rows[0] as CredentialRow | undefined) || null
}

export function credentialIdFromBody(credential: Record<string, any>) {
    return String(credential.rawId || credential.id || '').trim()
}

export function labelForCredential(credential: Record<string, any>, requestedLabel?: string) {
    const label = cleanPasskeyLabel(requestedLabel)
    if (label) return label
    const platform = cleanPasskeyLabel(credential.clientPlatform)
    if (platform) return `Passkey ${platform}`
    const authenticatorAttachment = String(credential.authenticatorAttachment || '').trim()
    return authenticatorAttachment && authenticatorAttachment !== 'platform' ? `Passkey ${authenticatorAttachment}` : 'Passkey'
}

export function cleanPasskeyLabel(value: unknown) {
    const label = String(value || '').replace(/\s+/g, ' ').trim()
    if (!label || label.length > 80) return ''
    return label
}
