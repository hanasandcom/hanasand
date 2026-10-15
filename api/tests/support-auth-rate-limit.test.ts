import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let allowed = true
let buckets: Array<{ key: string, maxRequests: number }> = []
const originalKey = process.env.SUPPORT_AUTH_SERVICE_KEY

mock.module('#utils/support/config.ts', () => ({ shouldProxySupport: () => false }))
mock.module('#utils/auth/logIngestToken.ts', () => ({ hasLogIngestToken: () => false }))
mock.module('#utils/recovery.ts', () => ({ recoveryReadOnly: () => false }))
mock.module('#utils/auth/apiKeys.ts', () => ({ matchApiKeyScope: () => null, organizationPublicApiScopes: () => [], validateApiKey: async () => null }))
mock.module('#utils/auth/session.ts', () => ({ validateSession: async () => null }))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({ hasHanasandInternalPageAccess: async () => false, HANASAND_ORGANIZATION_ID: 'hanasand' }))
mock.module('#utils/auth/organizationPagePolicy.ts', () => ({ canEditHanasandInternalPages: async () => false }))
mock.module('#utils/rateLimit/config.ts', () => ({
    consumeSharedRateLimitBucket: async () => ({ allowed, remaining: 5, resetAt: Date.now() + 60_000, retryAfterMs: 60_000 }),
    consumeSharedRateLimitPair: async (global: { key: string, rule: { maxRequests: number } }, route: { key: string, rule: { maxRequests: number } }) => {
        buckets = [global, route].map(({ key, rule }) => ({ key, maxRequests: rule.maxRequests }))
        return { globalCheck: { allowed, remaining: 5, resetAt: Date.now() + 60_000, retryAfterMs: 60_000 }, routeCheck: allowed ? { allowed, remaining: 5, resetAt: Date.now() + 60_000, retryAfterMs: 60_000 } : null }
    },
    getRateLimitSettings: async () => ({ enabled: true, defaults: { anonymous: { windowMs: 60_000, maxRequests: 90 }, authenticated: { windowMs: 60_000, maxRequests: 1_800 }, internal: { windowMs: 60_000, maxRequests: 6_000 } }, overrides: [] }),
    registerRateLimitRoute: () => {}, resetSharedRateLimitBuckets: async () => 0,
}))
mock.module('#utils/auth/internalToken.ts', () => ({ default: () => false }))
mock.module('#utils/http/publicBoundary.ts', () => ({ verifiedClientIp: () => '127.0.0.1' }))
mock.module('#db', () => ({ default: async () => ({ rows: [] }), withReadDatabase: async (work: any) => work(async () => ({ rows: [] })), withTransaction: async (work: any) => work(async () => ({ rows: [] })), isTransientDatabaseError: () => false }))

const { default: rateLimit } = await import('../src/plugins/rateLimit.ts')
const app = Fastify()
await app.register(async api => {
    await api.register(rateLimit)
    api.post('/auth/support/authorize', async () => ({ authorized: true }))
}, { prefix: '/api' })
await app.ready()

beforeEach(() => { allowed = true; buckets = []; process.env.SUPPORT_AUTH_SERVICE_KEY = 'a'.repeat(48) })
afterAll(async () => {
    await app.close()
    if (originalKey === undefined) delete process.env.SUPPORT_AUTH_SERVICE_KEY
    else process.env.SUPPORT_AUTH_SERVICE_KEY = originalKey
})

test('trusted support auth traffic uses bounded internal rate limits', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/support/authorize', headers: { 'x-support-auth-key': 'a'.repeat(48) }, payload: {} })

    expect(response.statusCode).toBe(200)
    expect(buckets).toEqual([
        { key: 'service:support-auth:global:internal', maxRequests: 6_000 },
        { key: 'service:support-auth:route:internal:POST:/api/auth/support/authorize', maxRequests: 6_000 },
    ])
})

test('trusted support auth is rejected when its internal rate limit is exhausted', async () => {
    allowed = false
    const response = await app.inject({ method: 'POST', url: '/api/auth/support/authorize', headers: { 'x-support-auth-key': 'a'.repeat(48) }, payload: {} })
    expect(response.statusCode).toBe(429)
    expect(buckets[0].key).toContain('service:support-auth:global:internal')
})

test('invalid support auth keys retain anonymous rate limits', async () => {
    allowed = false
    const response = await app.inject({ method: 'POST', url: '/api/auth/support/authorize', headers: { 'x-support-auth-key': 'wrong' }, payload: {} })
    expect(response.statusCode).toBe(429)
    expect(buckets[0].key).toContain('ip:127.0.0.1:global:anonymous')
})
