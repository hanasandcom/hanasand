import run from '#db'

export async function loadReliabilityMetrics(userId: string, since: string) {
    const [queueResult, verificationLatencyResult, buildDeployResult, failedProofResult, firstOutputResult, deployTimingResult] = await Promise.all([
        run(`
            SELECT lane, kind, status, COUNT(*)::int AS count
            FROM ai_verification_jobs
            WHERE owner_id = $1
              AND (created_at >= NOW() - $2::interval OR status IN ('queued', 'running'))
            GROUP BY lane, kind, status
            ORDER BY lane ASC, kind ASC, status ASC
        `, [userId, since]),
        run(`
            SELECT
                kind,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::float AS p50_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::float AS p95_ms,
                COUNT(*)::int AS sample_count
            FROM ai_verification_jobs
            WHERE owner_id = $1
              AND started_at IS NOT NULL
              AND completed_at IS NOT NULL
              AND created_at >= NOW() - $2::interval
            GROUP BY kind
            ORDER BY kind ASC
        `, [userId, since]),
        run(`
            SELECT
                kind,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
                COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
                COUNT(*)::int AS total
            FROM ai_verification_jobs
            WHERE owner_id = $1
              AND kind IN ('build', 'deploy')
              AND created_at >= NOW() - $2::interval
            GROUP BY kind
            ORDER BY kind ASC
        `, [userId, since]),
        run(`
            SELECT
                CASE
                    WHEN status = 'cancelled' THEN 'cancelled'
                    WHEN kind = 'design' AND COALESCE(error, '') ILIKE '%generic%' THEN 'generic_design'
                    WHEN kind = 'design' AND COALESCE(error, '') ILIKE 'Design QA score %' THEN 'design_quality'
                    WHEN COALESCE(error, '') ILIKE 'HTTP %' THEN 'http_error'
                    WHEN COALESCE(error, '') ILIKE '%timeout%' OR COALESCE(error, '') ILIKE '%abort%' THEN 'timeout'
                    WHEN COALESCE(error, '') ILIKE '%missing target%' THEN 'missing_target'
                    WHEN COALESCE(error, '') ILIKE '%console%' THEN 'browser_console'
                    ELSE 'runner_error'
                END AS category,
                kind,
                COUNT(*)::int AS count
            FROM ai_verification_jobs
            WHERE owner_id = $1
              AND status IN ('failed', 'cancelled')
              AND created_at >= NOW() - $2::interval
            GROUP BY 1, 2
            ORDER BY count DESC
            LIMIT 12
        `, [userId, since]),
        run(`
            SELECT
                percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(metadata->>'durationMs', '')::float)::float AS p50_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY NULLIF(metadata->>'durationMs', '')::float)::float AS p95_ms,
                COUNT(*)::int AS sample_count
            FROM ai_usage_events
            WHERE owner_id = $1
              AND kind IN ('ai_run_completed', 'ai_run_failed', 'ai_run_platform_error')
              AND metadata ? 'durationMs'
              AND metadata->>'durationMs' ~ '^[0-9]+(\\.[0-9]+)?$'
              AND created_at >= NOW() - $2::interval
        `, [userId, since]),
        run(`
            SELECT
                percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000)::float AS p50_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000)::float AS p95_ms,
                COUNT(*)::int AS sample_count
            FROM ai_deployments
            WHERE owner_id = $1
              AND completed_at IS NOT NULL
              AND created_at >= NOW() - $2::interval
        `, [userId, since]),
    ])
    return {
        queueResult,
        verificationLatencyResult,
        buildDeployResult,
        failedProofResult,
        firstOutputResult,
        deployTimingResult,
    }
}
