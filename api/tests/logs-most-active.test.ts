import { expect, mock, test } from 'bun:test'

type SummaryRow = { kind: string, name: string, count: number | string }

const cacheCalls: Array<{ key: string, ttl: number }> = []
const queries: string[] = []
let transactions = 0

const recentRows: SummaryRow[] = [
    { kind: 'service', name: 'zulu', count: '20' },
    { kind: 'service', name: 'charlie', count: 5 },
    { kind: 'service', name: 'alpha', count: '5' },
    { kind: 'service', name: 'beta', count: 5 },
    ...['delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo'].map(name => ({ kind: 'service', name, count: 1 })),
    { kind: 'severity', name: 'low', count: '2' },
    { kind: 'severity', name: 'medium', count: 4 },
    { kind: 'severity', name: 'critical', count: 7 },
    { kind: 'severity', name: 'unclassified', count: 999 },
]
const totalRows: SummaryRow[] = [
    { kind: 'service', name: 'archive', count: 3 },
    { kind: 'severity', name: 'high', count: '6' },
    { kind: 'severity', name: 'unclassified', count: 200 },
]

const query = async (sql: string) => {
    queries.push(sql)
    if (sql.startsWith('SET LOCAL')) return { rows: [] }
    return { rows: sql.includes('event_timestamp >= NOW() - INTERVAL \'24 hours\'') ? recentRows : totalRows }
}

mock.module('#db', () => ({
    default: query,
    identityQueryOnce: query,
    withTransaction: async (work: (query: typeof query) => Promise<unknown>) => {
        transactions++
        return work(query)
    },
}))
mock.module('#utils/logs/cache.ts', () => ({
    cachedLogQuery: (key: string, ttl: number, load: () => Promise<unknown>) => {
        cacheCalls.push({ key, ttl })
        return load()
    },
}))

const { loadCachedMostActiveServices } = await import('../src/handlers/logs/mostActive.ts')

test('loads independent recent and total summaries with top services and known severities', async () => {
    const result = await loadCachedMostActiveServices()

    expect(cacheCalls).toEqual([
        { key: 'most-active-services:24h', ttl: 30_000 },
        { key: 'most-active-services:total', ttl: 240_000 },
    ])
    expect(transactions).toBe(2)
    expect(queries.filter(sql => sql.startsWith('SET LOCAL statement_timeout'))).toHaveLength(2)
    const recentQuery = queries.find(sql => sql.includes('event_timestamp >= NOW() - INTERVAL \'24 hours\''))
    const totalQuery = queries.find(sql => sql.includes('bucket_seconds = 86400') && !sql.includes('event_timestamp >= NOW() - INTERVAL \'24 hours\''))
    expect(recentQuery).toContain('date_trunc(\'minute\'')
    expect(recentQuery).toContain('organization_id = ANY(ARRAY(SELECT o.id FROM organizations o WHERE o.status = \'active\'))')
    expect(totalQuery).toContain('bucket_seconds = 86400')
    expect(totalQuery).toContain('organization_id = ANY(ARRAY(SELECT o.id FROM organizations o WHERE o.status = \'active\'))')

    expect(result.last_24h.services).toEqual([
        { service: 'zulu', count: 20 },
        { service: 'alpha', count: 5 },
        { service: 'beta', count: 5 },
        { service: 'charlie', count: 5 },
        { service: 'delta', count: 1 },
        { service: 'echo', count: 1 },
        { service: 'foxtrot', count: 1 },
        { service: 'golf', count: 1 },
        { service: 'hotel', count: 1 },
        { service: 'india', count: 1 },
    ])
    expect(result.last_24h.severities).toEqual({ low: 2, medium: 4, high: 0, critical: 7 })
    expect(result.total).toEqual({
        services: [{ service: 'archive', count: 3 }],
        severities: { low: 0, medium: 0, high: 6, critical: 0 },
    })
})
