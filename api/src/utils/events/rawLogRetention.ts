import { withTransaction } from '#db'

export const RAW_LOG_RETENTION_JOB_ID = 'api-raw-log-retention'

export async function retainRawLogs() {
    return { deleted: 0 }
}

// The traffic dashboard reads hourly aggregates. Keep the complete boundary
// hour for its exact rolling seven-day count, and wait for aggregation as well
// as Event processing before removing the raw duplicate.
export async function retainTrafficLogs() {
    return withTransaction(async query => {
        await query('SET LOCAL statement_timeout = \'20s\'')
        await query('SET LOCAL lock_timeout = \'2s\'')
        const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'traffic-log-retention\', 0)) AS acquired')
        if (!lock.rows[0].acquired) return { deleted: 0 }
        const { rows: [result] } = await query(`WITH event_matches AS MATERIALIZED (
            SELECT e.ctid, e.normalized #>> '{metadata,origin,id}' AS traffic_id
            FROM events e
            WHERE e.ingestion_id='logs' AND e.processing_status='processed'
              AND e.normalized #>> '{metadata,origin,table}'='traffic_events'
              AND e.normalized #>> '{metadata,origin,id}' ~ '^[0-9]+$'
              -- Narrow candidates through the existing processed-log trigram index.
              AND translate(lower(e.normalized::text), ' ', '0') LIKE '%traffic_events%'
            FOR UPDATE OF e SKIP LOCKED
        ), eligible AS MATERIALIZED (
            SELECT t.id FROM event_matches e
            JOIN traffic_events t ON t.id=e.traffic_id::bigint
            WHERE t.created_at < date_trunc('hour', NOW() - INTERVAL '7 days')
              AND t.created_at < (SELECT covered_before FROM traffic_history_state WHERE singleton)
            ORDER BY t.created_at, t.id LIMIT 5000
            FOR UPDATE OF t SKIP LOCKED
        ), removed AS (
            DELETE FROM traffic_events t USING eligible WHERE t.id = eligible.id RETURNING t.id
        ) SELECT count(*)::int AS deleted FROM removed`)
        if (result.deleted) await query(`INSERT INTO system_events(event_type,source,object_type,reason,context)
            VALUES ('logs.raw_retention','event','traffic_events',
                'Removed raw traffic older than seven days after completed Event ingestion and traffic aggregation',
                jsonb_build_object('deleted',$1::int,'retentionDays',7,'eventEventsPreserved',true,'trafficHistoryPreserved',true))`, [result.deleted])
        return { deleted: result.deleted as number }
    })
}
