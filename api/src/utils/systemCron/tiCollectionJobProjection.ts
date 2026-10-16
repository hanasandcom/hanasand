import type { ScheduledJobTelemetry, UnifiedScheduledJob } from '../systemCron.ts'
import type { TiFetchResult } from './tiScraperClient.ts'
import { ageMs, secondsSchedule } from './jobMetrics.ts'
import { arrayValue, numberValue, record, stringValue, tiLoopStatus, tiScheduledJob } from './tiJobProjection.ts'

export function tiAutomaticReviewJob(result: TiFetchResult, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const pressure = record(record(record(result.json).pressure).automaticReview)
    const counts = record(pressure.counts)
    const backlog = numberValue(pressure.backlog) ?? 0
    const deadLetters = numberValue(counts.dead_letter) ?? 0
    const known = result.ok && typeof pressure.enabled === 'boolean'
    const enabled = known && pressure.enabled === true
    const running = enabled && (numberValue(counts.running) ?? 0) > 0
    return tiScheduledJob({
        id: 'ti-automatic-review',
        name: 'Automatic claim and incident review',
        description: 'Startup-owned Hanasand AI review worker for eligible retained claims and incidents.',
        source: 'scraper/src/api/automaticReviewRoutes.ts',
        schedule: 'Every minute',
        cadenceSeconds: 60,
        enabled,
        running,
        status: tiLoopStatus({ available: known, enabled, running }),
        lastRunAt: null,
        lastSuccessAt: null,
        lastFinishedAt: null,
        nextRunAt: null,
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: deadLetters,
        lastError: deadLetters ? `${deadLetters} automatic review task${deadLetters === 1 ? '' : 's'} in dead letter.` : result.error || (!known ? 'Automatic review worker state is unavailable.' : null),
        logExcerpt: result.ok ? `${pressure.total ?? 0} tasks; ${backlog} queued/running/retrying; ${counts.terminal ?? 0} terminal; ${deadLetters} dead letter.` : result.error || (!known ? 'Automatic review worker state is unavailable.' : null),
        controls: [],
        controlMode: 'observable_only',
        resourceUsage: { ...resourceUsage, queueDepth: backlog },
        powerAssumption: 'Shares the ti-scraper and configured Hanasand AI service power estimate.',
        assumptions: ['This card observes the existing startup-owned worker. Replay remains evidence- and task-scoped through the automatic review API.'],
    })
}

export function tiAutomaticEvaluationJob(result: TiFetchResult, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const pressure = record(record(record(result.json).pressure).automaticEvaluation)
    const counts = record(pressure.counts)
    const backlog = ['pending', 'queued', 'running', 'retrying', 'retry_scheduled']
        .reduce((total, state) => total + (numberValue(counts[state]) ?? 0), 0)
    const deadLetters = numberValue(counts.dead_letter) ?? 0
    const running = pressure.running === true
    const enabled = result.ok && pressure.enabled === true
    const failures = (numberValue(pressure.errorCount) ?? 0) + deadLetters
    return tiScheduledJob({
        id: 'ti-automatic-evaluation',
        name: 'Independent automatic accuracy evaluation',
        description: 'Startup-owned prediction-hidden evaluation loop over retained evidence and immutable labels.',
        source: 'scraper/src/api/evaluationBenchmarkRoutes.ts',
        schedule: secondsSchedule(numberValue(pressure.intervalSeconds) ?? 60),
        cadenceSeconds: numberValue(pressure.intervalSeconds) ?? 60,
        enabled,
        running,
        status: tiLoopStatus({ available: result.ok, enabled, running }),
        lastRunAt: stringValue(pressure.lastCycleAt),
        lastSuccessAt: stringValue(pressure.lastSuccessAt),
        lastFinishedAt: stringValue(pressure.lastSuccessAt ?? pressure.lastErrorAt),
        nextRunAt: enabled ? stringValue(pressure.nextCycleAt) : null,
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: failures,
        lastError: stringValue(pressure.lastError) ?? (failures ? `${pressure.errorCount ?? 0} loop errors; ${deadLetters} evaluation tasks in dead letter.` : result.error),
        logExcerpt: result.ok ? `${pressure.activeBenchmarkCount ?? 0}/${pressure.benchmarkCount ?? 0} active benchmarks; ${pressure.taskCount ?? 0} tasks; ${backlog} pending/retrying; ${deadLetters} dead letter.` : result.error,
        controls: [],
        controlMode: 'observable_only',
        resourceUsage: { ...resourceUsage, queueDepth: backlog },
        powerAssumption: 'Shares the ti-scraper and configured Hanasand AI service power estimate.',
        assumptions: ['This card observes the existing startup-owned evaluation loop. Benchmark replay remains scoped through the evaluation API.'],
    })
}

