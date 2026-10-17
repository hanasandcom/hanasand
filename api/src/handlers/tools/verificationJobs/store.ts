import run from '#db'
import type { VerificationJobRow } from './model.ts'

export async function updateStep(id: string, step: string) {
    await run('UPDATE ai_verification_jobs SET current_step = $2, updated_at = NOW() WHERE id = $1 AND status = \'running\'', [id, step])
}

export async function updateQueuePositions() {
    await run(`
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY priority DESC, created_at ASC) AS position
            FROM ai_verification_jobs
            WHERE status = 'queued'
        )
        UPDATE ai_verification_jobs jobs
        SET queue_position = ranked.position,
            updated_at = NOW()
        FROM ranked
        WHERE jobs.id = ranked.id
    `)
    await run('UPDATE ai_verification_jobs SET queue_position = 0 WHERE status <> \'queued\' AND queue_position <> 0')
}

export async function queueSummary(ownerId: string) {
    const result = await run(`
        SELECT
            COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
            COUNT(*) FILTER (WHERE status = 'running')::int AS running,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
        FROM ai_verification_jobs
        WHERE owner_id = $1
          AND created_at > NOW() - INTERVAL '24 hours'
    `, [ownerId])
    return result.rows[0] || { queued: 0, running: 0, failed: 0, completed: 0 }
}

export async function getJob(id: string) {
    const result = await run('SELECT * FROM ai_verification_jobs WHERE id = $1', [id])
    return result.rows[0] as VerificationJobRow | undefined
}

export async function getJobForOwner(id: string, ownerId: string) {
    const result = await run('SELECT * FROM ai_verification_jobs WHERE id = $1 AND owner_id = $2', [id, ownerId])
    return result.rows[0] as VerificationJobRow | undefined
}
