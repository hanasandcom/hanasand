import assert from 'node:assert/strict'
import { queryOnce } from '../../src/utils/db.ts'
import { consumeSharedRateLimitBucket, RATE_LIMIT_BUCKET_CLEANUP_BATCH } from '../../src/utils/rateLimit/config.ts'

export async function verifyRateLimitCleanup() {
    await queryOnce(`
    INSERT INTO api_rate_limit_buckets (bucket_key, window_started_at, request_count, updated_at)
    SELECT 'expired:' || value, NOW() - INTERVAL '3 days', 1, NOW() - INTERVAL '3 days'
    FROM generate_series(1, 150) value
`)
    await queryOnce(`
    INSERT INTO api_rate_limit_buckets (bucket_key, window_started_at, request_count, updated_at)
    VALUES ('fresh:must-survive', NOW(), 1, NOW())
`)
    const firstCleanup = await consumeSharedRateLimitBucket({
        key: 'cleanup:probe',
        rule: { windowMs: 60_000, maxRequests: 10 },
    })
    assert.equal(firstCleanup.cleanupCount, RATE_LIMIT_BUCKET_CLEANUP_BATCH)
    assert.equal(Number((await queryOnce('SELECT COUNT(*) count FROM api_rate_limit_buckets WHERE bucket_key LIKE \'expired:%\'')).rows[0].count), 50)
    const secondCleanup = await consumeSharedRateLimitBucket({
        key: 'cleanup:probe',
        rule: { windowMs: 60_000, maxRequests: 10 },
    })
    assert.equal(secondCleanup.cleanupCount, 50)
    assert.equal(Number((await queryOnce('SELECT COUNT(*) count FROM api_rate_limit_buckets WHERE bucket_key LIKE \'expired:%\'')).rows[0].count), 0)
    assert.equal(Number((await queryOnce('SELECT COUNT(*) count FROM api_rate_limit_buckets WHERE bucket_key = \'fresh:must-survive\'')).rows[0].count), 1)
    assert.match((await queryOnce(`
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_api_rate_limit_buckets_updated_at'
`)).rows[0].indexdef, /updated_at/)

}
