import { expect, mock, test } from 'bun:test'

const runQueries: string[] = []
const sampleQueries: string[] = []
const loadThresholds: number[] = []

mock.module('../src/utils/db.ts', () => ({
    default: async (sql: string) => { runQueries.push(sql); return { rows: [] } },
    isDatabaseLowLoad: async (maxActiveQueries: number) => { loadThresholds.push(maxActiveQueries); return true },
    tryWithDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => ({ acquired: true, result: await work() }),
    withTransaction: async <T>(work: (query: (sql: string) => Promise<unknown>) => Promise<T>) => work(async sql => {
        sampleQueries.push(sql)
        return { rows: [] }
    }),
}))

mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: true }), HANASAND_ORGANIZATION_ID: 'test-org' }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true }) }))

const { startLogTuningSnapshotRefresh } = await import('../src/handlers/logs/tuning.ts')

test('refresh uses a fast 1% event sample with valid normalized fields under ordinary DB load', async () => {
    const stop = startLogTuningSnapshotRefresh({ warn: () => {} })
    try {
        for (let i = 0; i < 20 && !sampleQueries.some(sql => sql.includes('TABLESAMPLE SYSTEM')); i++) {
            await new Promise(resolve => setTimeout(resolve, 5))
        }
    } finally {
        stop()
    }

    expect(loadThresholds).toContain(12)
    const query = sampleQueries.find(sql => sql.includes('TABLESAMPLE SYSTEM'))
    expect(query).toBeDefined()
    expect(query).toContain('TABLESAMPLE SYSTEM (1.0)')
    expect(query).toContain('normalized->>\'message\'')
    expect(query).toContain('normalized->>\'ip\'')
    expect(query).toContain('normalized->>\'user_agent\'')
    expect(query).toContain('MAX(event_timestamp)')
    expect(runQueries.some(sql => sql.includes('INSERT INTO log_tuning_snapshots'))).toBe(true)
})
