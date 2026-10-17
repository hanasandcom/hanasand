import { randomUUID } from 'node:crypto'
import { queryOnce } from '#db'
import { MAX_ATTEMPTS, organizationRetentionCutoff, type RetentionRun } from './organizationPrivacyPolicy.ts'

export async function queueOrganizationRetentionRun(input: {
    organizationId: string
    triggerType: 'manual' | 'privacy_deletion'
    requestedBy: string
    requestId: string
    privacyRequestId?: string
    retentionDays: number
}) {
    const cutoffAt = input.triggerType === 'privacy_deletion'
        ? new Date().toISOString()
        : organizationRetentionCutoff(input.retentionDays)
    const result = await queryOnce(`
        INSERT INTO organization_retention_runs (
            id, organization_id, privacy_request_id, trigger_type, retention_days,
            cutoff_at, requested_by, request_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
        RETURNING *
    `, [randomUUID(), input.organizationId, input.privacyRequestId ?? null, input.triggerType, input.triggerType === 'privacy_deletion' ? 0 : input.retentionDays, cutoffAt, input.requestedBy, input.requestId])
    if (result.rows[0]) return result.rows[0]
    const existing = await queryOnce(`
        SELECT * FROM organization_retention_runs
         WHERE organization_id = $1 AND trigger_type = $2 AND request_id = $3
         LIMIT 1
    `, [input.organizationId, input.triggerType, input.requestId])
    if (existing.rows[0]) return existing.rows[0]
    throw new Error('This organization already has an active retention or privacy run.')
}

export async function claimAndProcessOrganizationRetentionRun<T>(
    runId: string | undefined,
    processRetentionRun: (run: RetentionRun) => Promise<T>,
) {
    await queryOnce(`
        UPDATE organization_retention_runs
           SET status = CASE WHEN attempt_count >= $1 THEN 'dead_letter' ELSE 'failed' END,
               error = 'Interrupted while running; queued for safe retry.',
               next_retry_at = CASE WHEN attempt_count >= $1 THEN NULL ELSE NOW() END, updated_at = NOW()
         WHERE status = 'running' AND updated_at < NOW() - INTERVAL '10 minutes'
    `, [MAX_ATTEMPTS])
    await queryOnce(`
        INSERT INTO organization_retention_runs (
            id, organization_id, trigger_type, retention_days, cutoff_at, run_date
        )
        SELECT gen_random_uuid()::text, id, 'scheduled', retention_days,
               NOW() - make_interval(days => retention_days), CURRENT_DATE
          FROM organizations
         WHERE status = 'active'
        ON CONFLICT DO NOTHING
    `)
    const claimed = await queryOnce(`
        WITH next_per_organization AS MATERIALIZED (
            SELECT DISTINCT ON (candidate.organization_id)
                   candidate.id, candidate.organization_id, candidate.attempt_count, candidate.updated_at, candidate.created_at
              FROM organization_retention_runs candidate
             WHERE (candidate.status = 'queued'
                OR (candidate.status = 'failed' AND candidate.next_retry_at IS NOT NULL AND candidate.next_retry_at <= NOW()))
               AND candidate.attempt_count < $2
               AND NOT EXISTS (
                    SELECT 1 FROM organization_retention_runs active
                     WHERE active.organization_id = candidate.organization_id
                       AND active.status = 'running' AND active.id <> candidate.id
               )
             ORDER BY candidate.organization_id, candidate.attempt_count, candidate.updated_at, candidate.created_at
        )
        UPDATE organization_retention_runs
           SET status = 'running', attempt_count = attempt_count + 1,
               started_at = COALESCE(started_at, NOW()), next_retry_at = NULL,
               error = NULL, updated_at = NOW()
         WHERE id = (
            SELECT run.id
              FROM organization_retention_runs run
              JOIN next_per_organization next ON next.id = run.id
             WHERE ($1::text IS NULL OR run.id = $1)
             ORDER BY next.attempt_count, next.updated_at, next.created_at
             FOR UPDATE OF run SKIP LOCKED
             LIMIT 1
         )
        RETURNING *
    `, [runId ?? null, MAX_ATTEMPTS])
    if (!claimed.rows[0]) return { claimed: false }
    return processRetentionRun(claimed.rows[0] as RetentionRun)
}
