import { withTransaction } from '#db'
import { cachedLogQuery } from '#utils/logs/cache.ts'
import {
    authStatusCode,
    expectedHttpProbePredicate,
    expectedTrafficProbePredicate,
} from './errorPredicates.ts'

export function loadErrorSummary(includeExpected: boolean) {
    return cachedLogQuery(`error-summary:${includeExpected}`, 60_000, () => withTransaction(async query => {
        // Full-history counters refresh off the request path after startup.
        // Keep this budget local: ordinary API queries still fail promptly.
        await query('SET LOCAL statement_timeout = \'30s\'')
        return query(`
            WITH raw_events AS NOT MATERIALIZED (
                SELECT normalized->'metadata'->>'surface' AS surface, NULLIF(normalized->'metadata'->>'status_code', '')::int AS status_code, normalized->'metadata'->>'error_code' AS error_code, normalized->'metadata'->>'path' AS path, event_timestamp AS created_at
                FROM events
                WHERE ingestion_id='logs' AND processing_status='processed'
                  AND normalized->'metadata'->>'category' IN ('http_response_error', 'application_error')
                  AND ($1::boolean OR NOT COALESCE(${expectedHttpProbePredicate('normalized->\'metadata\'')}, FALSE))
                UNION ALL
                SELECT 'auth', ${authStatusCode}, reason, '/api/auth/login/:id', created_at
                FROM login_events
                WHERE status <> 'success'
                UNION ALL
                SELECT 'website', status, ('http_' || status::text), path, created_at
                FROM traffic_events
                WHERE status >= 400
                  AND ($1::boolean OR NOT ${expectedTrafficProbePredicate()})
            ),
            event_counts AS (
                SELECT surface, status_code, error_code,
                    COUNT(*)::int AS count,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS last_hour,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS last_24h
                FROM raw_events
                GROUP BY 1, 2, 3
            ),
            stats AS (
                SELECT
                    COALESCE(SUM(count), 0)::int AS total,
                    COALESCE(SUM(last_hour), 0)::int AS last_hour,
                    COALESCE(SUM(last_24h), 0)::int AS last_24h,
                    COALESCE(SUM(count) FILTER (WHERE status_code >= 500), 0)::int AS server_errors,
                    COALESCE(SUM(count) FILTER (WHERE status_code BETWEEN 400 AND 499), 0)::int AS client_errors
                FROM event_counts
            ),
            status_counts AS (
                SELECT COALESCE(jsonb_agg(jsonb_build_object('status_code', status_code, 'count', count) ORDER BY count DESC), '[]'::jsonb) AS rows
                FROM (SELECT status_code, SUM(count)::int AS count FROM event_counts GROUP BY status_code) grouped
            ),
            surface_counts AS (
                SELECT COALESCE(jsonb_agg(jsonb_build_object('surface', surface, 'count', count) ORDER BY count DESC), '[]'::jsonb) AS rows
                FROM (SELECT COALESCE(surface, 'api') AS surface, SUM(count)::int AS count FROM event_counts GROUP BY COALESCE(surface, 'api')) grouped
            ),
            code_counts AS (
                SELECT COALESCE(jsonb_agg(jsonb_build_object('error_code', error_code, 'count', count) ORDER BY count DESC), '[]'::jsonb) AS rows
                FROM (SELECT COALESCE(NULLIF(error_code, ''), 'uncategorized') AS error_code, SUM(count)::int AS count FROM event_counts GROUP BY COALESCE(NULLIF(error_code, ''), 'uncategorized')) grouped
            )
            SELECT stats.total, stats.last_hour, stats.last_24h, stats.server_errors, stats.client_errors,
                status_counts.rows AS status_counts, surface_counts.rows AS surface_counts, code_counts.rows AS code_counts
            FROM stats, status_counts, surface_counts, code_counts
        `, [includeExpected])
    }))
}

export function emptyErrorSummary() {
    return {
        total: 0, last_hour: 0, last_24h: 0, server_errors: 0, client_errors: 0,
        status_counts: [], surface_counts: [], code_counts: [],
    }
}
