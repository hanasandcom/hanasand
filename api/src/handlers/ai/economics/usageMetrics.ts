import run from '#db'

export async function loadUsageMetrics(userId: string, since: string) {
    const [summaryResult, trendResult, recentResult, cacheResult] = await Promise.all([
        run(`
            SELECT
                COUNT(*)::int AS event_count,
                COALESCE(SUM(units), 0)::int AS token_units,
                COALESCE(SUM(billable_units), 0)::int AS billable_units,
                COALESCE(SUM(estimated_cost_nok), 0)::float AS estimated_cost_nok,
                COALESCE(SUM(CASE WHEN outcome IN ('verified', 'deployed') THEN billable_units ELSE 0 END), 0)::int AS verified_units,
                COALESCE(SUM(CASE WHEN outcome = 'platform_error' THEN units ELSE 0 END), 0)::int AS platform_error_units,
                COALESCE(SUM(CASE WHEN outcome = 'platform_error' THEN estimated_cost_nok ELSE 0 END), 0)::float AS failed_platform_discount_nok,
                COALESCE(SUM(CASE WHEN kind = 'browser_proof_completed' THEN units ELSE 0 END), 0)::int AS browser_proofs,
                COALESCE(SUM(CASE WHEN kind = 'build_minutes_recorded' THEN units ELSE 0 END), 0)::int AS build_minutes,
                COALESCE(SUM(CASE WHEN kind = 'deploy_minutes_recorded' THEN units ELSE 0 END), 0)::int AS deploy_minutes
            FROM ai_usage_events
            WHERE owner_id = $1
              AND created_at >= NOW() - $2::interval
        `, [userId, since]),
        run(`
            SELECT
                date_trunc('day', created_at) AS bucket,
                COUNT(*)::int AS event_count,
                COALESCE(SUM(units), 0)::int AS token_units,
                COALESCE(SUM(billable_units), 0)::int AS billable_units,
                COALESCE(SUM(estimated_cost_nok), 0)::float AS estimated_cost_nok,
                COALESCE(SUM(CASE WHEN outcome IN ('verified', 'deployed') THEN billable_units ELSE 0 END), 0)::int AS verified_units,
                COALESCE(SUM(CASE WHEN outcome = 'platform_error' THEN units ELSE 0 END), 0)::int AS platform_error_units
            FROM ai_usage_events
            WHERE owner_id = $1
              AND created_at >= NOW() - $2::interval
            GROUP BY 1
            ORDER BY 1 ASC
        `, [userId, since]),
        run(`
            SELECT id, kind, units, billable_units, estimated_cost_nok, billing_mode, outcome, metadata, created_at
            FROM ai_usage_events
            WHERE owner_id = $1
              AND kind IN ('ai_run_completed', 'ai_run_failed', 'ai_run_platform_error', 'deployment_started', 'release_recorded', 'browser_proof_completed', 'build_minutes_recorded', 'deploy_minutes_recorded')
            ORDER BY created_at DESC
            LIMIT 20
        `, [userId]),
        run(`
            SELECT
                COALESCE(SUM(CASE WHEN kind = 'cache_hit' THEN units ELSE 0 END), 0)::int AS cache_hits,
                COALESCE(SUM(CASE WHEN kind <> 'cache_hit' AND metadata ? 'cacheKey' THEN units ELSE 0 END), 0)::int AS cacheable_events
            FROM ai_usage_events
            WHERE owner_id = $1
              AND created_at >= NOW() - $2::interval
        `, [userId, since]),
    ])
    return {
        summaryResult,
        trendResult,
        recentResult,
        cacheResult,
    }
}
