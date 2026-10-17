import run from '#db'
import { runVerificationJob } from './runner.ts'
import { updateQueuePositions } from './store.ts'
import type { VerificationJobRow } from './model.ts'

const MAX_CONCURRENT_JOBS = Number(process.env.VERIFICATION_JOB_CONCURRENCY || 2)
let activeJobs = 0
let pumpScheduled = false
const activeJobControllers = new Map<string, AbortController>()

export function abortVerificationJob(id: string) {
    activeJobControllers.get(id)?.abort()
}

export function scheduleVerificationQueue() {
    if (pumpScheduled) return
    pumpScheduled = true
    setTimeout(() => {
        pumpScheduled = false
        void pumpQueue()
    }, 0)
}

async function pumpQueue() {
    await updateQueuePositions()
    while (activeJobs < MAX_CONCURRENT_JOBS) {
        const result = await run(`
            UPDATE ai_verification_jobs
            SET status = 'running',
                current_step = 'Starting',
                started_at = COALESCE(started_at, NOW()),
                updated_at = NOW()
            WHERE id = (
                SELECT id
                FROM ai_verification_jobs
                WHERE status = 'queued'
                ORDER BY priority DESC, created_at ASC
                LIMIT 1
            )
            RETURNING *
        `)
        const job = result.rows[0] as VerificationJobRow | undefined
        if (!job) return
        activeJobs += 1
        const controller = new AbortController()
        activeJobControllers.set(job.id, controller)
        void runVerificationJob(job, controller.signal).finally(() => {
            if (activeJobControllers.get(job.id) === controller) activeJobControllers.delete(job.id)
            activeJobs = Math.max(0, activeJobs - 1)
            scheduleVerificationQueue()
        })
    }
}
