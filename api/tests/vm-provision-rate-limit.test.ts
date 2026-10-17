import { afterAll, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

mock.module('#db', () => ({
    default: async () => ({ rows: [] }),
    withReadDatabase: async (work: () => unknown) => work(),
    withTransaction: async (work: (query: (sql: string) => Promise<unknown>) => unknown) => work(async () => ({ rows: [] })),
    isTransientDatabaseError: () => false,
}))
mock.module('#utils/auth/internalToken.ts', () => ({
    default: (req: { headers: { authorization?: string } }) => req.headers.authorization === 'Bearer provision-service',
}))
mock.module('#utils/auth/session.ts', () => ({ validateSession: async () => null }))
mock.module('#utils/auth/apiKeys.ts', () => ({
    validateApiKey: async () => null,
    matchApiKeyScope: () => null,
    organizationPublicApiScopes: () => [],
}))
mock.module('#utils/recovery.ts', () => ({ recoveryReadOnly: () => false }))
mock.module('#utils/rateLimit/config.ts', () => ({
    registerRateLimitRoute: () => {},
    resetSharedRateLimitBuckets: () => {},
    getRateLimitSettings: async () => ({
        enabled: true,
        defaults: { internal: { windowMs: 60_000, maxRequests: 6000 }, anonymous: { windowMs: 60_000, maxRequests: 90 } },
        overrides: [],
    }),
    consumeSharedRateLimitPair: async () => ({
        globalCheck: { allowed: true, remaining: 5, resetAt: Date.now() + 60_000, retryAfterMs: 60_000 },
        routeCheck: { allowed: true, remaining: 5, resetAt: Date.now() + 60_000, retryAfterMs: 60_000 },
    }),
    consumeSharedRateLimitBucket: async () => ({ allowed: true, remaining: 5, resetAt: Date.now() + 60_000, retryAfterMs: 60_000 }),
}))

const { default: rateLimit } = await import('../src/plugins/rateLimit.ts')
const app = Fastify()
let reachedHandler = false
await app.register(rateLimit)
app.post('/api/vms/internal/:name/provision', async () => {
    reachedHandler = true
    return { ok: true }
})
await app.ready()

afterAll(async () => { await app.close() })

test('provision service token reaches the internal route under its bounded rate-limit scope', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/api/vms/internal/vm-one/provision',
        headers: { authorization: 'Bearer provision-service' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers['x-rate-limit-scope']).toBe('internal')
    expect(reachedHandler).toBe(true)
})

test('invalid provision service token is rejected before reaching the route', async () => {
    reachedHandler = false
    const response = await app.inject({
        method: 'POST',
        url: '/api/vms/internal/vm-one/provision',
        headers: { authorization: 'Bearer wrong-token' },
    })
    expect(response.statusCode).toBe(401)
    expect(reachedHandler).toBe(false)
})
