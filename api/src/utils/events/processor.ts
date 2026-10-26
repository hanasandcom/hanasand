import { readLogCatchupSettings } from './catchupLimit.ts'
import { runTrackedBackgroundJob } from '../backgroundJobRuntime.ts'

export const STORED_LOG_PROCESSOR_JOB_ID = 'api-stored-log-processor'
export const LIVE_LOG_PROCESSOR_JOB_ID = 'api-live-log-processor'
export const RULE_REPROCESSOR_JOB_ID = 'api-rule-reprocessor'
export const PROTECTED_LOG_PROCESSOR_JOB_IDS = new Set([
    LIVE_LOG_PROCESSOR_JOB_ID,
    STORED_LOG_PROCESSOR_JOB_ID,
    RULE_REPROCESSOR_JOB_ID,
])

// A durable pass finishes before the next starts. Busy workers can drain work
// without a five-second idle gap; idle or failed workers still back off.
export function startLogProcessor(processBatch: () => Promise<boolean | undefined>, onError: (error: unknown) => void,
    interval = () => readLogCatchupSettings().intervalMs, now = () => performance.now(), idleMs = 5000, jobId?: string) {
    let stopped = false, timer: ReturnType<typeof setTimeout>, active: Promise<void> | undefined
    const tick = async () => {
        const started = now()
        let delay = 5000
        const processTrackedBatch = jobId
            ? () => runTrackedBackgroundJob(jobId, processBatch)
            : processBatch
        try { delay = await processTrackedBatch() ? Math.max(50, interval() - (now() - started)) : idleMs }
        catch (error) { onError(error) }
        if (!stopped) schedule(delay)
    }
    const schedule = (delay: number) => {
        timer = setTimeout(() => { active = tick() }, delay)
        timer.unref()
    }
    schedule(0)
    return async () => { stopped = true; clearTimeout(timer); await active }
}
