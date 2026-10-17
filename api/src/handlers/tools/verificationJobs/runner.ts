import run from '#db'
import { getJob, updateQueuePositions } from './store.ts'
import { runBrowserJob, runDesignJob } from './proofJobs.ts'
import { completeNonBrowserJob } from './receiptJob.ts'
import type { VerificationJobRow } from './model.ts'

export async function runVerificationJob(job: VerificationJobRow, signal: AbortSignal) {
    try {
        if (job.kind === 'browser') {
            await runBrowserJob(job, signal)
        } else if (job.kind === 'design') {
            await runDesignJob(job, signal)
        } else {
            await completeNonBrowserJob(job)
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const current = await getJob(job.id)
        if (current?.status === 'cancelled') {
            return
        }
        if ((current?.retry_count || 0) < (current?.max_retries || 0)) {
            const requeued = await run(`
                UPDATE ai_verification_jobs
                SET status = 'queued',
                    retry_count = retry_count + 1,
                    current_step = 'Retry queued',
                    error = $2,
                    updated_at = NOW()
                WHERE id = $1
                  AND status = 'running'
                RETURNING id
            `, [job.id, message])
            if (requeued.rows.length > 0) await updateQueuePositions()
            return
        }
        await run(`
            UPDATE ai_verification_jobs
            SET status = 'failed',
                current_step = 'Failed',
                error = $2,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
              AND status = 'running'
        `, [job.id, message])
    }
}

