import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
const queries: Array<{ sql: string, params?: unknown[] }> = []
const revoked: Array<Record<string, unknown>> = []
let validSessionId: string | null = null

const query = async (sql: string, params?: unknown[]) => {
    queries.push({ sql, params })
    return { rows: [{ token_id: 1 }], rowCount: 1 }
}

mock.module('#db', () => ({
    default: query,
    identityQueryOnce: query,
    queryOnce: async () => ({ rows: [], rowCount: 0 }),
    closeDatabase: async () => {},
    withTransaction: async (work: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>, rowCount: number }>) => Promise<unknown>) => work(async (sql, params) => {
        queries.push({ sql, params })
        return { rows: [], rowCount: 0 }
    }),
}))
mock.module('#utils/auth/session.ts', () => ({
    issueToken: async () => null,
    listSessions: async () => [],
    revokeAllTokens: async () => 0,
    revokeToken: async (input: Record<string, unknown>) => { revoked.push(input); return true },
    validateSession: async ({ id }: { id?: string }) => id && id === validSessionId
        ? { user: { id }, session: { token_id: 17 } }
        : null,
}))
mock.module('../src/plugins/rateLimit.ts', () => ({ default: async () => {} }))

const { createAuthServer } = await import('../src/authServer.ts')
const app = createAuthServer()

beforeEach(() => {
    queries.length = 0
    revoked.length = 0
    validSessionId = 'caller'
})

test('logout rejects unauthenticated requests without touching tokens', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/logout/caller' })

    expect(response.statusCode).toBe(401)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(queries).toHaveLength(0)
})

test('logout rejects a caller token when the URL names another user', async () => {
    const response = await app.inject({
        method: 'GET',
        url: '/api/auth/logout/another-user',
        headers: { authorization: 'Bearer caller-session-token' },
    })

    expect(response.statusCode).toBe(401)
    expect(queries).toHaveLength(0)
})

test('logout revokes only the authenticated caller token', async () => {
    const response = await app.inject({
        method: 'GET',
        url: '/api/auth/logout/caller',
        headers: { authorization: 'Bearer caller-session-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ invalidatedTokens: 1 })
    expect(revoked).toEqual([{ tokenId: 17, userId: 'caller', revokedBy: 'caller' }])
})

afterAll(async () => { await app.close() })
