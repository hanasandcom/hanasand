import { afterAll, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const queries: Array<{ sql: string, params?: unknown[] }> = []
let issuedSessions = 0
let assertionVerifications = 0

mock.module('#db', () => ({
    default: async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params })
        if (sql.includes('UPDATE passkey_challenges')) {
            return { rows: [{ id: 'challenge-a', user_id: 'user-a', purpose: 'authenticate', challenge: 'challenge-value' }] }
        }
        if (sql.includes('FROM user_passkeys')) {
            return { rows: [{ credential_id: 'credential-b', user_id: 'user-b', public_key_cose: 'key-b', sign_count: 3 }] }
        }
        throw new Error(`Unexpected query: ${sql}`)
    },
}))
mock.module('#utils/auth/passkeys.ts', () => ({
    decodeUserHandle: () => '',
    newPasskeyChallenge: () => 'unused',
    passkeyConfig: () => ({ rpId: 'hanasand.com', rpName: 'Hanasand' }),
    publicKeyCredentialDescriptor: (id: string) => ({ type: 'public-key', id }),
    userHandleFor: (id: string) => id,
    verifyAssertionCredential: () => { assertionVerifications++; return { signCount: 4 } },
    verifyRegistrationCredential: () => { throw new Error('Unexpected registration verification') },
}))
mock.module('#utils/auth/session.ts', () => ({
    issueToken: async () => { issuedSessions++; return { token: 'session-token', expires_at: '2030-01-01T00:00:00.000Z' } },
}))
mock.module('#utils/db/identityDataWrites.ts', () => ({ upsertIdentityPasskey: async () => {} }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: false }) }))

const { postPasskeyAuthenticateVerify } = await import('../src/handlers/auth/passkeys.ts')
const app = Fastify()
app.post('/auth/passkeys/authenticate/verify', postPasskeyAuthenticateVerify)

test('a credential owned by another user cannot satisfy a user-bound challenge', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/auth/passkeys/authenticate/verify',
        payload: { challengeId: 'challenge-a', credential: { id: 'credential-b', rawId: 'credential-b' } },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Passkey credential was not recognized.' })
    expect(queries).toHaveLength(2)
    expect(queries[1].sql).toContain('FROM user_passkeys')
    expect(queries[1].params).toEqual(['credential-b'])
    expect(queries.some(({ sql }) => sql.includes('UPDATE user_passkeys'))).toBe(false)
    expect(assertionVerifications).toBe(0)
    expect(issuedSessions).toBe(0)
})

afterAll(async () => { await app.close() })