export function tiRestrictedMetadataJob(result: TiFetchResult, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const state = record(record(record(result.json).collection).restrictedMetadata)
    const enabled = result.ok && state.enabled === true
    const running = enabled && state.running === true
    const cadenceSeconds = numberValue(state.intervalSeconds) ?? 900
    const lastError = stringValue(state.lastError) ?? result.error
    return tiScheduledJob({
        id: 'ti-restricted-metadata-collection',
        name: 'Restricted metadata collection loop',
        description: 'Metadata-only collection from explicitly approved restricted sources through the configured proxy boundary.',
        source: 'scraper/src/ops/restrictedMetadataCollection.ts',
        schedule: secondsSchedule(cadenceSeconds),
        cadenceSeconds,
        enabled,
        running,
        status: tiLoopStatus({ available: result.ok, enabled, running, failed: Boolean(lastError) }),
        lastRunAt: stringValue(state.lastCycleAt),
        lastSuccessAt: stringValue(state.lastSuccessAt),
        lastFinishedAt: stringValue(state.lastSuccessAt ?? state.lastErrorAt),
        nextRunAt: enabled ? stringValue(state.nextCycleAt) : null,
        currentRunDurationMs: running ? ageMs(stringValue(state.lastCycleAt)) : null,
        averageRuntimeMs: null,
        failureCount: numberValue(state.errorCount) ?? 0,
        lastError,
        logExcerpt: result.ok
            ? `${state.cycleCount ?? 0} cycles; ${state.successCount ?? 0} successful; ${state.failedSourceCount ?? 0} sources failed in the latest cycle.`
            : result.error,
        controls: [],
        controlMode: 'observable_only',
        resourceUsage,
        powerAssumption: 'Shares the ti-scraper collection service power estimate.',
        assumptions: ['Enablement and proxy configuration are deployment policy; this card reports loop state without bypassing source approvals.'],
    })
}

export function tiCollectionJob(result: TiFetchResult, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const payload = record(result.json)
    const scheduler = record(payload.scheduler)
    const running = Boolean(scheduler.running)
    const enabled = result.ok && scheduler.enabled !== false
    const latestRun = record(scheduler.lastRun)
    const failures = arrayValue(payload.failures)
    return tiScheduledJob({
        id: 'ti-public-canary-collection',
        name: 'Public TI collection loop',
        description: 'Scraper-native recurring collection loop for public CTI, Telegram/public-channel, advisory, and exposure-producing sources.',
        source: 'scraper/src/ops/canaryCollection.ts',
        schedule: secondsSchedule(numberValue(scheduler.intervalSeconds) ?? 300),
        cadenceSeconds: numberValue(scheduler.intervalSeconds) ?? 300,
        enabled,
        running,
        status: result.ok ? running ? 'running' : enabled ? 'enabled' : 'paused' : 'blocked',
        lastRunAt: stringValue(latestRun.createdAt ?? latestRun.updatedAt),
        lastSuccessAt: stringValue(record(scheduler.lastSuccessfulRun).updatedAt),
        lastFinishedAt: stringValue(latestRun.updatedAt),
        nextRunAt: stringValue(scheduler.nextRunAt),
        currentRunDurationMs: running ? ageMs(stringValue(latestRun.createdAt ?? latestRun.updatedAt)) : null,
        averageRuntimeMs: null,
        failureCount: failures.length,
        lastError: failures.length ? stringValue(record(failures[0]).reason) : result.error,
        logExcerpt: latestRun.id ? `${latestRun.status || 'run'}: ${latestRun.captureCount ?? 0} captures, ${latestRun.failedTaskCount ?? 0} failed tasks.` : result.error,
        controls: [enabled ? 'pause' : 'resume', 'run_now'],
        controlMode: 'safe_control',
        resourceUsage,
        powerAssumption: 'Estimated shared ti-scraper service draw for scraper workers; exact per-job power is unavailable.',
        assumptions: ['Pause/resume controls toggle the scraper canary collection loop; already-running cycles are not interrupted.'],
    })
}
