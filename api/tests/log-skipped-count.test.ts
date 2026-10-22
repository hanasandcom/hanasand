import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import type { queryOnce, withTransaction } from '../src/utils/db.ts'
import { createSkippedCountReader } from '../src/utils/logs/skippedCount.ts'

function transaction(work: (sql: string) => unknown) {
    return (async callback => callback((async (sql: string) => work(sql)) as unknown as typeof queryOnce)) as typeof withTransaction
}

test('exact skipped counts including zero are bounded, timestamped and cached', async () => {
    const calls: string[] = []
    let now = Date.parse('2026-10-23T10:00:00Z')
    const read = createSkippedCountReader(transaction(sql => { calls.push(sql); return { rows: [{ count: 0 }] } }), () => now)
    const first = await read()
    expect(first).toEqual({ skipped_events: 0, skipped_events_available: true, skipped_events_checked_at: new Date(now).toISOString() })
    expect(calls[0]).toBe('SET LOCAL statement_timeout = \'750ms\'')
    expect(calls[1]).toContain('WHERE ingestion_id = \'logs\' AND processing_status = \'skipped\'')
    expect(await read()).toBe(first)
    expect(calls).toHaveLength(2)
    now += 30_001
    expect((await read()).skipped_events_checked_at).toBe(new Date(now).toISOString())
    expect(calls).toHaveLength(4)
})

test('a cancelled optional count is unknown with a warning, throttles retries and can recover', async () => {
    let now = Date.parse('2026-10-23T10:00:00Z'), attempts = 0
    const read = createSkippedCountReader(transaction(sql => {
        if (sql.startsWith('SET ')) return { rows: [] }
        if (++attempts === 1) throw Object.assign(new Error('synthetic timeout'), { code: '57014' })
        return { rows: [{ count: 9 }] }
    }), () => now)
    const failed = await read()
    expect(failed.skipped_events).toBeNull()
    expect(failed.skipped_events_available).toBe(false)
    expect(failed.skipped_events_warning).toContain('temporarily unavailable')
    expect(await read()).toBe(failed)
    expect(attempts).toBe(1)
    now += 30_001
    expect((await read()).skipped_events).toBe(9)
    expect(attempts).toBe(2)
})

test('unexpected authorization, schema and malformed results are not hidden', async () => {
    for (const code of ['28P01', '42P01']) {
        const failure = Object.assign(new Error('synthetic failure'), { code })
        await expect(createSkippedCountReader(transaction(() => { throw failure }))()).rejects.toBe(failure)
    }
    for (const count of [undefined, null, -1, '0', 1.5]) {
        await expect(createSkippedCountReader(transaction(() => ({ rows: [{ count }] })))()).rejects.toThrow('Invalid excluded')
    }
})

test('concurrent readers share only one bounded transaction', async () => {
    let calls = 0
    let finish!: () => void
    const ready = new Promise<void>(resolve => { finish = resolve })
    const read = createSkippedCountReader(transaction(async () => { calls++; await ready; return { rows: [{ count: 2 }] } }))
    const first = read(), second = read()
    expect(first).toBe(second)
    finish()
    expect((await first).skipped_events).toBe(2)
    expect(calls).toBe(2)
})

test('the historical count runs after the main transaction and surfaces an explicit native warning', () => {
    const source = readFileSync(new URL('../src/handlers/logs/search.ts', import.meta.url), 'utf8')
    expect(source).not.toContain('AS skipped_events FROM log_processing_cursors')
    expect(source.indexOf('const skipped =')).toBeGreaterThan(source.indexOf('}, ...counts }'))
    expect(source).toContain('result.processing ? await readSkippedLogCount() : undefined')
    expect(source).toContain('warnings: [skipped.skipped_events_warning]')
})
