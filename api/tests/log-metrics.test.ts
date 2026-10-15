import { beforeEach, expect, mock, test } from 'bun:test'

const queries: Array<{ sql: string, params: unknown[] }> = []
let tokenValid = false
let accessValid = false
mock.module('#db', () => ({
    default: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params })
        if (sql.includes('AS received')) return { rows: [{ checked_count: 100, remaining: 12, received: 130 }] }
        if (sql.includes('WITH samples AS')) return { rows: [{ sampled_at: new Date(), pps: 2, eps: 1, historical_eps: 1, npps: 1, remaining: 12 }] }
        return { rows: [] }
    },
}))
mock.module('#utils/logs/cache.ts', () => ({ cachedLogQuery: async (_key: string, _ttl: number, load: () => Promise<unknown>) => load() }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: tokenValid }) }))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: accessValid }) }))

const { getLogMetrics, getPublicLogMetrics } = await import('../src/handlers/logs/metrics.ts')

beforeEach(() => {
    queries.length = 0
    tokenValid = false
    accessValid = false
})

test('log chart history is a cached-size set of completed five-minute averages for 24 hours', async () => {
    const reply = { body: undefined as unknown, send(body: unknown) { this.body = body; return body }, status() { return this } }
    await getPublicLogMetrics({ query: {} } as any, reply as any)

    const metrics = reply.body as any
    const currentQuery = queries.find(query => query.sql.includes('AS received'))
    const insert = queries.find(query => query.sql.includes('INSERT INTO log_throughput_samples'))
    const historyQuery = queries.find(query => query.sql.includes('WITH samples AS'))
    expect(currentQuery?.sql).toContain('processing_status=\'pending\'')
    expect(insert?.params?.slice(1)).toEqual([100, 10, 13, 0, 1.3, 12])
    expect(historyQuery?.sql).toContain('date_bin(INTERVAL \'5 minutes\'')
    expect(historyQuery?.sql).toContain('WHERE sampled_at >= NOW() - INTERVAL \'24 hours\'')
    expect(historyQuery?.sql).toContain('AVG(pps)')
    expect(historyQuery?.sql).toContain('AVG(eps)')
    expect(historyQuery?.sql).toContain('AVG(npps)')
    expect(historyQuery?.sql).toContain('bucket_start + INTERVAL \'5 minutes\' <= NOW()')
    expect(metrics.current).toMatchObject({ pps: 10, eps: 13, historical_eps: 0, npps: 1.3, remaining: 12, alert: true })
    expect(metrics.history).toHaveLength(1)
})

test('private log metrics require both token and organization access before querying', async () => {
    const makeReply = () => ({
        body: undefined as unknown,
        statusCode: 200,
        send(body: unknown) { this.body = body; return body },
        status(code: number) { this.statusCode = code; return this },
    })

    const unauthorized = makeReply()
    await getLogMetrics({ query: {} } as any, unauthorized as any)
    expect(unauthorized.statusCode).toBe(401)
    expect(queries).toHaveLength(0)

    tokenValid = true
    const denied = makeReply()
    await getLogMetrics({ query: {} } as any, denied as any)
    expect(denied.statusCode).toBe(403)
    expect(queries).toHaveLength(0)

    accessValid = true
    const allowed = makeReply()
    await getLogMetrics({ query: {} } as any, allowed as any)
    expect(allowed.statusCode).toBe(200)
    expect(queries.some(query => query.sql.includes('AS received'))).toBe(true)
})
