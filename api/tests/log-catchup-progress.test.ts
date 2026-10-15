import { beforeEach, expect, mock, test } from 'bun:test'

let previous: Record<string, unknown>
let sourceRemaining = 0
let oldestPending = null as string | null
let sampledQueries: string[] = []
const updates: unknown[][] = []
const query = async (sql: string, params: unknown[] = []) => {
    sampledQueries.push(sql)
    if (sql.startsWith('SET LOCAL')) return { rows: [] }
    if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ locked: true }] }
    if (sql.includes('SELECT * FROM log_catchup_progress')) return { rows: [previous] }
    if (sql.includes('WITH remaining AS')) return { rows: [{ remaining: sourceRemaining, oldest_received_at: oldestPending }] }
    if (sql.includes('UPDATE log_catchup_progress SET payload=')) { updates.push(params); return { rows: [] } }
    throw new Error(`Unexpected query: ${sql}`)
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: typeof query) => work(query) }))
const { catchupSample, refreshLogCatchupProgress } = await import('../src/utils/events/catchupProgress.ts')

beforeEach(() => {
    previous = { payload: {}, checked_count: 0, sampled_at: null, attempted_at: null }
    sourceRemaining = 0
    oldestPending = null
    sampledQueries = []
    updates.length = 0
})

test('catch-up starts with an exact remaining count and no invented ETA', () => {
    expect(catchupSample(4000, { payload: {}, sampled_at: null }, new Date('2026-09-19T12:00:00Z'))).toMatchObject({ remaining: 4000, processed: 0, total: 4000, rate: null, estimated_seconds: null })
})
test('durable backlog progress measures drain across worker restarts', () => {
    const first = catchupSample(4000, { payload: {}, sampled_at: null }, new Date('2026-09-19T12:00:00Z'))
    const second = catchupSample(3000, { payload: first, sampled_at: first.updated_at }, new Date('2026-09-19T12:01:00Z'))
    expect(second).toMatchObject({ remaining: 3000, processed: 1000, total: 4000, estimated_seconds: 180 })
    expect(second.rate).toBeCloseTo(1000 / 60)
    const paused = catchupSample(3000, { payload: second, sampled_at: second.updated_at }, new Date('2026-09-19T12:02:00Z'))
    expect(paused).toMatchObject({ rate: null, estimated_seconds: null, processed: 1000 })
})
test('retention and new arrivals change remaining counts without fabricating processing speed', () => {
    const previous = { payload: { processed: 50 }, sampled_at: '2026-09-19T12:00:00Z' }
    expect(catchupSample(10, previous, new Date('2026-09-19T12:01:00Z'))).toMatchObject({ processed: 50, total: 60, estimated_seconds: null })
    expect(catchupSample(0, previous, new Date('2026-09-19T12:01:00Z'))).toMatchObject({ estimated_seconds: 0, remaining: 0 })
})

test('new arrivals offset completion so rate reports net backlog drain', () => {
    const previous = { payload: { remaining: 100, processed: 50, rate: 2 }, sampled_at: '2026-09-19T12:00:00Z' }
    expect(catchupSample(130, previous, new Date('2026-09-19T12:01:00Z'))).toMatchObject({
        remaining: 130, processed: 50, total: 180, rate: null, estimated_seconds: null,
    })
})

test('overlapping arrivals and processing estimate only the net backlog drain', () => {
    const previous = { payload: { remaining: 100, processed: 50 }, sampled_at: '2026-09-19T12:00:00Z' }
    const next = catchupSample(80, previous, new Date('2026-09-19T12:01:00Z'))
    expect(next).toMatchObject({ remaining: 80, processed: 70, total: 150, estimated_seconds: 240 })
    expect(next.rate).toBeCloseTo(20 / 60)
})

test('worker persists source-cursor backlog plus pending Events', async () => {
    const sampledAt = new Date(Date.now() - 60_000).toISOString()
    previous = { payload: { remaining: 500, processed: 100, rate: 5 }, checked_count: 500, sampled_at: sampledAt, attempted_at: sampledAt }
    // This fixture has source history to process, even though the direct
    // pending Events table is empty. Source-origin pending Events are counted
    // by the same effective backlog aggregate and are deduplicated by key.
    sourceRemaining = 3
    oldestPending = null

    await refreshLogCatchupProgress()

    expect(updates).toHaveLength(1)
    const [serialized] = updates[0]
    expect(JSON.parse(String(serialized))).toMatchObject({
        remaining: 3,
        processed: 597,
        total: 600,
        oldest_received_at: null,
    })
    expect(JSON.parse(String(serialized)).rate).toBeGreaterThan(5)
    const sourceCount = sampledQueries.find(sql => sql.includes('WITH remaining AS'))
    expect(sourceCount).toContain('FROM login_events')
    expect(sourceCount).toContain('FROM traffic_events')
    expect(sourceCount).toContain('FROM system_events')
    expect(sourceCount).toContain('LEFT JOIN log_processing_cursors')
    expect(sourceCount).toContain('\'{metadata,origin,table}\'')
    expect(sourceCount).not.toContain('service_logs')
})
