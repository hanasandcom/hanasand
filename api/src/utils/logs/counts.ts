import type { queryOnce } from '#db'
import { dimensionLogWhere } from '#utils/logs/dimensions.ts'

// Sum complete days, hours and minutes; inspect only the partial boundary minute.
// Every bucket is maintained in the same transaction as its source records.
export function rollupLogCountsSql(where: string[], timeWhere: string) {
    const filters = where.filter(clause => clause !== timeWhere)
    if (filters.some(clause => /\bevent_timestamp\b|\bnormalized\b|\buser_id\b/.test(clause))) return null
    if (!timeWhere.startsWith('event_timestamp >= ')) return null
    const cutoff = timeWhere.slice('event_timestamp >= '.length)
    const minute = `(date_trunc('minute', ${cutoff}, 'UTC') + INTERVAL '1 minute')`
    const hour = `(date_trunc('hour', ${cutoff}, 'UTC') + INTERVAL '1 hour')`
    const day = `(date_trunc('day', ${cutoff}, 'UTC') + INTERVAL '24 hours')`
    const filter = filters.length ? ' AND ' + filters.join(' AND ') : ''
    return `SELECT severity, service, SUM(count)::int AS count FROM (
        SELECT severity,service,event_count AS count FROM log_counts events
            WHERE bucket_seconds = 86400 AND bucket >= ${day}${filter}
        UNION ALL
        SELECT severity,service,event_count AS count FROM log_counts events
            WHERE bucket_seconds = 3600 AND bucket >= ${hour} AND bucket < ${day}${filter}
        UNION ALL
        SELECT severity,service,event_count AS count FROM log_counts events
            WHERE bucket_seconds = 60 AND bucket >= ${minute} AND bucket < ${hour}${filter}
        UNION ALL
        SELECT severity,service,COUNT(*)::bigint AS count FROM log_dimensions events
            WHERE ${timeWhere} AND event_timestamp < ${minute}${filter} GROUP BY 1, 2
    ) counts GROUP BY 1, 2 HAVING SUM(count) <> 0`
}

type LogCountInput = {
    where: string[]
    params: NonNullable<Parameters<typeof queryOnce>[1]>
    timeWhere: string
    includeServices?: boolean
    includeProjectionError?: boolean
}

// Keep the projection, rollup, and source-event fallbacks consistent for both
// realtime totals and the optional severity/service counters.
export async function queryLogCountGroups(query: typeof queryOnce, input: LogCountInput) {
    const compact = dimensionLogWhere(input.where)
    const projection = compact || input.includeProjectionError
        ? (await query('SELECT ready, last_error, (SELECT ready FROM log_counts_state WHERE id = TRUE) AS counts_ready FROM log_dimensions_state WHERE id = TRUE')).rows[0]
        : undefined
    const ready = Boolean(compact && projection?.ready)
    const rollup = compact && ready && projection?.counts_ready ? rollupLogCountsSql(compact, input.timeWhere) : null
    const dimension = input.includeServices ? 'severity, service' : 'severity'
    const groupBy = input.includeServices ? '1, 2' : '1'
    let rows
    if (rollup && input.includeServices) {
        rows = (await query(rollup, input.params)).rows
    } else if (rollup) {
        rows = (await query(`SELECT severity, SUM(count)::int AS count FROM (${rollup}) groups GROUP BY 1`, input.params)).rows
    } else if (ready && compact) {
        rows = (await query(`SELECT ${dimension}, COUNT(*)::int AS count FROM log_dimensions events WHERE ${compact.join(' AND ')} GROUP BY ${groupBy}`, input.params)).rows
    } else {
        const sourceDimensions = input.includeServices
            ? 'normalized->>\'severity\' AS severity, normalized->>\'service\' AS service'
            : 'normalized->>\'severity\' AS severity'
        rows = (await query(`SELECT ${sourceDimensions}, COUNT(*)::int AS count FROM events WHERE ${input.where.join(' AND ')} GROUP BY ${groupBy}`, input.params)).rows
    }
    return { rows, lastError: projection?.last_error || null }
}
