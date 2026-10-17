import run from '#db'

export async function loadReadinessMetrics(userId: string, since: string) {
    const [designQualityResult, deploymentReadinessResult, releaseReadinessResult, latestVerificationResult, latestDeploymentResult, latestReleaseResult] = await Promise.all([
        run(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
                COUNT(*)::int AS total,
                AVG(NULLIF(artifacts #>> '{0,data,score}', '')::float) AS avg_score
            FROM ai_verification_jobs
            WHERE owner_id = $1
              AND kind = 'design'
              AND created_at >= NOW() - $2::interval
        `, [userId, since]),
        run(`
            SELECT
                COUNT(*)::int AS deployment_count,
                COUNT(*) FILTER (WHERE created_at >= NOW() - $2::interval)::int AS recent_deployment_count,
                COUNT(*) FILTER (WHERE status = 'running')::int AS running_deployments,
                COUNT(*) FILTER (WHERE healthcheck_url IS NOT NULL)::int AS healthchecked_deployments,
                COUNT(*) FILTER (
                    WHERE EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(events) AS event
                        WHERE event->>'stage' IN ('sync', 'build', 'run', 'healthcheck', 'healthcheck_failed', 'blocked')
                    )
                )::int AS deployments_with_sync_events,
                COUNT(*) FILTER (WHERE stack_type IS NOT NULL AND stack_type <> 'unknown')::int AS deployments_with_stack,
                COUNT(*) FILTER (WHERE access_policy IS NOT NULL)::int AS deployments_with_access_policy
            FROM ai_deployments
            WHERE owner_id = $1
        `, [userId, since]),
        run(`
            SELECT
                COUNT(*)::int AS release_count,
                COUNT(*) FILTER (WHERE created_at >= NOW() - $2::interval)::int AS recent_release_count,
                COUNT(*) FILTER (WHERE deployment_id IS NOT NULL AND preview_url IS NOT NULL)::int AS rollback_ready_releases,
                COUNT(*) FILTER (WHERE status = 'current')::int AS current_releases,
                COUNT(*) FILTER (WHERE status = 'superseded')::int AS superseded_releases,
                COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_releases
            FROM ai_releases
            WHERE owner_id = $1
        `, [userId, since]),
        run(`
            SELECT DISTINCT ON (kind)
                kind, id, status, current_step, error, updated_at, completed_at, cancelled_at
            FROM ai_verification_jobs
            WHERE owner_id = $1
            ORDER BY kind, updated_at DESC, created_at DESC
        `, [userId]),
        run(`
            SELECT
                id, status, vm_name, service_name, failure_reason, updated_at, completed_at
            FROM ai_deployments
            WHERE owner_id = $1
            ORDER BY updated_at DESC, created_at DESC
            LIMIT 1
        `, [userId]),
        run(`
            SELECT id, status, deployment_id, updated_at
            FROM ai_releases
            WHERE owner_id = $1
            ORDER BY updated_at DESC, created_at DESC
            LIMIT 1
        `, [userId]),
    ])
    return {
        designQualityResult,
        deploymentReadinessResult,
        releaseReadinessResult,
        latestVerificationResult,
        latestDeploymentResult,
        latestReleaseResult,
    }
}
