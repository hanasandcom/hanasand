import { expect, mock, test } from 'bun:test'
import { createHash } from 'node:crypto'
import Fastify from 'fastify'

const loadTestInsertCalls: Array<{ sql: string, values: unknown[] }> = []
const myTestsQueries: Array<{ sql: string, values: unknown[] }> = []
const trafficEvents: unknown[][] = []
const rateLimitKeys: string[] = []

async function query(sql: string, values: unknown[] = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim()
    const call = { sql: normalizedSql, values }
    if (normalizedSql.startsWith('SELECT COUNT(*)::int AS used FROM load_tests WHERE quota_identity = $1')) {
        return { rows: [{ used: 0 }] }
    }
    if (normalizedSql.startsWith('INSERT INTO load_tests')) {
        loadTestInsertCalls.push(call)
        return { rows: [{ id: 'load-test-1' }] }
    }
    if (normalizedSql.startsWith('SELECT * FROM load_tests WHERE id = $1')) {
        return { rows: [{ id: 'load-test-1' }] }
    }
    if (normalizedSql.includes('FROM load_tests tests') && normalizedSql.includes('tests.quota_identity = $1')) {
        myTestsQueries.push(call)
        return { rows: [{ id: 'load-test-1', quota_identity: values[0] }] }
    }
    if (normalizedSql.startsWith('INSERT INTO traffic_events')) {
        trafficEvents.push(values)
        return { rows: [] }
    }

    throw new Error(`Unexpected database query: ${normalizedSql}`)
}

mock.module('#db', () => ({
    default: query,
    queryOnce: query,
    withReadDatabase: async (work: () => unknown) => work(),
    withTransaction: async (work: (run: typeof query) => unknown) => work(query),
    isTransientDatabaseError: () => false,
}))
mock.module('#utils/events/customRetention.ts', () => ({
    customRetentionAction: () => undefined,
    loadLogRetentionRules: async () => [],
    retentionStoreMatches: () => false,
}))
mock.module('#utils/events/analyzeLog.ts', () => ({ analyzeAccess: async () => false }))
mock.module('#utils/traffic/proxyRequest.ts', () => ({ recordProxyRequest: async () => false }))
mock.module('../src/handlers/test/follow.ts', () => ({ enqueueLoadTestRun: async () => {} }))
mock.module('#utils/rateLimit/config.ts', () => ({
    registerRateLimitRoute: () => {},
    resetSharedRateLimitBuckets: async () => 0,
    consumeSharedRateLimitBucket: async () => ({ allowed: true, remaining: 89, resetAt: Date.now() + 60_000, retryAfterMs: 0 }),
    consumeSharedRateLimitPair: async (global: { key: string }, route: { key: string }) => {
        rateLimitKeys.push(global.key, route.key)
        const check = { allowed: true, remaining: 89, resetAt: Date.now() + 60_000, retryAfterMs: 0 }
        return { globalCheck: check, routeCheck: check }
    },
    getRateLimitSettings: async () => ({
        enabled: true,
        defaults: {
            anonymous: { windowMs: 60_000, maxRequests: 90 },
            authenticated: { windowMs: 60_000, maxRequests: 1_800 },
            internal: { windowMs: 60_000, maxRequests: 6_000 },
        },
        overrides: [],
    }),
}))

const { TRUSTED_API_PROXIES } = await import('../src/utils/http/publicBoundary.ts')
const { default: rateLimit } = await import('../src/plugins/rateLimit.ts')
const { default: recordTraffic } = await import('../src/utils/traffic/recordTraffic.ts')
const { default: postTest } = await import('../src/handlers/test/post.ts')
const { getMyRecentTests } = await import('../src/handlers/test/list.ts')

test('uses the verified client IP for rate actor, load-test quota and recorded traffic', async () => {
    const clientId = 'verified-ip-regression'
    const userAgent = 'verified-ip-test'
    const clientIp = '203.0.113.19'
    const forgedIp = '198.51.100.250'
    const quotaIdentity = `anon:${createHash('sha256').update(`${clientId}|${clientIp}|${userAgent}`).digest('hex').slice(0, 32)}`
    const app = Fastify({ trustProxy: TRUSTED_API_PROXIES })

    app.addHook('onResponse', async (request, reply) => recordTraffic(request, reply, true))
    await app.register(rateLimit)
    app.post('/api/test', postTest)
    app.get('/api/tests/mine', getMyRecentTests)
    await app.ready()

    const headers = {
        'x-forwarded-for': `${forgedIp}, ${clientIp}`,
        'x-load-test-client-id': clientId,
        'user-agent': userAgent,
    }
    try {
        const created = await app.inject({
            method: 'POST',
            url: '/api/test',
            remoteAddress: '127.0.0.1',
            headers,
            payload: { url: 'https://test.example/' },
        })
        expect(created.statusCode).toBe(200)
        expect(created.headers['x-rate-limit-scope']).toBe('anonymous')
        expect(created.json().quota.identity).toBe(quotaIdentity)

        const listed = await app.inject({
            method: 'GET',
            url: '/api/tests/mine?limit=20',
            remoteAddress: '127.0.0.1',
            headers,
        })
        expect(listed.statusCode).toBe(200)
        expect(listed.headers['x-rate-limit-scope']).toBe('anonymous')
        expect(listed.json()).toHaveLength(1)

        expect(rateLimitKeys).toEqual([
            `ip:${clientIp}:global:anonymous`,
            `ip:${clientIp}:route:anonymous:POST:/api/test`,
            `ip:${clientIp}:global:anonymous`,
            `ip:${clientIp}:route:anonymous:GET:/api/tests/mine`,
        ])
        expect(loadTestInsertCalls).toHaveLength(1)
        const loadTestColumns = loadTestInsertCalls[0].sql.match(/INSERT INTO load_tests \(([^)]+)\)/)?.[1]
            .split(',').map(column => column.trim())
        expect(loadTestInsertCalls[0].values[loadTestColumns?.indexOf('quota_identity') ?? -1]).toBe(quotaIdentity)
        expect(myTestsQueries).toHaveLength(1)
        expect(myTestsQueries[0].values[0]).toBe(quotaIdentity)

        expect(trafficEvents.map(values => ({ path: values[1], ip: values[4] }))).toEqual([
            { path: '/api/test', ip: clientIp },
            { path: '/api/tests/mine', ip: clientIp },
        ])
        expect(JSON.stringify({ rateLimitKeys, quotaIdentity, trafficEvents })).not.toContain(forgedIp)
    } finally {
        await app.close()
        loadTestInsertCalls.length = 0
        myTestsQueries.length = 0
        trafficEvents.length = 0
        rateLimitKeys.length = 0
    }
})
