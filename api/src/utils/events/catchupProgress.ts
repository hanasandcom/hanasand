import run, { withTransaction } from '#db'

type Sample = { remaining: number, processed: number, total: number, rate: number | null, estimated_seconds: number | null, updated_at: string }

export function catchupSample(remaining: number,
    previous: { payload: Partial<Sample>, sampled_at: string | Date | null }, now: Date): Sample {
    const elapsed = previous.sampled_at ? (now.getTime() - new Date(previous.sampled_at).getTime()) / 1000 : 0
    const priorRemaining = Number.isFinite(previous.payload.remaining) ? Number(previous.payload.remaining) : remaining
    const delta = Math.max(0, priorRemaining - remaining)
    const processed = (previous.payload.processed || 0) + (elapsed > 0 ? delta : 0)
    const observed = elapsed > 0 && delta > 0 ? delta / elapsed : null
    const rate = observed && previous.payload.rate ? previous.payload.rate * 0.5 + observed * 0.5 : observed
    return { remaining, processed, total: processed + remaining, rate,
        estimated_seconds: remaining === 0 ? 0 : rate ? Math.ceil(remaining / rate) : null, updated_at: now.toISOString() }
}

// Count rows still waiting in the three durable source cursors, plus pending
// log Events that are not already represented by one of those source rows.
// `UNION` deduplicates a source-origin Event committed just before its cursor
// transaction advances. Missing cursors conservatively leave the source rows
// in the live lane until the processor initializes that cursor.
const remainingCatchupSql = `WITH remaining AS (
    SELECT 'login_events'::text AS source, s.id::text AS source_id
    FROM login_events s LEFT JOIN log_processing_cursors c ON c.name='login_events'
    WHERE (c.history_end_id IS NOT NULL AND s.id > COALESCE(c.last_id,0) AND s.id <= c.history_end_id)
       OR s.id > COALESCE(c.recent_id,0)
    UNION ALL
    SELECT 'traffic_events'::text, s.id::text
    FROM traffic_events s LEFT JOIN log_processing_cursors c ON c.name='traffic_events'
    WHERE (c.history_end_id IS NOT NULL AND s.id > COALESCE(c.last_id,0) AND s.id <= c.history_end_id)
       OR s.id > COALESCE(c.recent_id,0)
    UNION ALL
    SELECT 'system_events'::text, s.id::text
    FROM system_events s LEFT JOIN log_processing_cursors c ON c.name='system_events'
    WHERE (c.history_end_id IS NOT NULL AND s.id > COALESCE(c.last_id,0) AND s.id <= c.history_end_id)
       OR s.id > COALESCE(c.recent_id,0)
    UNION
    SELECT CASE WHEN e.normalized #>> '{metadata,origin,table}' IN ('login_events','traffic_events','system_events')
                THEN e.normalized #>> '{metadata,origin,table}' ELSE 'event' END,
           CASE WHEN e.normalized #>> '{metadata,origin,table}' IN ('login_events','traffic_events','system_events')
                THEN COALESCE(NULLIF(e.normalized #>> '{metadata,origin,id}',''),e.id)
                ELSE e.id END
    FROM events e WHERE e.ingestion_id='logs' AND e.processing_status='pending'
)
SELECT COUNT(*)::bigint AS remaining,
    (SELECT MIN(received_at) FROM events WHERE ingestion_id='logs' AND processing_status='pending') AS oldest_received_at
FROM remaining`

let sampling: Promise<void> | null = null
export function refreshLogCatchupProgress() {
    return sampling ||= sampleProgress().finally(() => { sampling = null })
}

async function sampleProgress() {
    try {
        await withTransaction(async query => {
            await query('SET LOCAL statement_timeout = \'20s\'')
            const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'logs:catchup-progress\', 0)) AS locked')
            if (!lock.rows[0].locked) return
            const previous = (await query('SELECT * FROM log_catchup_progress WHERE id = TRUE')).rows[0]
            const now = new Date()
            if (!previous || previous.attempted_at && now.getTime() - new Date(previous.attempted_at).getTime() < 30_000) return
            const { rows: [backlog] } = await query(remainingCatchupSql)
            const payload = { ...catchupSample(Number(backlog.remaining), previous, now),
                oldest_received_at: backlog.oldest_received_at }
            await query('UPDATE log_catchup_progress SET payload=$1::jsonb, sampled_at=$2, attempted_at=$2, last_error=NULL WHERE id=TRUE',
                [JSON.stringify(payload), now])
        })
    } catch (error) {
        await run('UPDATE log_catchup_progress SET last_error=$1, attempted_at=clock_timestamp() WHERE id=TRUE', [error instanceof Error ? error.message : 'Progress measurement failed']).catch(() => {})
    }
}
