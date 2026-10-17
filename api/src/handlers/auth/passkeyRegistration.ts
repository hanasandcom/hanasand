import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { upsertIdentityPasskey } from '#utils/db/identityDataWrites.ts'
import {
    passkeyConfig,
    publicKeyCredentialDescriptor,
    userHandleFor,
    verifyRegistrationCredential,
} from '#utils/auth/passkeys.ts'
import {
    cleanPasskeyLabel,
    consumePasskeyChallenge,
    createPasskeyChallenge,
    labelForCredential,
    requirePasskeyUser,
    userForPasskey,
    type PasskeyBody,
} from './passkeySupport.ts'

export async function getPasskeyRegisterOptions(req: FastifyRequest, res: FastifyReply) {
    const userId = await requirePasskeyUser(req, res)
    if (!userId) return

    const user = await userForPasskey(userId)
    if (!user) {
        return res.status(404).send({ error: 'User not found.' })
    }

    const config = passkeyConfig()
    const challenge = await createPasskeyChallenge(userId, 'register')
    const existing = await run(
        'SELECT credential_id FROM user_passkeys WHERE user_id = $1 ORDER BY created_at DESC',
        [userId],
    )

    return res.send({
        challengeId: challenge.id,
        publicKey: {
            challenge: challenge.challenge,
            rp: { name: config.rpName, id: config.rpId },
            user: {
                id: userHandleFor(user.id),
                name: user.id,
                displayName: user.name || user.id,
            },
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 },
            ],
            timeout: 60000,
            attestation: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
            },
            excludeCredentials: existing.rows.map(row => publicKeyCredentialDescriptor(String(row.credential_id))),
        },
    })
}

export async function getPasskeys(req: FastifyRequest, res: FastifyReply) {
    const userId = await requirePasskeyUser(req, res)
    if (!userId) return

    const result = await run(`
        SELECT credential_id, label, alg, aaguid, sign_count, created_at, last_used_at
        FROM user_passkeys
        WHERE user_id = $1
        ORDER BY last_used_at DESC NULLS LAST, created_at DESC
    `, [userId])

    return res.send({
        passkeys: result.rows.map(row => ({
            credentialId: row.credential_id,
            label: row.label,
            algorithm: Number(row.alg) === -7 ? 'ES256' : Number(row.alg) === -257 ? 'RS256' : String(row.alg),
            aaguid: row.aaguid,
            signCount: Number(row.sign_count || 0),
            createdAt: row.created_at,
            lastUsedAt: row.last_used_at,
        })),
    })
}

export async function deletePasskey(req: FastifyRequest, res: FastifyReply) {
    const userId = await requirePasskeyUser(req, res)
    if (!userId) return

    const { credentialId } = req.params as { credentialId?: string } ?? {}
    if (!credentialId) {
        return res.status(400).send({ error: 'Missing passkey credential id.' })
    }

    const result = await run(
        'DELETE FROM user_passkeys WHERE credential_id = $1 AND user_id = $2 RETURNING credential_id',
        [credentialId, userId],
    )
    if (!result.rows.length) {
        return res.status(404).send({ error: 'Passkey not found.' })
    }

    return res.send({ ok: true, credentialId })
}

export async function patchPasskey(req: FastifyRequest, res: FastifyReply) {
    const userId = await requirePasskeyUser(req, res)
    if (!userId) return

    const { credentialId } = req.params as { credentialId?: string } ?? {}
    const label = cleanPasskeyLabel((req.body as PasskeyBody | undefined)?.label)
    if (!credentialId) {
        return res.status(400).send({ error: 'Missing passkey credential id.' })
    }
    if (!label) {
        return res.status(400).send({ error: 'Passkey name is required.' })
    }

    const result = await run(
        'UPDATE user_passkeys SET label = $3 WHERE credential_id = $1 AND user_id = $2 RETURNING credential_id, label',
        [credentialId, userId, label],
    )
    if (!result.rows.length) {
        return res.status(404).send({ error: 'Passkey not found.' })
    }

    return res.send({ ok: true, credentialId: result.rows[0].credential_id, label: result.rows[0].label })
}

export async function postPasskeyRegisterVerify(req: FastifyRequest, res: FastifyReply) {
    const userId = await requirePasskeyUser(req, res)
    if (!userId) return

    const body = req.body as PasskeyBody ?? {}
    const challenge = await consumePasskeyChallenge(body.challengeId, 'register', userId)
    if (!challenge || !body.credential) {
        return res.status(400).send({ error: 'Passkey registration challenge is invalid or expired.' })
    }

    try {
        const parsed = verifyRegistrationCredential({
            credential: body.credential,
            challenge: challenge.challenge,
            config: passkeyConfig(),
        })
        await upsertIdentityPasskey({
            credentialId: parsed.credentialId,
            userId,
            publicKeyCose: parsed.publicKeyCose,
            signCount: parsed.signCount,
            algorithm: parsed.alg,
            aaguid: parsed.aaguid,
            label: labelForCredential(body.credential, body.label),
        })

        return res.send({
            ok: true,
            credentialId: parsed.credentialId,
            userId,
            signCount: parsed.signCount,
        })
    } catch (error) {
        req.log.warn({ error, userId }, 'Passkey registration verification failed')
        return res.status(400).send({ error: 'Passkey registration could not be verified.' })
    }
}
