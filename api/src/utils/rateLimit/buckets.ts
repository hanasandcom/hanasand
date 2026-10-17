import run, { queryOnce } from '#db'

export const RATE_LIMIT_BUCKET_CLEANUP_BATCH = 100
export const RATE_LIMIT_BUCKET_RETENTION_MS = 2 * 24 * 60 * 60 * 1000

export async function consumeSharedRateLimitBucket(
    { key, rule }: { key: string, rule: RateLimitRule },
    query: typeof run = run,
) {
    const result = await query(`
        WITH expired AS (
            SELECT bucket_key
            FROM api_rate_limit_buckets
            WHERE updated_at < NOW() - ($4 * INTERVAL '1 millisecond')
              AND bucket_key <> $1
            ORDER BY updated_at
            LIMIT $5
        ),
        cleaned AS (
            DELETE FROM api_rate_limit_buckets bucket
            USING expired
            WHERE bucket.bucket_key = expired.bucket_key
              AND bucket.updated_at < NOW() - ($4 * INTERVAL '1 millisecond')
            RETURNING 1
        ),
        consumed AS (
            ${consumeBucketSql(1, 2, 3)}
        )
        SELECT consumed.*, (SELECT COUNT(*)::int FROM cleaned) AS cleanup_count
        FROM consumed
    `, [key, rule.windowMs, rule.maxRequests, RATE_LIMIT_BUCKET_RETENTION_MS, RATE_LIMIT_BUCKET_CLEANUP_BATCH])
    return readBucket(result.rows[0], rule)
}

// One statement keeps the global counter locked only for server-side work and
// the durable commit, without holding it across additional network round trips.
export async function consumeSharedRateLimitPair(
    global: { key: string, rule: RateLimitRule },
    route: { key: string, rule: RateLimitRule },
    query: typeof run = queryOnce,
) {
    const result = await query(`
        WITH expired AS (
            SELECT bucket_key FROM api_rate_limit_buckets
            WHERE updated_at < NOW() - ($7 * INTERVAL '1 millisecond')
              AND bucket_key NOT IN ($1, $4)
            ORDER BY updated_at LIMIT $8
            FOR UPDATE SKIP LOCKED
        ), cleaned AS (
            DELETE FROM api_rate_limit_buckets bucket USING expired
            WHERE bucket.bucket_key = expired.bucket_key
              AND bucket.updated_at < NOW() - ($7 * INTERVAL '1 millisecond')
            RETURNING 1
        ), global_bucket AS (
            ${consumeBucketSql(1, 2, 3)}
        ), route_bucket AS (
            ${consumeBucketSql(4, 5, 6, 'FROM global_bucket WHERE request_count <= $3')}
        )
        SELECT row_to_json(global_bucket) AS global_bucket,
            (SELECT row_to_json(route_bucket) FROM route_bucket) AS route_bucket,
            (SELECT COUNT(*)::int FROM cleaned) AS cleanup_count
        FROM global_bucket
    `, [global.key, global.rule.windowMs, global.rule.maxRequests,
        route.key, route.rule.windowMs, route.rule.maxRequests,
        RATE_LIMIT_BUCKET_RETENTION_MS, 2 * RATE_LIMIT_BUCKET_CLEANUP_BATCH])
    const row = result.rows[0]
    const globalCheck = readBucket(row?.global_bucket, global.rule)
    if (globalCheck.allowed && !row?.route_bucket) throw new Error('Missing route rate-limit result')
    return {
        globalCheck,
        routeCheck: row?.route_bucket ? readBucket(row.route_bucket, route.rule) : null,
    }
}

function consumeBucketSql(key: number, window: number, max: number, condition = '') {
    return `
        INSERT INTO api_rate_limit_buckets (bucket_key, window_started_at, request_count, updated_at)
        SELECT $${key}, to_timestamp(floor(extract(epoch FROM NOW()) * 1000 / $${window}) * $${window} / 1000), 1, NOW()
        ${condition || 'WHERE TRUE'}
        ON CONFLICT (bucket_key) DO UPDATE SET
            window_started_at = EXCLUDED.window_started_at,
            request_count = CASE
                WHEN api_rate_limit_buckets.window_started_at = EXCLUDED.window_started_at
                    THEN LEAST(api_rate_limit_buckets.request_count + 1, $${max} + 1)
                ELSE 1
            END,
            updated_at = NOW()
        RETURNING request_count,
            window_started_at + ($${window} * INTERVAL '1 millisecond') AS reset_at,
            GREATEST(EXTRACT(EPOCH FROM (window_started_at + ($${window} * INTERVAL '1 millisecond') - NOW())) * 1000, 0) AS retry_after_ms
    `
}

function readBucket(row: Record<string, any> | undefined, rule: RateLimitRule) {
    const count = Number(row?.request_count)
    const resetAt = new Date(row?.reset_at).getTime()
    const retryAfterMs = Number(row?.retry_after_ms)
    const allowed = Number.isFinite(count) && count <= rule.maxRequests
    return {
        allowed,
        remaining: allowed ? Math.max(rule.maxRequests - count, 0) : 0,
        resetAt,
        retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : 0,
        cleanupCount: Number(row?.cleanup_count) || 0,
    }
}

export async function resetSharedRateLimitBuckets(prefix: string, query: typeof run = run) {
    const result = await query(`
        DELETE FROM api_rate_limit_buckets
        WHERE LEFT(bucket_key, LENGTH($1)) = $1
    `, [prefix])
    return result.rowCount ?? 0
}
