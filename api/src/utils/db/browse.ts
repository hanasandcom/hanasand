import { BSON } from 'mongodb'
import { readDatabaseStorage, readRedisWrites } from './storage.ts'
import type { BrowseInput } from './browseTypes.ts'
import { connect } from './browseConnection.ts'
import { browseHeap, decodeCursor, encode, normalizeLegacyEventRows, quote, scanFive } from './browseCursor.ts'

export type { BrowseInput } from './browseTypes.ts'
export { decodeCursor, normalizeLegacyEventRows } from './browseCursor.ts'

export async function browseDatabase(input: BrowseInput) {
    const started = performance.now()
    const inventory = await readDatabaseStorage()
    const instance = inventory?.instances.find(item => item.id === input.instance)
    const database = instance?.databases.find(item => item.name === input.database)
    if (!instance || !database || inventory?.stale) throw new Error('Database inventory unavailable')
    const cursor = decodeCursor(input)
    if (input.mode === 'contents' && instance.engine !== 'Redis') {
        if (!database.tables) throw new Error('Table inventory unavailable')
        return { items: database.tables, nextCursor: null, elapsedMs: performance.now() - started }
    }
    const connection = await connect(input, instance.engine)
    if (connection.pg) {
        const table = database.tables?.find(item => item.name === input.table && item.schema === input.schema)
        if (!table) throw new Error('Unknown table')
        const name = `${quote(table.schema)}.${quote(table.name)}`
        if (input.mode === 'count') {
            // Retain the connection's short statement timeout for large tables.
            const totalRows = await connection.pg.query(`SELECT count(*) AS count FROM ${name}`)
                .then(result => Number(result.rows[0].count)).catch(() => null)
            return { totalRows, nextCursor: null, elapsedMs: performance.now() - started }
        }
        const primary = await connection.pg.query<{ name: string }>('SELECT a.attname AS name FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) WHERE i.indrelid=$1::regclass AND i.indisprimary ORDER BY array_position(i.indkey,a.attnum)', [name])
        const keys = primary.rows.map(row => row.name)
        if (!keys.length) {
            const result = await browseHeap(connection.pg, input, cursor, name, table.columns, started)
            if ('rows' in result) result.rows = normalizeLegacyEventRows(result.rows, table.columns)
            return result
        }
        // A physical cursor avoids growing OFFSET scans for tables without a key.
        // Qualify keys so ORDER BY uses indexed source values, not the text
        // aliases in the preview projection (which would sort the whole table).
        const order = keys.map(key => `preview_row.${quote(key)}`)
        const values = cursor.values || []
        if (values.length && values.length !== order.length) throw new Error('Invalid cursor')
        const columns = table.columns.map(column => `left(${quote(column)}::text,16384) AS ${quote(column)}`).join(',')
        const keyProjection = keys.length ? `json_build_array(${keys.map(key => `${quote(key)}::text`).join(',')})` : 'json_build_array(tableoid::text,ctid::text)'
        const where = values.length ? `WHERE (${order.join(',')}) > (${order.map((_, index) => `$${index + 1}${keys.length ? '' : index === 0 ? '::oid' : '::tid'}`).join(',')})` : ''
        let cursorColumn = '__preview_cursor'
        while (table.columns.includes(cursorColumn)) cursorColumn += '_'
        const result = await connection.pg.query(`SELECT ${columns ? `${columns},` : ''} ${keyProjection} AS ${quote(cursorColumn)} FROM ${name} AS preview_row ${where} ORDER BY ${order.join(',')} LIMIT 6`, values)
        const rows = result.rows.slice(0, 5)
        const nextCursor = result.rows.length > 5 ? encode({ ...cursor, values: rows.at(-1)![cursorColumn] }) : null
        for (const row of rows) delete row[cursorColumn]
        return { rows: normalizeLegacyEventRows(rows, table.columns), fields: table.columns, nextCursor, elapsedMs: performance.now() - started }
    }
    if (connection.mongo) {
        if (!database.tables?.some(item => item.name === input.table)) throw new Error('Unknown collection')
        if (input.mode === 'count') {
            const totalRows = await connection.mongo.db(input.database).collection(input.table!).countDocuments({}, { maxTimeMS: 2000 }).catch(() => null)
            return { totalRows, nextCursor: null, elapsedMs: performance.now() - started }
        }
        const after = cursor.values?.[0]
        const documents = await connection.mongo.db(input.database).collection(input.table!).find(after === undefined ? {} : { _id: { $gt: BSON.EJSON.deserialize(after as Record<string, unknown>) } }, { maxTimeMS: 2000 }).sort({ _id: 1 }).limit(6).toArray()
        const rows = documents.slice(0, 5).map(document => BSON.EJSON.serialize(document, { relaxed: true }))
        return { rows, fields: [...new Set(rows.flatMap(row => Object.keys(row)))], nextCursor: documents.length > 5 ? encode({ ...cursor, values: [BSON.EJSON.serialize(documents[4]._id, { relaxed: false })] }) : null, elapsedMs: performance.now() - started }
    }
    const redis = connection.redis!
    if (input.mode === 'contents') {
        const page = await scanFive(redis, ['SCAN'], cursor)
        const writes = await readRedisWrites()
        const items = await Promise.all(page.values.map(async value => {
            const at = writes[JSON.stringify([input.instance, input.database, String(value)])]
            return { name: String(value), schema: '', columns: [], lastWriteObservedAt: at ? new Date(at * 1000).toISOString() : null,
                sizeBytes: Number(await redis.sendCommand(['MEMORY', 'USAGE', String(value)])), type: await redis.type(String(value)) }
        }))
        return { items, nextCursor: page.nextCursor, elapsedMs: performance.now() - started }
    }
    const key = input.table
    if (!key) throw new Error('Key required')
    const type = await redis.type(key)
    if (input.mode === 'count') {
        const command = ({ list: 'LLEN', zset: 'ZCARD', hash: 'HLEN', set: 'SCARD', stream: 'XLEN' } as Record<string, string>)[type]
        const totalRows = command ? Number(await redis.sendCommand([command, key])) : type === 'string' ? 1 : type === 'none' ? 0 : null
        return { totalRows, nextCursor: null, elapsedMs: performance.now() - started }
    }
    let rows: Record<string, unknown>[] = [], nextCursor: string | null = null
    const offset = cursor.offset || 0
    if (type === 'string') rows = [{ value: await redis.getRange(key, 0, 16383) }]
    else if (type === 'list' || type === 'zset') {
        const values = await redis.sendCommand([type === 'list' ? 'LRANGE' : 'ZRANGE', key, String(offset), String(offset + 5)]) as string[]
        rows = values.slice(0, 5).map((value, index) => ({ index: offset + index, value }))
        nextCursor = values.length > 5 ? encode({ ...cursor, offset: offset + 5 }) : null
    } else if (type === 'hash' || type === 'set') {
        const page = await scanFive(redis, [type === 'hash' ? 'HSCAN' : 'SSCAN', key], cursor, type === 'hash')
        rows = page.values.map(value => type === 'hash' ? { field: (value as string[])[0], value: (value as string[])[1] } : { value })
        nextCursor = page.nextCursor
    } else if (type === 'stream') {
        const values = await redis.sendCommand(['XRANGE', key, cursor.values?.[0] ? `(${cursor.values[0]}` : '-', '+', 'COUNT', '6']) as Array<[string, string[]]>
        rows = values.slice(0, 5).map(([id, fields]) => ({ id, fields: Object.fromEntries(fields.reduce<Array<[string, string]>>((pairs, value, index) => index % 2 ? pairs : [...pairs, [value, fields[index + 1]]], [])) }))
        nextCursor = values.length > 5 ? encode({ ...cursor, values: [values[4][0]] }) : null
    } else if (type !== 'none') throw new Error('Unsupported Redis value type')
    return { rows, fields: [...new Set(rows.flatMap(row => Object.keys(row)))], nextCursor, elapsedMs: performance.now() - started }
}
