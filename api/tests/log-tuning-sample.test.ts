import { expect, mock, test } from 'bun:test'

const runQueries: string[] = []
const sampleQueries: string[] = []
let activeQueriesDuringSample = 0
const concurrentQueryCounts: number[] = []

mock.module('../src/utils/db.ts', () => ({
    default: async (sql: string) => { runQueries.push(sql); return { rows: [] } },
    withTransaction: async <T>(work: (query: (sql: string) => Promise<unknown>) => Promise<T>) => {
        // Represent unrelated application queries that remain active while the sample runs.
        activeQueriesDuringSample = 3
        try {
            return await work(async sql => {
                sampleQueries.push(sql)
                concurrentQueryCounts.push(activeQueriesDuringSample)
                return { rows: [] }
            })
        } finally {
            activeQueriesDuringSample = 0
        }
    },
}))

mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: true }), HANASAND_ORGANIZATION_ID: 'test-org' }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true }) }))

const { startLogTuningSnapshotRefresh } = await import('../src/handlers/logs/tuning.ts')

test('refresh runs a fast 1% event sample while unrelated database queries are active', async () => {
    const stop = startLogTuningSnapshotRefresh({ warn: () => {} })
    try {
        for (let i = 0; i < 20 && !sampleQueries.some(sql => sql.includes('TABLESAMPLE SYSTEM')); i++) {
            await new Promise(resolve => setTimeout(resolve, 5))
        }
    } finally {
        stop()
    }

    expect(concurrentQueryCounts.some(count => count > 0)).toBe(true)
    const query = sampleQueries.find(sql => sql.includes('TABLESAMPLE SYSTEM'))
    expect(query).toBeDefined()
    expect(query).toContain('TABLESAMPLE SYSTEM (1.0)')
    expect(query).toContain('normalized->>\'message\'')
    expect(query).toContain('normalized->>\'ip\'')
    expect(query).toContain('normalized->>\'user_agent\'')
    expect(query).toContain('MAX(event_timestamp)')
    expect(runQueries.some(sql => sql.includes('INSERT INTO log_tuning_snapshots'))).toBe(true)
})
