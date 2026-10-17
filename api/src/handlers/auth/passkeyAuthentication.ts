import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { issueToken } from '#utils/auth/session.ts'
import {
    decodeUserHandle,
    passkeyConfig,
    publicKeyCredentialDescriptor,
    verifyAssertionCredential,
} from '#utils/auth/passkeys.ts'
import {
    consumePasskeyChallenge,
    createPasskeyChallenge,
    credentialForId,
    credentialIdFromBody,
    userForPasskey,
    type PasskeyBody,
} from './passkeySupport.ts'

export async function getPasskeyAuthenticateOptions(req: FastifyRequest, res: FastifyReply) {
    const query = req.query as { username?: string } | undefined
    const username = String(query?.username || '').trim().toLowerCase()
    const user = username ? await userForPasskey(username) : null
    const credentials = username
        ? await run('SELECT credential_id FROM user_passkeys WHERE user_id = $1 ORDER BY last_used_at DESC NULLS LAST, created_at DESC', [user?.id || username])
        : { rows: [] as Array<{ credential_id: string }> }
    if (username && !user) {
        return res.status(404).send({ error: 'No passkeys are registered for that account.' })
    }

    const config = passkeyConfig()
    const challenge = await createPasskeyChallenge(user?.id || null, 'authenticate')
    return res.send({
        challengeId: challenge.id,
        publicKey: {
            challenge: challenge.challenge,
            rpId: config.rpId,
            timeout: 60000,
            userVerification: 'preferred',
            allowCredentials: credentials.rows.map(row => publicKeyCredentialDescriptor(String(row.credential_id))),
        },
    })
}

export async function postPasskeyAuthenticateVerify(req: FastifyRequest, res: FastifyReply) {
    const body = req.body as PasskeyBody ?? {}
    const challenge = await consumePasskeyChallenge(body.challengeId, 'authenticate')
    if (!challenge || !body.credential) {
        return res.status(400).send({ error: 'Passkey login challenge is invalid or expired.' })
    }

    const credentialId = credentialIdFromBody(body.credential)
    const credential = credentialId ? await credentialForId(credentialId) : null
    if (!credential || (challenge.user_id && challenge.user_id !== credential.user_id)) {
        return res.status(404).send({ error: 'Passkey credential was not recognized.' })
    }

    const userHandle = decodeUserHandle(String(body.credential.response?.userHandle || ''))
    if (userHandle && userHandle !== credential.user_id) {
        return res.status(403).send({ error: 'Passkey user handle did not match the credential owner.' })
    }

    try {
        const assertion = verifyAssertionCredential({
            credential: body.credential,
            challenge: challenge.challenge,
            config: passkeyConfig(),
            publicKeyCose: credential.public_key_cose,
            previousSignCount: credential.sign_count,
        })
        await run(`
            UPDATE user_passkeys
            SET sign_count = GREATEST(sign_count, $2),
                last_used_at = NOW()
            WHERE credential_id = $1
        `, [credential.credential_id, assertion.signCount])

        const user = await userForPasskey(credential.user_id)
        if (!user?.active || user.deletion_scheduled_at) {
            return res.status(403).send({ error: 'This account is not active.' })
        }
        const session = await issueToken({
            id: user.id,
            ip: req.ip,
            userAgent: String(req.headers['user-agent'] || ''),
        })
        if (!session) {
            return res.status(503).send({ error: 'Passkey login succeeded, but the session could not be created.' })
        }

        return res.send({
            id: user.id,
            name: user.name,
            avatar: user.avatar ?? '',
            token: session.token,
            expires_at: session.expires_at,
            authProvider: 'passkey',
        })
    } catch (error) {
        req.log.warn({ error, credentialId }, 'Passkey assertion verification failed')
        return res.status(400).send({ error: 'Passkey login could not be verified.' })
    }
}
