import { createHash } from 'node:crypto'
import type { queryOnce } from '#db'

type Input = { where: string[], params: NonNullable<Parameters<typeof queryOnce>[1]>, order: string, limit: number, cursor?: string, recentFirst?: boolean, preferTextIndex?: boolean }
type Cursor = { time: string, id: string, until: string, scope: string }

export async function searchLogPage(query: typeof queryOnce, input: Input) {
    const scope = createHash('sha256').update(JSON.stringify([input.where, input.params, input.order])).digest('hex')
    let cursor: Cursor | undefined
    if (input.cursor) {
        try {
            if (input.cursor.length > 2048) throw new Error()
            cursor = JSON.parse(Buffer.from(input.cursor, 'base64url').toString())
            if (!cursor || cursor.scope !== scope || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 200
                || typeof cursor.time !== 'string' || !Number.isFinite(Date.parse(cursor.time))
                || typeof cursor.until !== 'string' || !Number.isFinite(Date.parse(cursor.until))) throw new Error()
        } catch { throw new Error('Invalid search cursor. Start the search again.') }
    }
    const params = [...input.params]
    const bind = (value: string) => { params.push(value); return `$${params.length}` }
    const until = cursor?.until || new Date().toISOString()
    const snapshot = bind(until) + '::timestamptz'
    // Keep the time window fixed across pages, including microsecond sort keys.
    const where = input.where.map(clause => clause.replaceAll('NOW()', snapshot))
    where.push(`event_timestamp <= ${snapshot}`)
    if (cursor) where.push(`(event_timestamp, id) < (${bind(cursor.time)}::timestamptz, ${bind(cursor.id)}::text)`)
    const select = (clauses: string[]) => `SELECT id, normalized, event_timestamp, organization_id, event_timestamp::text AS cursor_time FROM events WHERE ${clauses.join(' AND ')} ORDER BY ${input.order} LIMIT ${input.limit + 1}`
    // Read disjoint recent windows in descending time order. Once we have a
    // full page, no older window can change which events belong on that page.
    // This avoids sorting a million trigram matches just to return 200 rows.
    let result: Awaited<ReturnType<typeof query>> | undefined
    if (input.recentFirst) {
        const windows = [15, 45, 3 * 60, 12 * 60, 24 * 60, 32 * 60].map(minutes => minutes * 60_000)
        let segmentEnd = Date.parse(cursor?.time || until)
        let firstSegment = true
        const matches: Awaited<ReturnType<typeof query>>['rows'] = []
        for (const duration of windows) {
            const segmentStart = segmentEnd - duration
            const endParameter = `$${params.length + 1}`
            const startParameter = `$${params.length + 2}`
            const endClause = firstSegment ? `event_timestamp <= ${endParameter}::timestamptz` : `event_timestamp < ${endParameter}::timestamptz`
            const segment = await query(select([...where, endClause, `event_timestamp >= ${startParameter}::timestamptz`]),
                [...params, firstSegment ? cursor?.time || until : new Date(segmentEnd).toISOString(), new Date(segmentStart).toISOString()])
            firstSegment = false
            matches.push(...segment.rows)
            if (matches.length >= input.limit + 1) {
                result = { ...segment, rows: matches.slice(0, input.limit + 1) }
                break
            }
            segmentEnd = segmentStart
        }
    }
    if (!result || result.rows.length < input.limit + 1) {
        // A sparse long phrase can have its newest match well behind the
        // timestamp cursor. Prefer the trigram bitmap index for that fallback
        // instead of walking the entire type/time index and testing every row.
        const useTextIndex = input.preferTextIndex && !cursor
        if (useTextIndex) await query('SET LOCAL enable_indexscan = off')
        result = await query(select(where), params)
        if (useTextIndex) await query('SET LOCAL enable_indexscan = DEFAULT')
    }
    const page = result.rows.slice(0, input.limit)
    const last = page.at(-1)
    const next = result.rows.length > input.limit && last
        ? Buffer.from(JSON.stringify({ time: last.cursor_time, id: last.id, until, scope })).toString('base64url') : null
    return { rows: page.map(({ id, normalized, event_timestamp, organization_id }) => ({ id, normalized, event_timestamp, organization_id })), next_cursor: next }
}
