import { beforeEach, expect, mock, test } from 'bun:test'
let code: string | null = null, inTransaction = false, finished = false, statements: string[] = [], parameters: unknown[][] = []
mock.module('#db', () => ({ withTransaction: async (work: any) => {
    inTransaction = true
    try {
        return await work(async (sql: string, values: unknown[] = []) => {
            expect(inTransaction).toBe(true)
            statements.push(sql)
            parameters.push(values)
            if (sql.startsWith('SELECT pg_try_advisory_xact_lock')) {
                if (code === '55P03') return { rows: [{ acquired: false }] }
                return { rows: [{ acquired: true }] }
            }
            if (code) throw Object.assign(new Error('Database query failed'), { code })
            return { rows: [{ last_id: '9007199254740993' }] }
        })
    } finally { inTransaction = false; finished = true }
} }))
const { stableLogWatermark } = await import('../src/utils/events/logWatermark.ts')
beforeEach(() => { code = null; inTransaction = false; finished = false; statements = []; parameters = [] })
test('reads an exact bigint watermark after a nonblocking transaction advisory claim', async () => {
    expect(await stableLogWatermark('traffic_events')).toBe('9007199254740993')
    expect(statements).toEqual(['SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired', 'SELECT COALESCE(MAX(id), 0)::text AS last_id FROM traffic_events'])
    expect(parameters[0]).toEqual(['logs:watermark:traffic_events'])
    expect(finished).toBe(true)
    expect(inTransaction).toBe(false)
})
test('a busy watermark is skipped immediately and unrelated database failures are surfaced', async () => {
    code = '55P03'
    expect(await stableLogWatermark('service_logs')).toBeNull()
    expect(statements).toHaveLength(1)
    code = '42P01'
    await expect(stableLogWatermark('service_logs')).rejects.toThrow('Database query failed')
})
