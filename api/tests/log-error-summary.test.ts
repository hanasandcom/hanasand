import { expect, test } from 'bun:test'
import type { queryOnce, withTransaction } from '../src/utils/db.ts'
import { createErrorSummaryReader } from '../src/handlers/logs/errorSummary.ts'

function transaction(work: (sql: string, params?: unknown[]) => unknown) {
    return (async callback => callback((async (sql: string, params?: unknown[]) => work(sql, params)) as unknown as typeof queryOnce)) as typeof withTransaction
}

test('historical error summaries preserve exact source predicates, probe scope and checked snapshots', async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = []
    const read = createErrorSummaryReader(transaction((sql, params) => { calls.push({ sql, params }); return { rows: [{ total: 0 }] } }), () => Date.parse('2026-10-23T10:00:00Z'))
    const value = await read(false)
    expect(value.summary).toEqual({ total: 0 })
    expect(value.summary_available).toBe(true)
    expect(value.summary_checked_at).toBe('2026-10-23T10:00:00.000Z')
    expect(calls[0].sql).toBe('SET TRANSACTION READ ONLY')
    expect(calls[1].sql).toContain('statement_timeout = \'750ms\'')
    expect(calls[1].sql).toContain('lock_timeout = \'100ms\'')
    expect(calls[1].sql).toContain('max_parallel_workers_per_gather = 0')
    const query = calls[2]
    expect(query.params).toEqual([false])
    expect(query.sql).toContain('ingestion_id=\'logs\' AND processing_status=\'processed\'')
    expect(query.sql).toContain('FROM login_events')
    expect(query.sql).toContain('FROM traffic_events')
    expect(query.sql).toContain('http_response_error')
    expect(query.sql).toContain('hanasand_internal')
    expect(query.sql).not.toContain('event_timestamp >=')
    expect(await read(false)).toBe(value)
    expect(calls).toHaveLength(3)
    await read(true)
    expect(calls[5].params).toEqual([true])
})

test('cancelled historical summaries remain unavailable and cached without blocking recent records', async () => {
    let now = Date.parse('2026-10-23T10:00:00Z'), count = 0
    const read = createErrorSummaryReader(transaction(sql => {
        if (sql.startsWith('SET ')) return { rows: [] }
        if (++count === 1) throw Object.assign(new Error('synthetic timeout'), { code: '57014' })
        return { rows: [{ total: 7 }] }
    }), () => now)
    const first = await read(false)
    expect(first.summary).toBeNull()
    expect(first.summary_available).toBe(false)
    expect(first.summary_warning).toContain('Recent error records are still available')
    expect(await read(false)).toBe(first)
    expect(count).toBe(1)
    now += 30_001
    expect((await read(false)).summary?.total).toBe(7)
    expect(count).toBe(2)
})

test('only known cancellation and connection pressure are optional failures', async () => {
    for (const code of ['55P03', 'DB_QUEUE_FULL', 'ECONNRESET']) {
        const read = createErrorSummaryReader(transaction(() => { throw Object.assign(new Error('synthetic pressure'), { code }) }))
        expect((await read(false)).summary).toBeNull()
    }
    for (const code of ['28P01', '42P01']) {
        const failure = Object.assign(new Error('synthetic unexpected'), { code })
        await expect(createErrorSummaryReader(transaction(() => { throw failure }))(false)).rejects.toBe(failure)
    }
    await expect(createErrorSummaryReader(transaction(() => ({ rows: [] })))(false)).rejects.toThrow('Invalid historical')
})
