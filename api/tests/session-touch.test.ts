import { afterEach, beforeEach, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'

type SessionResult = {
    user: { id: string }
    session: { token: string }
    refreshed: { token: string, expires_at: string }
    revoked?: unknown
}
const originalFetch = globalThis.fetch
const originalServiceToken = process.env.HANASAND_IDENTITY_SERVICE_TOKEN
const serviceToken = 'identity-test+/token=='
let calls: Array<{ url: string, init: RequestInit }> = []
let result: SessionResult | null = null
let responseStatus = 200

const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init || {} })
    return Response.json(result, { status: responseStatus })
}) as typeof fetch

const { revokeAllTokens, validateSession } = await import('../src/utils/auth/session.ts')

beforeEach(() => {
    globalThis.fetch = mockFetch
    process.env.HANASAND_IDENTITY_SERVICE_TOKEN = serviceToken
    calls = []
    responseStatus = 200
    result = {
        user: { id: 'member' },
        session: { token: randomUUID() },
        refreshed: { token: randomUUID(), expires_at: new Date(Date.now() + 86400000).toISOString() },
    }
})

afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalServiceToken === undefined) delete process.env.HANASAND_IDENTITY_SERVICE_TOKEN
    else process.env.HANASAND_IDENTITY_SERVICE_TOKEN = originalServiceToken
})

test('parallel session validation delegates each request to Identity and returns its result', async () => {
    const token = randomUUID()
    const identityResult = result
    const validations = await Promise.all(Array.from({ length: 10 }, () => validateSession({ id: 'member', token })))

    expect(validations).toHaveLength(10)
    expect(validations.every(validation => validation?.user.id === 'member')).toBe(true)
    expect(validations.every(validation => validation?.session.token === identityResult?.session.token)).toBe(true)
    expect(validations.every(validation => validation?.refreshed.token === identityResult?.refreshed.token
        && validation.refreshed.expires_at === identityResult?.refreshed.expires_at)).toBe(true)
    expect(calls).toHaveLength(10)
    expect(calls.every(({ url, init }) => url.endsWith('/api/auth/internal/sessions')
        && init.method === 'POST'
        && init.signal instanceof AbortSignal
        && (init.headers as Record<string, string>).Authorization === `Bearer ${serviceToken}`
        && JSON.parse(String(init.body)).operation === 'validate'
        && JSON.parse(String(init.body)).token === token)).toBe(true)
})

test('organization membership scope is forwarded to Identity', async () => {
    const token = randomUUID()
    await validateSession({ id: 'member', token, organizationSlug: 'hanasand' })

    expect(calls).toHaveLength(1)
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ id: 'member', token, organizationSlug: 'hanasand', operation: 'validate' })
})

test('invalid or expired Identity sessions remain unauthenticated', async () => {
    responseStatus = 401
    result = null

    expect(await validateSession({ id: 'member', token: randomUUID() })).toBeNull()
    expect(calls).toHaveLength(1)
})

test('Identity service failures propagate instead of becoming unauthenticated sessions', async () => {
    responseStatus = 503
    result = null

    await expect(validateSession({ id: 'member', token: randomUUID() }))
        .rejects.toThrow('Identity session operation failed (503).')

    expect(calls).toHaveLength(1)
})

test('account-wide revocation preserves the difference between no sessions and unauthorized', async () => {
    result = { ...result!, revoked: 0 }
    expect(await revokeAllTokens({ userId: 'member', revokedBy: 'member' })).toBe(0)

    calls = []
    responseStatus = 401
    result = null
    expect(await revokeAllTokens({ userId: 'member', revokedBy: 'member' })).toBeNull()
    expect(calls).toHaveLength(1)
})

test('account-wide revocation rejects malformed success counts', async () => {
    const validResponse = result!
    for (const revoked of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1']) {
        calls = []
        result = { ...validResponse, revoked }
        await expect(revokeAllTokens({ userId: 'member', revokedBy: 'member' }))
            .rejects.toThrow('invalid revocation count')
    }

    calls = []
    result = { ...validResponse }
    await expect(revokeAllTokens({ userId: 'member', revokedBy: 'member' }))
        .rejects.toThrow('invalid revocation count')

    result = null
    await expect(revokeAllTokens({ userId: 'member', revokedBy: 'member' }))
        .rejects.toThrow('invalid revocation count')
})
