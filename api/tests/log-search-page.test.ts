import { expect, test } from 'bun:test'
import type { queryOnce } from '../src/utils/db.ts'
import { searchLogPage } from '../src/utils/logs/searchPage.ts'

const input = { where: ['ingestion_id = \'logs\'', 'processing_status = \'processed\'', 'event_timestamp >= NOW() - $1 * INTERVAL \'1 hour\'', 'strpos(lower(normalized::text), lower($2)) > 0', 'EXISTS (SELECT 1 FROM organizations o WHERE o.id = events.organization_id AND o.status = \'active\')'], params: [24, 'docker logs'], order: 'event_timestamp DESC, id DESC', limit: 2 }
test('pages preserve full filters and let cursor pages use a different size', async () => {
    const calls: Array<{ sql: string, params: unknown[] }> = []
    const rows = ['c', 'b', 'a'].map(id => ({ id, normalized: {}, cursor_time: '2026-09-20 00:00:00.123456+00' }))
    const query = (async (sql: string, params: unknown[]) => { calls.push({ sql, params }); return { rows: calls.length === 1 ? rows : [rows[2]] } }) as unknown as typeof queryOnce
    const first = await searchLogPage(query, input)
    expect(first.rows.map(row => row.id)).toEqual(['c', 'b'])
    expect(first.rows[0]).not.toHaveProperty('cursor_time')
    expect(first.next_cursor).toBeString()
    const second = await searchLogPage(query, { ...input, limit: 1, cursor: first.next_cursor! })
    expect(second.rows.map(row => row.id)).toEqual(['a'])
    expect(second.next_cursor).toBeNull()
    expect(calls[1].params).toEqual([24, 'docker logs', calls[0].params[2], '2026-09-20 00:00:00.123456+00', 'b'])
    for (const { sql } of calls) {
        expect(sql).toContain('o.status = \'active\'')
        expect(sql).toContain('strpos(lower(normalized::text), lower($2)) > 0')
        expect(sql).toContain('event_timestamp >= $3::timestamptz - $1 * INTERVAL \'1 hour\'')
    }
    expect(calls[0].sql).toEndWith('ORDER BY event_timestamp DESC, id DESC LIMIT 3')
    expect(calls[1].sql).toEndWith('ORDER BY event_timestamp DESC, id DESC LIMIT 2')
    expect(calls[1].sql).toContain('(event_timestamp, id) < ($4::timestamptz, $5::text)')
})
test('malformed and different-search cursors fail before any query', async () => {
    let calls = 0
    const query = (async () => { calls++; return { rows: [] } }) as unknown as typeof queryOnce
    for (const cursor of ['!', 'a'.repeat(2049), Buffer.from(JSON.stringify({ scope: 'other', time: 'bad', id: 'b' })).toString('base64url')]) {
        await expect(searchLogPage(query, { ...input, cursor })).rejects.toThrow('Invalid search cursor')
    }
    expect(calls).toBe(0)
    expect((await searchLogPage(query, input)).next_cursor).toBeNull()
})
test('a complete recent page avoids scanning older matches and preserves the cursor', async () => {
    const calls: Array<{ sql: string, params: unknown[] }> = []
    const rows = ['c', 'b', 'a'].map(id => ({ id, normalized: {}, cursor_time: '2026-09-20 00:00:00.123456+00' }))
    const query = (async (sql: string, params: unknown[]) => { calls.push({ sql, params }); return { rows: sql.startsWith('SELECT') ? rows : [] } }) as unknown as typeof queryOnce
    const first = await searchLogPage(query, { ...input, recentFirst: true })
    expect(calls).toHaveLength(3)
    expect(calls[0].sql).toBe('SET LOCAL enable_bitmapscan = off')
    expect(calls[1].sql).toStartWith('SELECT')
    expect(calls[2].sql).toBe('SET LOCAL enable_bitmapscan = DEFAULT')
    expect(first.rows.map(row => row.id)).toEqual(['c', 'b'])
    expect(first.next_cursor).toBeString()
    expect(calls[1].sql).toContain('o.status = \'active\'')
    expect(calls[1].sql).toContain('event_timestamp <= $4::timestamptz')
    expect(calls[1].sql).toContain('event_timestamp >= $5::timestamptz')
    expect(Date.parse(calls[1].params[2] as string) - Date.parse(calls[1].params[4] as string)).toBe(900_000)
    await searchLogPage(query, { ...input, recentFirst: true, cursor: first.next_cursor! })
    expect(calls[4].sql).toContain('(event_timestamp, id) < ($4::timestamptz, $5::text)')
    expect(calls[4].sql).toContain('event_timestamp <= $6::timestamptz')
    expect(calls[4].params[5]).toBe('2026-09-20 00:00:00.123456+00')
})
test('sparse recent windows fall back to the entire original range', async () => {
    for (const recent of [[], [{ id: 'c' }], [{ id: 'c' }, { id: 'b' }]]) {
        const calls: Array<{ sql: string, params: unknown[] }> = []
        const query = (async (sql: string, params: unknown[]) => {
            calls.push({ sql, params })
            return { rows: sql.startsWith('SELECT') && !sql.includes('event_timestamp >= $5::timestamptz')
                ? [{ id: 'c' }, { id: 'b' }, { id: 'older', cursor_time: '2026-09-19 12:00:00+00' }]
                : sql.startsWith('SELECT') && calls.filter(call => call.sql.startsWith('SELECT')).length === 1 ? recent : [] }
        }) as unknown as typeof queryOnce
        const result = await searchLogPage(query, { ...input, recentFirst: true })
        const selects = calls.filter(({ sql }) => sql.startsWith('SELECT'))
        expect(selects).toHaveLength(7)
        expect(selects[6].sql).not.toContain('event_timestamp >= $5::timestamptz')
        expect(selects[6].sql).toContain('event_timestamp >= $3::timestamptz - $1 * INTERVAL \'1 hour\'')
        expect(calls.map(({ sql }) => sql)).toContain('SET LOCAL enable_bitmapscan = DEFAULT')
        expect(result.rows.map(row => row.id)).toEqual(['c', 'b'])
        expect(result.next_cursor).toBeString()
    }
})
test('searches expand through disjoint recent windows and stop once they find a full page', async () => {
    const calls: Array<{ sql: string, params: unknown[] }> = []
    const rows = ['c', 'b', 'a'].map(id => ({ id, normalized: {}, cursor_time: '2026-09-19 12:00:00+00' }))
    let selectCount = 0
    const query = (async (sql: string, params: unknown[]) => {
        calls.push({ sql, params })
        if (sql.startsWith('SELECT')) selectCount++
        return { rows: sql.startsWith('SELECT') && selectCount === 6 ? rows : [] }
    }) as unknown as typeof queryOnce
    const result = await searchLogPage(query, { ...input, recentFirst: true })
    const selects = calls.filter(({ sql }) => sql.startsWith('SELECT'))
    expect(selects).toHaveLength(6)
    expect(selects[0].sql).toContain('event_timestamp <= $4::timestamptz')
    expect(selects.slice(1).every(({ sql }) => sql.includes('event_timestamp < $4::timestamptz'))).toBe(true)
    expect(selects[1].params[3]).toBe(selects[0].params[4])
    expect(result.rows.map(row => row.id)).toEqual(['c', 'b'])
    expect(result.next_cursor).toBeString()
})
test('sparse long-phrase searches use the trigram bitmap path on the historical fallback', async () => {
    const calls: string[] = []
    const query = (async (sql: string) => {
        calls.push(sql)
        return { rows: sql.startsWith('SELECT') && !sql.includes('event_timestamp >= $5::timestamptz')
            ? [{ id: 'older', cursor_time: '2026-09-19 12:00:00+00' }] : [] }
    }) as unknown as typeof queryOnce
    const result = await searchLogPage(query, { ...input, recentFirst: true, preferTextIndex: true })
    const selects = calls.filter(sql => sql.startsWith('SELECT'))
    expect(selects).toHaveLength(7)
    expect(calls).toContain('SET LOCAL enable_bitmapscan = off')
    expect(calls).toContain('SET LOCAL enable_bitmapscan = DEFAULT')
    expect(calls).toContain('SET LOCAL enable_indexscan = off')
    expect(selects[6]).not.toContain('event_timestamp <= $4::timestamptz')
    expect(calls.at(-1)).toBe('SET LOCAL enable_indexscan = DEFAULT')
    expect(result.rows.map(row => row.id)).toEqual(['older'])
})
