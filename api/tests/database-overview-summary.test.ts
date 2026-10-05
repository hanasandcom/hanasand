import { expect, mock, test } from 'bun:test'

const overview = {
    storage: null,
    status: 'healthy' as const,
    generatedAt: '2026-10-05T12:00:00.000Z',
    clusterCount: 1,
    databaseCount: 2,
    totalSizeBytes: 100,
    activeQueries: 2,
    averageQuerySeconds: 1,
    longRunningThresholdSeconds: 60,
    longestQuery: { database: 'db', user: 'user', state: 'active', durationSeconds: 90, waitEventType: null, waitEvent: null, query: 'long query', isLongRunning: true },
    queries: [
        { database: 'db', user: 'user', state: 'active', durationSeconds: 90, waitEventType: null, waitEvent: null, query: 'long query', isLongRunning: true },
        { database: 'db', user: 'user', state: 'active', durationSeconds: 1, waitEventType: null, waitEvent: null, query: 'short query', isLongRunning: false },
    ],
    health: { message: 'ok' },
    clusters: [],
}

mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true }) }))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: true }) }))
mock.module('#utils/db/overview.ts', () => ({ getCachedDatabaseOverview: async () => overview }))
const getDatabaseOverview = (await import('../src/handlers/database/getOverview.ts')).default

function reply() {
    return {
        statusCode: 200,
        body: null as any,
        status(value: number) { this.statusCode = value; return this },
        send(value: any) { this.body = value; return this },
    }
}

test('summary overview omits SQL details and keeps query counts', async () => {
    const res = reply()
    await getDatabaseOverview({ query: { summary: '1' } } as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(res.body.queries).toEqual([])
    expect(res.body.longestQuery).toBeNull()
    expect(res.body.querySummary).toEqual({ count: 2, longRunningCount: 1, longestDurationSeconds: 90 })
})

test('full overview remains available to query detail consumers', async () => {
    const res = reply()
    await getDatabaseOverview({ query: {} } as any, res as any)
    expect(res.body.queries).toHaveLength(2)
    expect(res.body.longestQuery.query).toBe('long query')
})
