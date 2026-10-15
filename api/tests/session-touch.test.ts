import { afterEach, beforeEach, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'

type SessionResult = { user: { id: string }, session: { token: string }, refreshed: { expires_at: string } }
const originalFetch = globalThis.fetch
const originalServiceToken = process.env.HANASAND_IDENTITY_SERVICE_TOKEN
let calls: Array<{ url: string, init: RequestInit }> = []
let result: SessionResult | null = null
let responseStatus = 200

const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init || {} })
    return Response.json(result, { status: responseStatus })
}) as typeof fetch

const { validateSession } = await import('../src/utils/auth/session.ts')

beforeEach(() => {
    globalThis.fetch = mockFetch
    process.env.HANASAND_IDENTITY_SERVICE_TOKEN = 'identity-test-token'
    calls = []
    responseStatus = 200
    result = { user: { id: 'member' }, session: { token: randomUUID() }, refreshed: { expires_at: new Date(Date.now() + 86400000).toISOString() } }
})

afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalServiceToken === undefined) delete process.env.HANASAND_IDENTITY_SERVICE_TOKEN
    else process.env.HANASAND_IDENTITY_SERVICE_TOKEN = originalServiceToken
})

test('parallel session validation delegates each request to Identity and returns its result', async () => {
    const token = randomUUID()
    const validations = await Promise.all(Array.from({ length: 10 }, () => validateSession({ id: 'member', token })))

    expect(validations).toHaveLength(10)
    expect(validations.every(validation => validation?.user.id === 'member')).toBe(true)
    expect(calls).toHaveLength(10)
    expect(calls.every(({ url, init }) => url.endsWith('/api/auth/internal/sessions')
        && init.method === 'POST'
        && (init.headers as Record<string, string>).Authorization === 'Bearer identity-test-token'
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
