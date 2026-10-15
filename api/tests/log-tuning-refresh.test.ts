import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const statements: Array<{ sql: string, params: unknown[] }> = []
const invalidations: string[] = []
let authorized = true
let hasAccess = true
let failQueue = false
const organizationId = 'test-tuning-org'
const query = async (sql: string, params: unknown[] = []) => {
    statements.push({ sql, params })
    if (sql.startsWith('INSERT INTO log_tuning_snapshots')) {
        if (failQueue) throw new Error('database unavailable')
        return { rows: [] }
    }
    if (sql.startsWith('SELECT generated_at::text AS generated_at, refresh_requested_at')) {
        return { rows: [{ generated_at: new Date().toISOString(), refresh_requested_at: '2026-10-01T00:00:00.000Z',
            logs: [{ last_triggered: null, last_24h_count: '100' }] }] }
    }
    throw new Error(`Unexpected query: ${sql}`)
}

mock.module('#db', () => ({
    default: query,
    withTransaction: async <T>(work: (query: typeof query) => Promise<T>) => work(query),
}))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authorized }) }))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({
    default: async () => ({ valid: hasAccess }),
    HANASAND_ORGANIZATION_ID: organizationId,
}))
mock.module('../src/utils/readCache.ts', () => ({
    cachedRead: async (_key: string, _ttl: number, load: () => Promise<unknown>) => load(),
    invalidateReadCache: (key: string) => { invalidations.push(key) },
}))

const { postLogTuningRefresh } = await import('../src/handlers/logs/tuning.ts')
const app = Fastify()
app.post('/logs/tuning/refresh', postLogTuningRefresh)
const refresh = () => app.inject({ method: 'POST', url: '/logs/tuning/refresh' })
afterAll(async () => { await app.close() })

beforeEach(() => {
    statements.length = 0
    invalidations.length = 0
    authorized = true
    hasAccess = true
    failQueue = false
})

test('refresh requires an authorized organization member before queueing work', async () => {
    authorized = false
    expect((await refresh()).statusCode).toBe(401)
    authorized = true
    hasAccess = false
    const denied = await refresh()
    expect(denied.statusCode).toBe(403)
    expect(statements).toHaveLength(0)
    expect(invalidations).toEqual([])
})

test('refresh queues the scoped snapshot, invalidates its cache and returns retry guidance', async () => {
    const response = await refresh()
    const queue = statements.find(({ sql }) => sql.startsWith('INSERT INTO log_tuning_snapshots'))

    expect(response.statusCode).toBe(202)
    expect(response.headers['retry-after']).toBe('15')
    expect(response.json()).toEqual({ refreshing: true })
    expect(queue?.params).toEqual([organizationId])
    expect(queue?.sql).toContain('VALUES ($1, \'[]\'::jsonb, NOW())')
    expect(queue?.sql).toContain('ON CONFLICT (organization_id) DO UPDATE SET refresh_requested_at = NOW()')
    expect(invalidations).toEqual([`log-tuning-snapshot:${organizationId}`])
})

test('queue failures return unavailable without invalidating the cached snapshot', async () => {
    failQueue = true
    const response = await refresh()

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ error: 'Log tuning refresh could not be queued. Try again shortly.' })
    expect(invalidations).toEqual([])
})
