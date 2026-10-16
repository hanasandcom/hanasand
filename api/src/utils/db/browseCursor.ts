import type { Pool } from 'pg'
import type { BrowseInput, Cursor, RedisConnection } from './browseTypes.ts'

export function normalizeLegacyEventRows(rows: Record<string, unknown>[], columns: string[]) {
    if (!columns.includes('parser_version')) return rows
    return rows.map(row => row.parser_version === 'mill.v1' ? { ...row, parser_version: 'event.v1' } : row)
}

export function quote(value: string) { return `"${value.replaceAll('"', '""')}"` }

export function target(input: BrowseInput) { return JSON.stringify([input.instance, input.database, input.mode, input.schema || '', input.table || '']) }

export function decodeCursor(input: BrowseInput): Cursor {
    if (!input.cursor) return { target: target(input) }
    if (input.cursor.length > 100_000) throw new Error('Invalid cursor')
    const value = JSON.parse(Buffer.from(input.cursor, 'base64url').toString()) as Cursor
    if (value.target !== target(input) || (value.values && !Array.isArray(value.values)) || (value.index !== undefined && (!Number.isSafeInteger(value.index) || value.index < 0)) || (value.offset !== undefined && (!Number.isSafeInteger(value.offset) || value.offset < 0)) || (value.scan !== undefined && !/^\d+$/.test(value.scan))) throw new Error('Invalid cursor')
    return value
}

export function encode(value: Cursor) { return Buffer.from(JSON.stringify(value)).toString('base64url') }

export async function browseHeap(pg: Pool, input: BrowseInput, cursor: Cursor, name: string, columns: string[], started: number) {
    const leaves = await pg.query<{ oid: string, schema: string, name: string, blocks: number }>(`WITH RECURSIVE relations AS (
        SELECT $1::regclass::oid AS oid UNION ALL SELECT i.inhrelid FROM pg_inherits i JOIN relations r ON i.inhparent=r.oid
    ) SELECT c.oid::text,n.nspname AS schema,c.relname AS name,ceil(pg_relation_size(c.oid)::numeric/current_setting('block_size')::int)::int AS blocks
    FROM relations r JOIN pg_class c ON c.oid=r.oid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','m') ORDER BY c.oid`, [name])
    const values = cursor.values || []
    if (values.length && (values.length !== 2 || !/^\(\d+,\d+\)$/.test(String(values[1])) || !leaves.rows.some(row => row.oid === String(values[0])))) throw new Error('Invalid cursor')
    let index = values.length ? leaves.rows.findIndex(row => row.oid === String(values[0])) : 0
    let after = values.length ? String(values[1]) : '(0,0)'
    const rows: Record<string, unknown>[] = []
    let alias = '__preview_cursor'
    while (columns.includes(alias)) alias += '_'
    const projection = columns.map(column => `left(${quote(column)}::text,16384) AS ${quote(column)}`)
    for (let attempt = 0; index < leaves.rows.length && attempt < 8; attempt++) {
        const leaf = leaves.rows[index]
        const block = Number(after.slice(1).split(',')[0]), end = Math.min(block + 64, leaf.blocks)
        if (block >= leaf.blocks) { index++; after = '(0,0)'; continue }
        const result = await pg.query(`SELECT ${[...projection, `ctid::text AS ${quote(alias)}`].join(',')} FROM ONLY ${quote(leaf.schema)}.${quote(leaf.name)} WHERE ctid > $1::tid AND ctid < $2::tid ORDER BY ctid LIMIT $3`, [after, `(${end},0)`, 6 - rows.length])
        for (const record of result.rows) {
            if (rows.length === 5) return { rows, fields: columns, nextCursor: encode({ ...cursor, values: [leaf.oid, after] }), elapsedMs: performance.now() - started }
            after = record[alias]; delete record[alias]; rows.push(record)
        }
        after = `(${end},0)`
        if (end >= leaf.blocks) { index++; after = '(0,0)' }
    }
    return { rows, fields: columns, nextCursor: index < leaves.rows.length ? encode({ ...cursor, values: [leaves.rows[index].oid, after] }) : null, elapsedMs: performance.now() - started }
}

export async function scanFive(redis: RedisConnection, command: string[], cursor: Cursor, pairs = false) {
    let scan = cursor.scan || '0', index = cursor.index || 0
    const values: unknown[] = []
    for (let attempt = 0; attempt < 20; attempt++) {
        const [next, raw] = await redis.sendCommand([...command, scan, 'COUNT', '5']) as [string, string[]]
        const items = pairs ? raw.filter((_, i) => i % 2 === 0).map((value, i) => [value, raw[i * 2 + 1]]) : raw
        while (index < items.length && values.length < 5) values.push(items[index++])
        if (index < items.length) return { values, nextCursor: encode({ ...cursor, scan, index }) }
        if (next === '0') return { values, nextCursor: null }
        scan = next; index = 0
        if (values.length === 5) break
    }
    return { values, nextCursor: encode({ ...cursor, scan, index }) }
}
